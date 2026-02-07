import type { ApiHandler } from '../types';
import { queryBigQuery, parseBigQueryDate } from './_bigqueryClient';

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

  // Estrai account_id dai query params
  const accountId = event.queryStringParameters?.account_id;
  if (!accountId) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ error: 'account_id parameter is required' })
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

    // Query profile per account_id da BigQuery
    // Usa CAST per assicurarsi che il matching funzioni correttamente con INT64
    const profiles = await queryBigQuery<Profile>(
      `SELECT 
        CAST(account_id AS STRING) as account_id, 
        nick, 
        first_name, 
        last_name
      FROM \`toppery_test.Profiles\`
      WHERE account_id = @account_id`,
      { account_id: accountIdNum }
    );

    const profile = profiles[0] || null;

    // Query movements per account_id da BigQuery
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
      FROM \`toppery_test.Movements\`
      WHERE account_id = @account_id
      ORDER BY created_at ASC`,
      { account_id: accountIdNum }
    );

    // Query sessions per account_id da BigQuery
    const sessions = await queryBigQuery<SessionLog>(
      `SELECT 
        CAST(id AS STRING) as id,
        CAST(account_id AS STRING) as account_id, 
        ip_address, 
        login_time, 
        logout_time, 
        platform
      FROM \`toppery_test.Sessions\`
      WHERE account_id = @account_id
      ORDER BY login_time DESC`,
      { account_id: accountIdNum }
    );

    // Log per debug (rimuovere in produzione se necessario)
    console.log(`[syncFromDatabase] Query for account_id ${accountIdNum}: found ${profiles.length} profiles, ${movements.length} movements, ${sessions.length} sessions`);

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
