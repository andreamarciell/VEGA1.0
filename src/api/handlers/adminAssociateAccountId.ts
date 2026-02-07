import type { ApiHandler } from '../types';
import { createServiceClient } from './_supabaseAdmin';
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
    const service = createServiceClient();
    
    // Extract userId from path
    const pathMatch = event.path?.match(/\/profiles\/([^\/]+)\/account-id/);
    if (!pathMatch) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed || '',
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ error: 'Invalid path. Expected /admin/profiles/:userId/account-id' })
      };
    }
    
    const userId = pathMatch[1];
    
    if (event.httpMethod === 'DELETE') {
      // Remove account_id association
      const { error } = await service
        .from('profiles')
        .update({ account_id: null })
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error removing account_id association:', error);
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': allowed || '',
            'Access-Control-Allow-Credentials': 'true'
          },
          body: JSON.stringify({ error: 'Failed to remove account_id association' })
        };
      }
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed || '',
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ success: true, message: 'Account ID association removed' })
      };
    }
    
    // POST or PUT: Associate account_id
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed || '',
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ error: 'Missing body' })
      };
    }
    
    let payload: { account_id: string };
    try {
      payload = JSON.parse(event.body);
    } catch {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed || '',
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ error: 'Invalid JSON' })
      };
    }
    
    if (!payload.account_id || typeof payload.account_id !== 'string') {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed || '',
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ error: 'account_id is required and must be a string' })
      };
    }
    
    // Normalize account_id to string
    const accountId = String(payload.account_id).trim();
    
    // Update profile with account_id
    const { data, error } = await service
      .from('profiles')
      .update({ account_id: accountId })
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error) {
      console.error('Error associating account_id:', error);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': allowed || '',
          'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ error: 'Failed to associate account_id', details: error.message })
      };
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed || '',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ 
        success: true, 
        profile: data,
        message: `Account ID ${accountId} associated with user ${userId}` 
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
