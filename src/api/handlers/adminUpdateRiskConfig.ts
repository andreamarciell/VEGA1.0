import type { ApiHandler } from '../types';
import { createServiceClient } from './_supabaseAdmin';
import { requireAdmin } from './_adminGuard';

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

  // Use admin guard to verify admin session
  const adminCheck = await requireAdmin(event);
  if (!adminCheck.ok) {
    return { statusCode: 401, body: 'Admin authentication required' };
  }

  try {
    const service = createServiceClient();
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

    // Update or insert configuration
    const { data, error } = await service
      .from('risk_engine_config')
      .upsert({
        config_key: configKey,
        config_value: configValue,
        description: description || null,
        is_active: true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'config_key'
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating risk config:', error);
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
      body: JSON.stringify({ success: true, data })
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

export { handler };
