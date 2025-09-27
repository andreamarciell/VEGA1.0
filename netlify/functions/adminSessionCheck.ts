import type { Handler } from '@netlify/functions';
import { requireAdmin } from './_adminGuard';

const handler: Handler = async (event) => {
  console.log('AdminSessionCheck called:', {
    method: event.httpMethod,
    origin: event.headers.origin,
    allowedOrigin: process.env.ALLOWED_ORIGIN,
    hasOriginHeader: !!event.headers.origin,
    hasCookie: !!event.headers.cookie
  });

  if (event.httpMethod === 'OPTIONS') {
    return { 
      statusCode: 204, 
      headers: { 
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*', 
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
  
  // Temporary: Be more permissive with CORS for debugging
  if (allowed && origin && origin !== allowed) {
    console.log('CORS blocked:', { origin, allowed });
    return { 
      statusCode: 403, 
      body: `Forbidden origin. Got: ${origin}, Expected: ${allowed}`,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': allowed || '*'
      }
    };
  }

  // Use admin guard to verify admin session from HttpOnly cookie
  const adminCheck = await requireAdmin(event);
  
  if (!adminCheck.ok) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed || '',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ authenticated: false })
    };
  }

  // Return admin info if authenticated
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowed || '',
      'Access-Control-Allow-Credentials': 'true'
    },
    body: JSON.stringify({ 
      authenticated: true,
      admin: {
        id: adminCheck.adminId,
        nickname: adminCheck.nickname
      }
    })
  };
};

export { handler };
