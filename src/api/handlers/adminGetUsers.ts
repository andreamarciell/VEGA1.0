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
    
    // Use the same logic as the original admin_get_profiles function
    const { data, error } = await service.rpc('admin_get_profiles');
    
    if (error) {
      console.error('Error fetching user profiles:', error);
      return { statusCode: 500, body: 'Failed to fetch users' };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed || '',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify(data || [])
    };
  } catch (error) {
    console.error('Unexpected error in adminGetUsers:', error);
    return { statusCode: 500, body: 'Internal server error' };
  }
};

export { handler };
