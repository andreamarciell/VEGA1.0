import type { ApiHandler } from '../types';
import { queryBigQuery } from './_bigqueryClient';
interface PlayerRiskScoreRow {
  account_id: string;
  risk_score: number;
  risk_level: string;
  updated_at: Date | null;
  status: string;
}

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

export const handler: ApiHandler = async (event) => {
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
    // Verifica che il middleware abbia iniettato auth e dbPool
    if (!event.auth || !event.dbPool) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({
          error: 'Unauthorized',
          message: 'Tenant authentication required'
        })
      };
    }

    const orgId = event.auth.orgId;
    const dbName = event.auth.dbName;
    const datasetId = event.auth.bqDatasetId;
    console.log(`Step 0: User orgId: ${orgId}, dbName: ${dbName}, bqDatasetId: ${datasetId}`);

    if (!datasetId) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({
          error: 'Configuration error',
          message: 'BigQuery dataset ID not configured for this tenant'
        })
      };
    }

    // Query standard: SELECT su player_risk_scores + profili BigQuery. Nessun ricalcolo (batch al salvataggio config).
    // Query profiles from BigQuery using tenant-specific dataset
    console.log('Step 1: Fetching profiles from BigQuery...');
    const profiles = await queryBigQuery<Profile>(
      `SELECT 
        account_id, nick, first_name, last_name, cf, domain, 
        point, current_balance, created_at
      FROM \`${datasetId}.Profiles\`
      ORDER BY account_id ASC
      LIMIT 1000`,
      {},
      datasetId
    );
    console.log(`Step 1: Found ${profiles.length} profiles from BigQuery for orgId ${orgId}`);
    
    // Log alcuni account_id per debug
    if (profiles.length > 0) {
      const sampleAccountIds = profiles.slice(0, 5).map(p => ({
        id: p.account_id,
        type: typeof p.account_id,
        stringified: String(p.account_id),
        trimmed: String(p.account_id).trim()
      }));
      console.log(`Step 1: Sample account_ids:`, JSON.stringify(sampleAccountIds, null, 2));
    }

    // Deduplica per account_id (nel caso ci siano duplicati in BigQuery)
    const uniqueProfilesMap = new Map<string, Profile>();
    const duplicateIds = new Set<string>();
    profiles.forEach(profile => {
      // Normalizza account_id a stringa e rimuovi spazi per garantire matching corretto
      const accountIdKey = String(profile.account_id).trim();
      if (!uniqueProfilesMap.has(accountIdKey)) {
        uniqueProfilesMap.set(accountIdKey, profile);
      } else {
        duplicateIds.add(accountIdKey);
      }
    });
    const uniqueProfiles = Array.from(uniqueProfilesMap.values());
    
    // Logga un riepilogo dei duplicati invece di un warning per ognuno
    if (duplicateIds.size > 0) {
      console.warn(`Step 1.5: Found ${duplicateIds.size} duplicate account_ids in BigQuery: ${Array.from(duplicateIds).slice(0, 10).join(', ')}${duplicateIds.size > 10 ? '...' : ''}`);
    }
    
    console.log(`Step 1.5: Deduplicated to ${uniqueProfiles.length} unique profiles (${profiles.length} total from BigQuery)`);

    // Leggi i risk scores pre-calcolati dal database tenant (current scores)
    console.log('Step 2: Fetching pre-calculated risk scores from tenant database...');
    
    if (!event.dbPool) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ error: 'Database pool not available' })
      };
    }

    let riskScoresMap = new Map<string, { score: number; level: string; status?: string }>();
    
    try {
      const riskScoresResult = await event.dbPool.query<PlayerRiskScoreRow>(
        'SELECT account_id, risk_score, risk_level, updated_at, status FROM player_risk_scores'
      );

      console.log(`Step 2: Successfully fetched ${riskScoresResult.rows.length} risk scores from tenant database`);
      // Log alcuni account_id per verificare il formato
      if (riskScoresResult.rows.length > 0) {
        const sampleIds = riskScoresResult.rows.slice(0, 5).map(r => {
          const id = r.account_id;
          return `${id} (type: ${typeof id})`;
        });
        console.log(`Step 2: Sample account_ids found: ${sampleIds.join(', ')}`);
      }
      
      riskScoresResult.rows.forEach(rs => {
        // Normalizza account_id a stringa per garantire matching corretto
        const accountIdKey = String(rs.account_id).trim();
        riskScoresMap.set(accountIdKey, {
          score: rs.risk_score,
          level: rs.risk_level,
          status: rs.status || 'active'
        });
      });
      console.log(`Step 2: Mapped ${riskScoresMap.size} risk scores to Map`);
      
      // Log di debug per verificare il matching
      if (riskScoresMap.size > 0 && uniqueProfiles.length > 0) {
        const sampleProfileId = String(uniqueProfiles[0].account_id).trim();
        const found = riskScoresMap.has(sampleProfileId);
        console.log(`Step 2: Sample matching test - Profile ID "${sampleProfileId}": ${found ? 'FOUND' : 'NOT FOUND'} in risk scores map`);
      }
    } catch (riskError) {
      console.warn('Step 2: Error fetching risk scores:', riskError);
    }

    const players: PlayerRisk[] = [];

    // Unione profili BigQuery + risk_scores dal DB. Solo lettura; nessun ricalcolo (batch post-config).
    console.log(`Step 3: Merging ${uniqueProfiles.length} profiles with risk scores...`);
    for (const profile of uniqueProfiles) {
      const accountId = String(profile.account_id).trim();
      const cachedRisk = riskScoresMap.get(accountId);
      if (cachedRisk) {
        players.push({
          account_id: accountId,
          nick: profile.nick,
          first_name: profile.first_name,
          last_name: profile.last_name,
          domain: profile.domain,
          current_balance: profile.current_balance,
          risk_score: cachedRisk.score,
          risk_level: cachedRisk.level as 'Low' | 'Medium' | 'High' | 'Elevato',
          status: (cachedRisk.status || 'active') as PlayerRisk['status']
        });
      } else {
        // Nessun risk score in DB (es. nuovo giocatore): default Low/active, senza scrittura
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

    // Deduplicazione finale per sicurezza (nel caso qualche duplicato sia sfuggito)
    const finalPlayersMap = new Map<string, PlayerRisk>();
    const finalDuplicateIds = new Set<string>();
    players.forEach(player => {
      const accountIdKey = String(player.account_id).trim();
      if (!finalPlayersMap.has(accountIdKey)) {
        finalPlayersMap.set(accountIdKey, player);
      } else {
        finalDuplicateIds.add(accountIdKey);
      }
    });
    const finalPlayers = Array.from(finalPlayersMap.values());
    
    if (finalDuplicateIds.size > 0) {
      console.warn(`Step 4.5: Found ${finalDuplicateIds.size} duplicate players in final array: ${Array.from(finalDuplicateIds).slice(0, 10).join(', ')}${finalDuplicateIds.size > 10 ? '...' : ''}`);
    }
    console.log(`Step 4.5: Final deduplicated players: ${finalPlayers.length} (was ${players.length})`);

    console.log('Step 5: Returning results...');
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ players: finalPlayers })
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

