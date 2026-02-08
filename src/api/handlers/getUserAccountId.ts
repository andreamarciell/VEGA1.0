import type { ApiHandler } from '../types';
import { createServiceClient } from './_supabaseAdmin';
import { createClient } from '@supabase/supabase-js';
import { getUserTenantCode, validateAccountIdBelongsToTenant } from './_tenantHelper.js';

/**
 * Helper endpoint to get account_id from user's profile
 * Useful when user is logged in and wants to access their own data
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

  try {
    // Estrai token di autenticazione da cookie o header Authorization
    const cookie = event.headers.cookie || '';
    const authHeader = event.headers.authorization || event.headers['Authorization'] || '';
    
    // Crea client Supabase per verificare la sessione
    const supabaseClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
      {
        global: {
          headers: cookie ? { Cookie: cookie } : authHeader ? { Authorization: authHeader } : {}
        }
      }
    );

    // Verifica sessione utente
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return {
        statusCode: 401,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ 
          error: 'Unauthorized',
          message: 'Valid user session required'
        })
      };
    }

    // Recupera account_id dal profilo
    const supabase = createServiceClient();
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('account_id, username, tenant_code')
      .eq('user_id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ 
          error: 'Failed to fetch profile',
          message: profileError.message
        })
      };
    }

    if (!profile?.account_id) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed,
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ 
          error: 'Account ID not found',
          message: 'Your profile does not have an account_id associated. Please contact support to link your gaming account.'
        })
      };
    }

    // Verifica che l'account_id appartenga al tenant_code dell'utente
    if (profile.tenant_code) {
      const validation = await validateAccountIdBelongsToTenant(profile.account_id, profile.tenant_code);
      if (!validation.valid) {
        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': allowed,
            'Access-Control-Allow-Credentials': 'true'
          },
          body: JSON.stringify({ 
            error: 'Forbidden',
            message: validation.error || 'Your account_id does not belong to your tenant'
          })
        };
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({
        account_id: String(profile.account_id).trim(),
        username: profile.username
      })
    };
  } catch (error) {
    console.error('Error in getUserAccountId:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed,
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
