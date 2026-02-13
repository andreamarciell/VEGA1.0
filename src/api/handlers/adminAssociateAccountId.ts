import type { ApiHandler } from '../types';
import { requireAdmin } from './_adminGuard';

/**
 * Admin endpoint to associate account_id with user_id in profiles table
 * POST /api/v1/admin/profiles/:userId/account-id
 * Body: { account_id: string }
 */
export const handler: ApiHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { 
      statusCode: 204, 
      headers: { 
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '', 
        'Access-Control-Allow-Headers': 'content-type', 
        'Access-Control-Allow-Methods': 'POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
        'Vary': 'Origin' 
      }, 
      body: '' 
    };
  }
  
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'PUT' && event.httpMethod !== 'DELETE') {
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
    // NOTA: Dopo la migrazione da Supabase, questo endpoint deve essere reimplementato
    // usando il database tenant per associare account_id agli utenti
    return {
      statusCode: 501,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed || '',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ 
        error: 'Not Implemented',
        message: 'Account ID association needs to be reimplemented using tenant database after Supabase migration.'
      })
    };
  } catch (error) {
    console.error('Unexpected error in adminAssociateAccountId:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed || '',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
