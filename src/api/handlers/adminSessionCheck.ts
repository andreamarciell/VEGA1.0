import type { ApiHandler } from '../types';

/**
 * Admin session check handler - DISABLED after Supabase migration
 * The admin panel (/control) has been disabled. This endpoint returns 501 Not Implemented.
 */
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

  const origin = event.headers.origin || '';
  const allowed = process.env.ALLOWED_ORIGIN || '';
  
  return {
    statusCode: 501,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowed || '',
      'Access-Control-Allow-Credentials': 'true'
    },
    body: JSON.stringify({
      error: 'Not Implemented',
      message: 'Admin session check has been disabled after Supabase migration. The /control panel is no longer available.',
      authenticated: false
    })
  };
};

