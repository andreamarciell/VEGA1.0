import type { Handler } from '@netlify/functions';
import { createServiceClient } from './_supabaseAdmin';
import { queryBigQuery, parseBigQueryDate } from './_bigqueryClient';
import {
  cercaFrazionateDep,
  cercaFrazionateWit,
  cercaPatternAML,
  calculateRiskLevel,
  type Transaction,
  type Frazionata
} from './_riskCalculation';

interface Profile {
  account_id: string;
  nick: string;
  first_name: string;
  last_name: string;
  cf: string | null;
  domain: string | null;
  point: string | null;
  current_balance: number | null;
  created_at: string;
}

interface Movement {
  id: string;
  created_at: string;
  account_id: string;
  reason: string;
  amount: number;
  ts_extension: string | null;
}

interface SessionLog {
  id: string;
  account_id: string;
  ip_address: string;
  login_time: string;
}

interface PlayerRisk {
  account_id: string;
  nick: string;
  first_name: string;
  last_name: string;
  domain: string | null;
  current_balance: number | null;
  risk_score: number;
  risk_level: 'Low' | 'Medium' | 'High' | 'Elevato';
  status?: 'active' | 'reviewed' | 'escalated' | 'archived' | 'high-risk' | 'critical-risk';
}

// Tutte le funzioni di calcolo rischio sono importate da _riskCalculation.ts

const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'content-type',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
      },
    };
  }

  const allowed = process.env.ALLOWED_ORIGIN || '*';

  try {
    // Query tutti i profili da BigQuery
    console.log('Step 1: Fetching profiles from BigQuery...');
    const profiles = await queryBigQuery<Profile>(
      `SELECT 
        account_id, nick, first_name, last_name, cf, domain, 
        point, current_balance, created_at
      FROM \`toppery_test.Profiles\`
      ORDER BY account_id ASC`
    );
    console.log(`Step 1: Found ${profiles.length} profiles`);

    // Leggi i risk scores pre-calcolati dal database Supabase (current scores)
    console.log('Step 2: Fetching pre-calculated risk scores from Supabase...');
    const supabase = createServiceClient();
    const { data: riskScores, error: riskError } = await supabase
      .from('player_risk_scores')
      .select('account_id, risk_score, risk_level, calculated_at, status');

    const riskScoresMap = new Map<string, { score: number; level: string; status?: string }>();
    if (!riskError && riskScores) {
      riskScores.forEach(rs => {
        riskScoresMap.set(rs.account_id, {
          score: rs.risk_score,
          level: rs.risk_level,
          status: rs.status || 'active'
        });
      });
      console.log(`Step 2: Found ${riskScores.length} pre-calculated risk scores`);
    } else if (riskError) {
      console.warn('Step 2: Error fetching risk scores, will calculate on demand:', riskError);
    } else {
      console.log('Step 2: No pre-calculated risk scores found, will calculate on demand');
    }

    const players: PlayerRisk[] = [];

    // Per ogni giocatore, usa il risk score pre-calcolato o calcolalo se non disponibile
    console.log(`Step 3: Processing ${profiles.length} players...`);
    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];
      const accountId = profile.account_id;
      
      try {
        console.log(`Step 3.${i + 1}: Processing player ${accountId} (${i + 1}/${profilesResult.rows.length})...`);

        // Verifica se esiste un risk score pre-calcolato
        const cachedRisk = riskScoresMap.get(accountId);
        
        if (cachedRisk) {
          // Usa il valore pre-calcolato (veloce!)
          console.log(`Step 3.${i + 1}: Using pre-calculated risk for ${accountId} - Score: ${cachedRisk.score}, Level: ${cachedRisk.level}`);
          players.push({
            account_id: accountId,
            nick: profile.nick,
            first_name: profile.first_name,
            last_name: profile.last_name,
            domain: profile.domain,
            current_balance: profile.current_balance,
            risk_score: cachedRisk.score,
            risk_level: cachedRisk.level as 'Low' | 'Medium' | 'High' | 'Elevato',
            status: (cachedRisk.status || 'active') as 'active' | 'reviewed' | 'escalated' | 'archived'
          });
        } else {
          // Fallback: calcola se non disponibile (per nuovi giocatori o se il cron non è ancora partito)
          console.log(`Step 3.${i + 1}: No pre-calculated risk for ${accountId}, calculating on demand...`);
          
          // Query movements per questo account da BigQuery
          console.log(`Step 3.${i + 1}.a: Fetching movements for ${accountId} from BigQuery...`);
          const movements = await queryBigQuery<Movement>(
            `SELECT id, created_at, account_id, reason, amount, ts_extension
            FROM \`toppery_test.Movements\`
            WHERE account_id = @account_id
            ORDER BY created_at ASC`,
            { account_id: accountId }
          );
          console.log(`Step 3.${i + 1}.a: Found ${movements.length} movements for ${accountId}`);

          // Converti movements in Transaction[]
          const transactions: Transaction[] = movements.map(mov => ({
            data: parseBigQueryDate(mov.created_at),
            causale: mov.reason || '',
            importo: mov.amount || 0
          }));

          // Calcola frazionate e patterns solo se ci sono transazioni
          if (transactions.length > 0) {
            console.log(`Step 3.${i + 1}.d: Calculating risk for ${accountId}...`);
            const frazionateDep = cercaFrazionateDep(transactions);
            const frazionateWit = cercaFrazionateWit(transactions);
            const patterns = cercaPatternAML(transactions);
            
            const risk = await calculateRiskLevel(frazionateDep, frazionateWit, patterns, transactions);
            console.log(`Step 3.${i + 1}.d.4: Risk calculated - Score: ${risk.score}, Level: ${risk.level}`);

            players.push({
              account_id: accountId,
              nick: profile.nick,
              first_name: profile.first_name,
              last_name: profile.last_name,
              domain: profile.domain,
              current_balance: profile.current_balance,
              risk_score: risk.score,
              risk_level: risk.level,
              status: 'active'
            });
          } else {
            console.log(`Step 3.${i + 1}.d: No transactions for ${accountId}, setting risk to Low`);
            // Nessuna transazione = rischio basso
            players.push({
              account_id: accountId,
              nick: profile.nick,
              first_name: profile.first_name,
              last_name: profile.last_name,
              domain: profile.domain,
              current_balance: profile.current_balance,
              risk_score: 0,
              risk_level: 'Low',
              status: 'active'
            });
          }
        }
        
        console.log(`Step 3.${i + 1}: Completed processing player ${accountId}`);
      } catch (playerError) {
        console.error(`Error processing player ${accountId}:`, playerError);
        console.error(`Player error stack:`, playerError instanceof Error ? playerError.stack : 'No stack');
        // Continua con il prossimo giocatore invece di fallire tutto
        players.push({
          account_id: accountId,
          nick: profile.nick,
          first_name: profile.first_name,
          last_name: profile.last_name,
          domain: profile.domain,
          current_balance: profile.current_balance,
          risk_score: 0,
          risk_level: 'Low',
          status: 'active'
        });
      }
    }

    console.log(`Step 4: Processed ${players.length} players`);

    console.log('Step 5: Returning results...');
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ players })
    };
  } catch (error) {
    console.error('=== ERROR IN getPlayersList ===');
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        error: 'Failed to get players list',
        message: error instanceof Error ? error.message : 'Unknown error',
        type: error instanceof Error ? error.constructor.name : typeof error
      })
    };
  }
};

export { handler };
