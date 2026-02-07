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

  // Use admin guard to verify admin session
  const adminCheck = await requireAdmin(event);
  if (!adminCheck.ok) {
    return { statusCode: 401, body: 'Admin authentication required' };
  }

  try {
    const service = createServiceClient();
    
    const { data, error } = await service
      .from('risk_engine_config')
      .select('config_key, config_value, description, is_active')
      .eq('is_active', true)
      .order('config_key');
    
    if (error) {
      console.error('Error fetching risk config:', error);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed || '',
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ error: 'Failed to fetch configuration' })
      };
    }

    // Transform data to object format
    const config: Record<string, any> = {};
    data?.forEach(row => {
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

export { handler };
