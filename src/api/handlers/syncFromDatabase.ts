import type { ApiHandler } from '../types';
import { queryBigQuery, parseBigQueryDate } from './_bigqueryClient';
import { createServiceClient } from './_supabaseAdmin';
import { getUserTenantCode, validateAccountIdBelongsToTenant } from './_tenantHelper.js';

interface Movement {
  id: string;
  created_at: string;
  account_id: string;
  reason: string;
  amount: number;
  ts_extension: string | null;
  deposit_domain: string | null;
  withdrawal_mode: string | null;
  balance_after: number | null;
}

interface SessionLog {
  id: string;
  account_id: string;
  ip_address: string;
  login_time: string;
  logout_time: string | null;
  platform: string | null;
}

interface Transaction {
  data: Date;
  dataStr: string;
  causale: string;
  importo: number;
  importo_raw: any;
  TSN?: string;
  "TS extension"?: string;
}

interface AccessResult {
  ip: string;
  date: string;
  isp?: string;
  country?: string;
}

interface Profile {
  account_id: string;
  nick: string;
  first_name: string;
  last_name: string;
  // Nota: risk_level e risk_score non esistono nella tabella profiles
  // Vengono calcolati dinamicamente in getPlayersList
}

export const handler: ApiHandler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'content-type',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
        'Vary': 'Origin'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const origin = event.headers.origin || '';
  const allowed = process.env.ALLOWED_ORIGIN || '*';

  // Estrai account_id dai query params OPPURE dal profilo dell'utente loggato
  let accountId = event.queryStringParameters?.account_id;
  
  // Se account_id non è nei query params, prova a recuperarlo dal profilo dell'utente loggato
  if (!accountId) {
    try {
      const supabase = createServiceClient();
      
      // Prova a recuperare account_id dalla sessione utente
      // Verifica se c'è un cookie di sessione Supabase o header Authorization
      const cookie = event.headers.cookie || '';
      const authHeader = event.headers.authorization || event.headers['Authorization'] || '';
      
      if (cookie || authHeader) {
        // Crea client Supabase per verificare la sessione
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseClient = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_ANON_KEY!,
          {
            global: {
              headers: cookie ? { Cookie: cookie } : authHeader ? { Authorization: authHeader } : {}
            }
          }
        );

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

        if (!userError && user) {
          // Recupera account_id dal profilo
          const { data: profile } = await supabase
            .from('profiles')
            .select('account_id')
            .eq('user_id', user.id)
            .single();

          if (profile?.account_id) {
            accountId = profile.account_id;
            console.log(`[syncFromDatabase] Retrieved account_id ${accountId} from user profile for user ${user.id}`);
          }
        }
      }
    } catch (error) {
      // Se fallisce il recupero automatico, continua e richiederà account_id come param
      console.log('[syncFromDatabase] Could not retrieve account_id from session:', error);
    }
  }
  
  if (!accountId) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ 
        error: 'account_id parameter is required',
        message: 'Provide account_id as query parameter (?account_id=123) or ensure your user profile has account_id set in profiles table'
      })
    };
  }

  // Valida account_id (solo numeri o stringhe alfanumeriche)
  if (!/^[a-zA-Z0-9_-]+$/.test(accountId)) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ error: 'Invalid account_id format' })
    };
  }

  try {
    // Recupera tenant_code dell'utente loggato
    const tenantResult = await getUserTenantCode(event);
    if (tenantResult.error || !tenantResult.tenantCode) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({
          error: 'Unauthorized',
          message: tenantResult.error || 'User does not have a tenant_code assigned'
        })
      };
    }

    const userTenantCode = tenantResult.tenantCode;

    // Verifica che l'account_id appartenga al tenant_code dell'utente
    const validation = await validateAccountIdBelongsToTenant(accountId, userTenantCode);
    if (!validation.valid) {
      return {
        statusCode: 403,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({
          error: 'Forbidden',
          message: validation.error || 'You do not have access to this account_id'
        })
      };
    }

    // Converti account_id a numero per il matching corretto (account_id è INT64 in BigQuery)
    const accountIdNum = parseInt(accountId, 10);
    if (isNaN(accountIdNum)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ error: 'account_id must be a valid number' })
      };
    }

    // Recupera il dataset_id per questo account_id dal mapping
    const supabase = createServiceClient();
    const { data: mapping, error: mappingError } = await supabase
      .from('account_dataset_mapping')
      .select('dataset_id')
      .eq('account_id', accountId)
      .single();

    // Se non trova il mapping, usa il default (retrocompatibilità)
    let datasetId = 'toppery_test';
    if (mapping?.dataset_id) {
      datasetId = mapping.dataset_id;
      console.log(`[syncFromDatabase] Found mapping for account_id ${accountId}: dataset = ${datasetId}`);
    } else {
      if (mappingError && mappingError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.warn(`[syncFromDatabase] Error querying mapping for account_id ${accountId}:`, mappingError);
      } else {
        console.log(`[syncFromDatabase] No mapping found for account_id ${accountId}, using default dataset 'toppery_test'`);
      }
    }

    // Query profile per account_id da BigQuery usando il dataset corretto
    // Usa CAST per assicurarsi che il matching funzioni correttamente con INT64
    const profiles = await queryBigQuery<Profile>(
      `SELECT 
        CAST(account_id AS STRING) as account_id, 
        nick, 
        first_name, 
        last_name
      FROM \`${datasetId}.Profiles\`
      WHERE account_id = @account_id`,
      { account_id: accountIdNum },
      datasetId
    );

    const profile = profiles[0] || null;

    // Query movements per account_id da BigQuery usando il dataset corretto
    // Legge tutti i campi necessari per il mapping corretto
    const movements = await queryBigQuery<Movement>(
      `SELECT 
        CAST(id AS STRING) as id,
        created_at, 
        CAST(account_id AS STRING) as account_id, 
        reason, 
        amount, 
        CAST(ts_extension AS STRING) as ts_extension, 
        deposit_domain, 
        withdrawal_mode, 
        balance_after
      FROM \`${datasetId}.Movements\`
      WHERE account_id = @account_id
      ORDER BY created_at ASC`,
      { account_id: accountIdNum },
      datasetId
    );

    // Query sessions per account_id da BigQuery usando il dataset corretto
    const sessions = await queryBigQuery<SessionLog>(
      `SELECT 
        CAST(id AS STRING) as id,
        CAST(account_id AS STRING) as account_id, 
        ip_address, 
        login_time, 
        logout_time, 
        platform
      FROM \`${datasetId}.Sessions\`
      WHERE account_id = @account_id
      ORDER BY login_time DESC`,
      { account_id: accountIdNum },
      datasetId
    );

    // Log per debug (rimuovere in produzione se necessario)
    console.log(`[syncFromDatabase] Query for account_id ${accountIdNum} in dataset ${datasetId}: found ${profiles.length} profiles, ${movements.length} movements, ${sessions.length} sessions`);

    // Mappa movements a Transaction[]
    // Assicurati che tutti i campi vengano mappati correttamente come nella logica precedente
    const transactions: Transaction[] = movements.map(mov => {
      const createdDate = parseBigQueryDate(mov.created_at);
      // Importo deve mantenere il segno originale (positivo per depositi, negativo per prelievi)
      const importo = mov.amount || 0;
      
      return {
        data: createdDate,
        dataStr: createdDate.toISOString(),
        causale: mov.reason || '',
        importo: importo, // Mantieni il valore originale con segno
        importo_raw: mov.amount, // Valore raw per riferimento
        ...(mov.ts_extension && {
          TSN: String(mov.ts_extension),
          "TS extension": String(mov.ts_extension)
        }),
        // Aggiungi campi per identificare depositi/prelievi
        deposit_domain: mov.deposit_domain || null,
        withdrawal_mode: mov.withdrawal_mode || null
      };
    });

    // Mappa sessions a AccessResult[]
    // Raggruppa per IP e conta sessioni
    const accessMap = new Map<string, AccessResult>();
    sessions.forEach(session => {
      const ip = session.ip_address;
      if (!ip) return;

      if (!accessMap.has(ip)) {
        const loginDate = parseBigQueryDate(session.login_time);
        accessMap.set(ip, {
          ip,
          date: loginDate.toISOString(),
          isp: undefined, // Sarà popolato dal frontend con geoLookup
          country: undefined // Sarà popolato dal frontend con geoLookup
        });
      }
    });

    const accessResults: AccessResult[] = Array.from(accessMap.values());

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        transactions,
        accessResults,
        accountId,
        profile: profile ? {
          account_id: profile.account_id,
          nick: profile.nick,
          first_name: profile.first_name,
          last_name: profile.last_name
        } : null
      })
    };
  } catch (error) {
    console.error('Error syncing from database:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ 
        error: 'Failed to sync from database',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
