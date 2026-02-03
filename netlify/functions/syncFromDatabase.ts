import type { Handler } from '@netlify/functions';
import { Pool } from 'pg';

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

const handler: Handler = async (event) => {
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

  const connectionString = process.env.EXTERNAL_DB_CONNECTION_STRING;
  if (!connectionString) {
    console.error('EXTERNAL_DB_CONNECTION_STRING not configured');
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ error: 'Database connection not configured' })
    };
  }

  // Verifica che sslmode=require sia presente
  if (!connectionString.includes('sslmode=require')) {
    console.error('SSL mode not set to require');
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ error: 'SSL mode must be require' })
    };
  }

  // Configura SSL con certificato Supabase da variabile d'ambiente
  const caCert = process.env.SUPABASE_CA_CERT;
  if (!caCert) {
    console.error('SUPABASE_CA_CERT not configured');
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ error: 'Supabase CA certificate not configured' })
    };
  }

  const pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: true,
      ca: caCert
    }
  });

  try {
    // Query movements per account_id
    const movementsResult = await pool.query<Movement>(
      `SELECT 
        id, created_at, account_id, reason, amount, 
        ts_extension, deposit_domain, withdrawal_mode, balance_after
      FROM movements
      WHERE account_id = $1
      ORDER BY created_at ASC`,
      [accountId]
    );

    // Query sessions_log per account_id
    const sessionsResult = await pool.query<SessionLog>(
      `SELECT 
        id, account_id, ip_address, login_time, logout_time, platform
      FROM sessions_log
      WHERE account_id = $1
      ORDER BY login_time DESC`,
      [accountId]
    );

    // Mappa movements a Transaction[]
    const transactions: Transaction[] = movementsResult.rows.map(mov => {
      const createdDate = new Date(mov.created_at);
      return {
        data: createdDate,
        dataStr: createdDate.toISOString(),
        causale: mov.reason || '',
        importo: mov.amount || 0,
        importo_raw: mov.amount,
        ...(mov.ts_extension && {
          TSN: mov.ts_extension,
          "TS extension": mov.ts_extension
        })
      };
    });

    // Mappa sessions_log a AccessResult[]
    // Raggruppa per IP e conta sessioni
    const accessMap = new Map<string, AccessResult>();
    sessionsResult.rows.forEach(session => {
      const ip = session.ip_address;
      if (!ip) return;

      if (!accessMap.has(ip)) {
        accessMap.set(ip, {
          ip,
          date: new Date(session.login_time).toISOString(),
          isp: undefined, // Sarà popolato dal frontend con geoLookup
          country: undefined // Sarà popolato dal frontend con geoLookup
        });
      }
    });

    const accessResults: AccessResult[] = Array.from(accessMap.values());

    await pool.end();

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
        accountId
      })
    };
  } catch (error) {
    console.error('Error syncing from database:', error);
    await pool.end();
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

export { handler };
