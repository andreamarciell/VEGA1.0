import type { Handler } from '@netlify/functions';
import { createServiceClient } from './_supabaseAdmin';
import { requireAdmin } from './_adminGuard';

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Validate environment variables
  console.log('Environment check:', {
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    url: process.env.SUPABASE_URL ? 'present' : 'missing',
    keyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0
  });
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing required environment variables');
    return { 
      statusCode: 500, 
      body: JSON.stringify({ 
        error: 'Server configuration error',
        details: 'Missing Supabase configuration'
      })
    };
  }

  const origin = event.headers.origin || '';
  const allowed = process.env.ALLOWED_ORIGIN || '';
  if (allowed && origin && origin !== allowed) {
    return { statusCode: 403, body: 'Forbidden origin' };
  }

  // Use admin guard instead of JWT validation
  console.log('Checking admin authentication...');
  const adminCheck = await requireAdmin(event);
  console.log('Admin check result:', { ok: adminCheck.ok, adminId: adminCheck.adminId });
  
  if (!adminCheck.ok) {
    console.error('Admin authentication failed');
    return { statusCode: 401, body: 'Admin authentication required' };
  }

  if (!event.body) return { statusCode: 400, body: 'Missing body' };
  let payload: { email: string; password: string };
  try { payload = JSON.parse(event.body); } catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  // Validazione minima
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email);
  const passOk = typeof payload.password === 'string' && payload.password.length >= 8;
  if (!emailOk || !passOk) {
    return { statusCode: 400, body: 'Invalid email or password' };
  }

  console.log('Creating Supabase service client...');
  const service = createServiceClient();
  
  // Test if service client is working
  try {
    console.log('Testing service client...');
    const { data: testData, error: testError } = await service.from('admin_users').select('count').limit(1);
    console.log('Service client test:', { hasError: !!testError, error: testError?.message });
  } catch (testErr) {
    console.error('Service client test failed:', testErr);
  }
  
  console.log('Attempting to create user:', { email: payload.email });
  const { data, error } = await service.auth.admin.createUser({
    email: payload.email,
    password: payload.password,
    email_confirm: true
  });

  if (error) {
    console.error('Supabase error creating user:', error);
    return { 
      statusCode: 500, 
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': allowed || '',
        'Access-Control-Allow-Credentials': 'true'
      },
      body: JSON.stringify({ 
        error: 'Database error creating new user',
        details: error.message,
        code: error.status || 'UNKNOWN'
      })
    };
  }
  
  return { 
    statusCode: 200, 
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowed || '',
      'Access-Control-Allow-Credentials': 'true'
    },
    body: JSON.stringify({ userId: data.user?.id }) 
  };
};

export { handler };
