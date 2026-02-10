import type { ApiHandler } from '../types';

interface RiskConfigRow {
  id: string;
  config_key: string;
  config_value: any; // JSONB
  description: string | null;
  is_active: boolean;
  updated_at: Date;
}

export const handler: ApiHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { 
      statusCode: 204, 
      headers: { 
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '', 
        'Access-Control-Allow-Headers': 'content-type', 
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
        'Vary': 'Origin' 
      }, 
      body: '' 
    };
  }
  
  if (event.httpMethod !== 'POST') {
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
    const body = JSON.parse(event.body || '{}');
    const { configKey, configValue, description } = body;

    if (!configKey || !configValue) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed || '',
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ error: 'configKey and configValue are required' })
      };
    }

    // Validate configKey
    const validKeys = ['volume_thresholds', 'risk_motivations', 'risk_levels'];
    if (!validKeys.includes(configKey)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed || '',
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ error: 'Invalid configKey' })
      };
    }

    // Upsert configuration using ON CONFLICT
    const result = await event.dbPool.query<RiskConfigRow>(
      `INSERT INTO risk_engine_config (config_key, config_value, description, is_active, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (config_key) 
       DO UPDATE SET 
         config_value = EXCLUDED.config_value,
         description = EXCLUDED.description,
         is_active = EXCLUDED.is_active,
         updated_at = EXCLUDED.updated_at
       RETURNING id, config_key, config_value, description, is_active, updated_at`,
      [configKey, JSON.stringify(configValue), description || null, true]
    );

    if (result.rows.length === 0) {
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed || '',
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ error: 'Failed to update configuration' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed || '',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ success: true, data: result.rows[0] })
    };
  } catch (error: any) {
    console.error('Unexpected error in adminUpdateRiskConfig:', error);
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

