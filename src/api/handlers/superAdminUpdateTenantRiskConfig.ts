import type { ApiHandler } from '../types';
import { getMasterPool, getTenantPool } from '../../lib/db.js';

export const handler: ApiHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'content-type, authorization',
        'Access-Control-Allow-Methods': 'PUT,OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
      },
    };
  }

  if (event.httpMethod !== 'PUT') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const allowed = process.env.ALLOWED_ORIGIN || '*';
  const tenantId = event.pathParameters?.tenantId;

  if (!tenantId) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ 
        error: 'Bad request',
        message: 'Tenant ID is required'
      })
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { configKey, configValue, description } = body;

    if (!configKey || configValue === undefined) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ 
          error: 'Bad request',
          message: 'configKey and configValue are required'
        })
      };
    }

    // Get tenant info from master database
    const masterPool = getMasterPool();
    const tenantResult = await masterPool.query(
      'SELECT id, db_name, display_name FROM tenants WHERE id = $1',
      [tenantId]
    );

    if (tenantResult.rows.length === 0) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ 
          error: 'Not found',
          message: 'Tenant not found'
        })
      };
    }

    const tenant = tenantResult.rows[0];
    const dbName = tenant.db_name;

    // Connect to tenant database and update risk config
    const tenantPool = getTenantPool(dbName);
    
    // Use UPSERT (INSERT ... ON CONFLICT UPDATE)
    const result = await tenantPool.query(
      `INSERT INTO risk_engine_config (config_key, config_value, description, is_active, updated_at)
       VALUES ($1, $2, $3, true, NOW())
       ON CONFLICT (config_key) 
       DO UPDATE SET 
         config_value = EXCLUDED.config_value,
         description = EXCLUDED.description,
         updated_at = NOW()
       RETURNING config_key, config_value, description, is_active, updated_at`,
      [configKey, JSON.stringify(configValue), description || null]
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        success: true,
        message: 'Risk configuration updated successfully',
        config: {
          config_key: result.rows[0].config_key,
          config_value: result.rows[0].config_value,
          description: result.rows[0].description,
          is_active: result.rows[0].is_active,
          updated_at: result.rows[0].updated_at
        }
      })
    };
  } catch (error: any) {
    console.error('Error updating tenant risk config:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message || 'Unknown error'
      })
    };
  }
};
