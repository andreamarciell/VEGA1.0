import type { ApiHandler } from '../types';

/**
 * Helper endpoint to get account_id from user's profile
 * NOTA: Questo endpoint è stato disabilitato dopo la migrazione da Supabase a Clerk.
 * Con Clerk, la gestione dei profili utente deve essere implementata diversamente.
 * Per ora, questo endpoint restituisce un errore informativo.
 */
export const handler: ApiHandler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
        'Access-Control-Allow-Headers': 'content-type,authorization',
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

  return {
    statusCode: 501,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowed,
      'Access-Control-Allow-Credentials': 'true'
    },
    body: JSON.stringify({ 
      error: 'Not Implemented',
      message: 'This endpoint has been disabled after migration from Supabase to Clerk. User profile management needs to be reimplemented using Clerk and tenant database.'
    })
  };
};
