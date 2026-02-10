import type { ApiHandler } from '../types';

interface RiskConfigRow {
  config_key: string;
  config_value: any; // JSONB
  description: string | null;
  is_active: boolean;
}

export const handler: ApiHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { 
      statusCode: 204, 
      headers: { 
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '', 
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
  const allowed = process.env.ALLOWED_ORIGIN || '';
  if (allowed && origin && origin !== allowed) {
    return { statusCode: 403, body: 'Forbidden origin' };
  }

  // Verify authentication (middleware should have injected auth)
  if (!event.auth || !event.dbPool) {
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed || '',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ error: 'Authentication required' })
    };
  }

  try {
    const result = await event.dbPool.query<RiskConfigRow>(
      `SELECT config_key, config_value, description, is_active 
       FROM risk_engine_config 
       WHERE is_active = $1 
       ORDER BY config_key`,
      [true]
    );

    // Transform data to object format
    const config: Record<string, any> = {};
    result.rows.forEach(row => {
      config[row.config_key] = {
        value: row.config_value,
        description: row.description,
        is_active: row.is_active
      };
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed || '',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify(config)
    };
  } catch (error: any) {
    console.error('Unexpected error in adminGetRiskConfig:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed || '',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ error: 'Internal server error', message: error.message })
    };
  }
};

