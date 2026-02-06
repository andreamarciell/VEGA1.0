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
    console.log(`Step 1: Found ${profiles.length} profiles from BigQuery`);

    // Deduplica per account_id (nel caso ci siano duplicati in BigQuery)
    const uniqueProfilesMap = new Map<string, Profile>();
    const duplicateIds = new Set<string>();
    profiles.forEach(profile => {
      if (!uniqueProfilesMap.has(profile.account_id)) {
        uniqueProfilesMap.set(profile.account_id, profile);
      } else {
        duplicateIds.add(profile.account_id);
      }
    });
    const uniqueProfiles = Array.from(uniqueProfilesMap.values());
    
    // Logga un riepilogo dei duplicati invece di un warning per ognuno
    if (duplicateIds.size > 0) {
      console.warn(`Step 1.5: Found ${duplicateIds.size} duplicate account_ids in BigQuery: ${Array.from(duplicateIds).slice(0, 10).join(', ')}${duplicateIds.size > 10 ? '...' : ''}`);
    }
    
    console.log(`Step 1.5: Deduplicated to ${uniqueProfiles.length} unique profiles (${profiles.length} total from BigQuery)`);

    // Leggi i risk scores pre-calcolati dal database Supabase (current scores)
    console.log('Step 2: Fetching pre-calculated risk scores from Supabase...');
    const supabase = createServiceClient();
    const { data: riskScores, error: riskError } = await supabase
      .from('player_risk_scores')
      .select('account_id, risk_score, risk_level, calculated_at, status');

    // Log dettagliato per debugging
    if (riskError) {
      console.error('Step 2: ERROR fetching risk scores:', riskError);
      console.error('Error code:', riskError.code);
      console.error('Error message:', riskError.message);
      console.error('Error details:', JSON.stringify(riskError, null, 2));
    }

    const riskScoresMap = new Map<string, { score: number; level: string; status?: string }>();
    if (!riskError && riskScores) {
      console.log(`Step 2: Successfully fetched ${riskScores.length} risk scores from Supabase`);
      // Log alcuni account_id per verificare il formato
      if (riskScores.length > 0) {
        const sampleIds = riskScores.slice(0, 5).map(r => {
          const id = r.account_id;
          return `${id} (type: ${typeof id})`;
        });
        console.log(`Step 2: Sample account_ids found: ${sampleIds.join(', ')}`);
      }
      
      riskScores.forEach(rs => {
        // Normalizza account_id a stringa per garantire matching corretto
        const accountIdKey = String(rs.account_id);
        riskScoresMap.set(accountIdKey, {
          score: rs.risk_score,
          level: rs.risk_level,
          status: rs.status || 'active'
        });
      });
      console.log(`Step 2: Mapped ${riskScoresMap.size} risk scores to Map`);
    } else if (riskError) {
      console.warn('Step 2: Error fetching risk scores, will calculate on demand:', riskError);
    } else {
      console.log('Step 2: No pre-calculated risk scores found, will calculate on demand');
    }

    const players: PlayerRisk[] = [];

    // Per ogni giocatore, usa il risk score pre-calcolato o calcolalo se non disponibile
    console.log(`Step 3: Processing ${uniqueProfiles.length} players...`);
    for (let i = 0; i < uniqueProfiles.length; i++) {
      const profile = uniqueProfiles[i];
      const accountId = profile.account_id;
      
      try {
        console.log(`Step 3.${i + 1}: Processing player ${accountId} (${i + 1}/${uniqueProfiles.length})...`);

        // Verifica se esiste un risk score pre-calcolato
        // Normalizza accountId a stringa per garantire matching corretto
        const accountIdKey = String(accountId);
        const cachedRisk = riskScoresMap.get(accountIdKey);
        
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
          // Log diagnostico per capire perché non viene trovato
          if (i === 0 || i < 3) {
            console.log(`Step 3.${i + 1}: Risk scores map has ${riskScoresMap.size} entries`);
            const sampleKeys = Array.from(riskScoresMap.keys()).slice(0, 5);
            console.log(`Step 3.${i + 1}: Sample account_ids in map: ${sampleKeys.join(', ')}`);
            console.log(`Step 3.${i + 1}: Looking for account_id: "${accountId}" (type: ${typeof accountId}, normalized: "${accountIdKey}")`);
            
            // Verifica se esiste con altri formati
            const asNumber = Number(accountId);
            if (!isNaN(asNumber)) {
              const foundAsNumber = riskScoresMap.get(String(asNumber));
              const foundAsString = riskScoresMap.get(accountId);
              console.log(`Step 3.${i + 1}: Check as number "${asNumber}": ${foundAsNumber ? 'FOUND' : 'NOT FOUND'}`);
              console.log(`Step 3.${i + 1}: Check as string "${accountId}": ${foundAsString ? 'FOUND' : 'NOT FOUND'}`);
            }
          }
          
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

            // Salva il risk score calcolato nel database per evitare ricalcoli futuri
            const now = new Date();
            // Normalizza account_id a stringa per garantire consistenza
            const accountIdForSave = String(accountId);
            const { error: saveError } = await supabase
              .from('player_risk_scores')
              .upsert({
                account_id: accountIdForSave,
                risk_score: risk.score,
                risk_level: risk.level,
                status: 'active',
                calculated_at: now.toISOString(),
                updated_at: now.toISOString()
              }, {
                onConflict: 'account_id'
              });

            if (saveError) {
              console.warn(`Step 3.${i + 1}.d.5: Failed to save risk score for ${accountId}:`, saveError);
            } else {
              console.log(`Step 3.${i + 1}.d.5: Risk score saved for ${accountId}`);
            }

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
            
            // Salva anche il risk score Low nel database
            const now = new Date();
            // Normalizza account_id a stringa per garantire consistenza
            const accountIdForSave = String(accountId);
            const { error: saveError } = await supabase
              .from('player_risk_scores')
              .upsert({
                account_id: accountIdForSave,
                risk_score: 0,
                risk_level: 'Low',
                status: 'active',
                calculated_at: now.toISOString(),
                updated_at: now.toISOString()
              }, {
                onConflict: 'account_id'
              });

            if (saveError) {
              console.warn(`Step 3.${i + 1}.d.5: Failed to save risk score for ${accountId}:`, saveError);
            } else {
              console.log(`Step 3.${i + 1}.d.5: Risk score (Low) saved for ${accountId}`);
            }

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
