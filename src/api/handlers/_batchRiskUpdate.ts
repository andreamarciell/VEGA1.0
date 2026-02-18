/**
 * Batch risk update: ricalcola risk_score e risk_level per tutti i giocatori
 * nella tabella player_risk_scores del tenant usando l'ultima configurazione
 * (risk_engine_config) e i movimenti da BigQuery.
 * Usato dopo aggiornamento configurazione dal Super Admin (batch al salvataggio).
 */

import type { Pool } from 'pg';
import { queryBigQuery, parseBigQueryDate } from './_bigqueryClient';
import {
  cercaFrazionateDep,
  cercaFrazionateWit,
  cercaPatternAML,
  calculateRiskLevel,
  type Transaction
} from './_riskCalculation';

interface Movement {
  id: string;
  created_at: string;
  account_id: string;
  reason: string;
  amount: number;
  ts_extension: string | null;
}

export interface BatchRiskUpdateResult {
  updated: number;
  errors: number;
}

/**
 * Esegue il ricalcolo massivo di risk_score e risk_level per ogni riga in
 * player_risk_scores del tenant. Usa risk_engine_config (DB tenant) e
 * movimenti da BigQuery. Aggiorna solo risk_score, risk_level e updated_at;
 * lo status viene preservato.
 *
 * @param dbPool Pool del database tenant (Postgres)
 * @param datasetId Dataset BigQuery del tenant (per Movements)
 */
export async function performBatchRiskUpdate(
  dbPool: Pool,
  datasetId: string
): Promise<BatchRiskUpdateResult> {
  if (!dbPool) {
    throw new Error('dbPool is required for batch risk update');
  }
  if (!datasetId || datasetId.trim() === '') {
    throw new Error('datasetId is required for BigQuery queries');
  }

  const rows = await dbPool.query<{ account_id: string }>(
    'SELECT account_id FROM player_risk_scores'
  );
  const accountIds = (rows.rows || []).map(r => String(r.account_id).trim()).filter(Boolean);

  if (accountIds.length === 0) {
    return { updated: 0, errors: 0 };
  }

  let updated = 0;
  let errors = 0;
  const now = new Date().toISOString();

  for (const accountId of accountIds) {
    try {
      const movements = await queryBigQuery<Movement>(
        `SELECT 
          CAST(id AS STRING) as id,
          created_at, account_id, reason, amount, CAST(ts_extension AS STRING) as ts_extension
        FROM \`${datasetId}.Movements\`
        WHERE account_id = @account_id
        ORDER BY created_at ASC`,
        { account_id: accountId },
        datasetId
      );

      const transactions: Transaction[] = movements.map(mov => ({
        data: parseBigQueryDate(mov.created_at),
        causale: mov.reason || '',
        importo: mov.amount || 0
      }));

      let risk_score: number;
      let risk_level: 'Low' | 'Medium' | 'High' | 'Elevato';

      if (transactions.length > 0) {
        const frazionateDep = cercaFrazionateDep(transactions);
        const frazionateWit = cercaFrazionateWit(transactions);
        const patterns = cercaPatternAML(transactions);
        const risk = await calculateRiskLevel(
          frazionateDep,
          frazionateWit,
          patterns,
          transactions,
          dbPool
        );
        risk_score = risk.score;
        risk_level = risk.level;
      } else {
        risk_score = 0;
        risk_level = 'Low';
      }

      await dbPool.query(
        `UPDATE player_risk_scores 
         SET risk_score = $1, risk_level = $2, updated_at = $3 
         WHERE account_id = $4`,
        [risk_score, risk_level, now, accountId]
      );
      updated++;
    } catch (err) {
      console.error(`[performBatchRiskUpdate] Error for account_id ${accountId}:`, err);
      errors++;
    }
  }

  return { updated, errors };
}
