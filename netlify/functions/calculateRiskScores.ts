import type { Handler } from '@netlify/functions';
import { Pool } from 'pg';
import { createServiceClient } from './_supabaseAdmin';
import {
  cercaFrazionateDep,
  cercaFrazionateWit,
  cercaPatternAML,
  calculateRiskLevel,
  type Transaction
} from './_riskCalculation';

const handler: Handler = async (event) => {
  // Verifica che sia una chiamata scheduled (da Netlify cron) o manuale
  const isScheduled = event.headers['user-agent']?.includes('Netlify-Scheduled-Function');
  if (isScheduled) {
    console.log('Scheduled risk calculation started');
  } else {
    // Permette anche chiamate manuali (per test)
    console.log('Manual risk calculation triggered');
  }

  const connectionString = process.env.EXTERNAL_DB_CONNECTION_STRING;
  if (!connectionString) {
    console.error('EXTERNAL_DB_CONNECTION_STRING not configured');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Database connection not configured' })
    };
  }

  if (!connectionString.includes('sslmode=require')) {
    console.error('SSL mode not set to require');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'SSL mode must be require' })
    };
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  const supabase = createServiceClient();

  try {
    // Query tutti i profili
    console.log('Fetching profiles from database...');
    const profilesResult = await pool.query(`
      SELECT account_id, nick, first_name, last_name
      FROM profiles
      ORDER BY account_id ASC
    `);

    console.log(`Found ${profilesResult.rows.length} profiles to process`);

    const updates: Array<{ account_id: string; risk_score: number; risk_level: string }> = [];

    // Per ogni giocatore, calcola il rischio
    for (let i = 0; i < profilesResult.rows.length; i++) {
      const profile = profilesResult.rows[i];
      const accountId = profile.account_id;
      
      try {
        if (i % 10 === 0) {
          console.log(`Processing player ${i + 1}/${profilesResult.rows.length}: ${accountId}`);
        }

        // Query movements
        const movementsResult = await pool.query(`
          SELECT id, created_at, account_id, reason, amount, ts_extension
          FROM movements
          WHERE account_id = $1
          ORDER BY created_at ASC
        `, [accountId]);

        // Converti in Transaction[]
        const transactions: Transaction[] = movementsResult.rows.map(mov => ({
          data: new Date(mov.created_at),
          causale: mov.reason || '',
          importo: mov.amount || 0
        }));

        if (transactions.length > 0) {
          // Calcola frazionate e patterns
          const frazionateDep = cercaFrazionateDep(transactions);
          const frazionateWit = cercaFrazionateWit(transactions);
          const patterns = cercaPatternAML(transactions);
          
          // Calcola rischio
          const risk = await calculateRiskLevel(frazionateDep, frazionateWit, patterns, transactions);
          
          updates.push({
            account_id: accountId,
            risk_score: risk.score,
            risk_level: risk.level
          });
        } else {
          // Nessuna transazione = rischio basso
          updates.push({
            account_id: accountId,
            risk_score: 0,
            risk_level: 'Low'
          });
        }
      } catch (error) {
        console.error(`Error processing player ${accountId}:`, error);
        // Continua con il prossimo
      }
    }

    // Salva tutti i risultati nel database Supabase
    console.log(`Saving ${updates.length} risk scores to Supabase...`);
    
    let savedCount = 0;
    let errorCount = 0;
    
    for (const update of updates) {
      // Leggi lo status esistente per preservarlo
      const { data: existing } = await supabase
        .from('player_risk_scores')
        .select('status')
        .eq('account_id', update.account_id)
        .single();

      // Determina il nuovo status:
      // - Se lo status esistente è 'active' o null, imposta automaticamente in base al risk_level
      // - Se lo status esistente è manuale (reviewed, escalated, archived, high-risk, critical-risk), preservalo
      let newStatus = existing?.status || 'active';
      
      if (newStatus === 'active' || !newStatus) {
        // Imposta automaticamente lo status in base al risk_level calcolato
        if (update.risk_level === 'Elevato') {
          newStatus = 'critical-risk';
        } else if (update.risk_level === 'High') {
          newStatus = 'high-risk';
        } else {
          // Per Low e Medium, mantieni 'active'
          newStatus = 'active';
        }
      }
      // Se lo status è già manuale (reviewed, escalated, archived, high-risk, critical-risk), lo preserviamo

      const { error } = await supabase
        .from('player_risk_scores')
        .upsert({
          account_id: update.account_id,
          risk_score: update.risk_score,
          risk_level: update.risk_level,
          status: newStatus,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'account_id'
        });

      if (error) {
        console.error(`Error saving risk score for ${update.account_id}:`, error);
        errorCount++;
      } else {
        savedCount++;
      }
    }

    await pool.end();

    console.log(`Risk calculation completed: ${savedCount} saved, ${errorCount} errors`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        processed: updates.length,
        saved: savedCount,
        errors: errorCount,
        message: `Risk scores calculated and saved for ${savedCount} players`
      })
    };
  } catch (error) {
    console.error('Error in calculateRiskScores:', error);
    try {
      await pool.end();
    } catch (closeError) {
      console.error('Error closing pool:', closeError);
    }
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Failed to calculate risk scores',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler };
