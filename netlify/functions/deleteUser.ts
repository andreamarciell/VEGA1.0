import type { Handler } from '@netlify/functions';
import { createServiceClient } from './_supabaseAdmin';
import { requireAdmin } from './_adminGuard';

const handler: Handler = async (event) => {
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

  // Use admin guard instead of JWT validation
  const adminCheck = await requireAdmin(event);
  if (!adminCheck.ok) {
    return { statusCode: 401, body: 'Admin authentication required' };
  }

  if (!event.body) return { statusCode: 400, body: 'Missing body' };
  let payload: { userId: string };
  try { payload = JSON.parse(event.body); } catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  // Validate userId
  if (!payload.userId || typeof payload.userId !== 'string') {
    return { statusCode: 400, body: 'Invalid userId' };
  }

  try {
    const service = createServiceClient();
    
    // Delete user from auth.users (this will cascade to profiles via FK)
    const { error } = await service.auth.admin.deleteUser(payload.userId);
    
    if (error) {
      console.error('Error deleting user:', error);
      return { statusCode: 500, body: error.message };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed || '',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ success: true, message: 'User deleted successfully' })
    };
  } catch (error) {
    console.error('Unexpected error in deleteUser:', error);
    return { statusCode: 500, body: 'Internal server error' };
  }
};

export { handler };
