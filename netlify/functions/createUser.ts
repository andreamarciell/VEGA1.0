import type { Handler } from '@netlify/functions';
import { createServiceClient } from './_supabaseAdmin';
import { createClient } from '@supabase/supabase-js';

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const origin = event.headers.origin || '';
  const allowed = process.env.ALLOWED_ORIGIN || '';
  if (allowed && origin !== allowed) {
    return { statusCode: 403, body: 'Forbidden origin' };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { statusCode: 401, body: 'Missing token' };
  }

  const anonClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
  const { data: userData, error: userErr } = await anonClient.auth.getUser(authHeader.replace('Bearer ',''));
  if (userErr || !userData?.user) {
    return { statusCode: 401, body: 'Invalid token' };
  }

  // Controlla ruolo admin nel JWT/metadati
  const isAdmin =
    (userData.user.app_metadata?.role === 'admin') ||
    (userData.user.user_metadata?.role === 'admin');

  if (!isAdmin) {
    return { statusCode: 403, body: 'Forbidden' };
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

  const service = createServiceClient();
  const { data, error } = await service.auth.admin.createUser({
    email: payload.email,
    password: payload.password,
    email_confirm: true
  });

  if (error) return { statusCode: 500, body: error.message };
  return { statusCode: 200, body: JSON.stringify({ userId: data.user?.id }) };
};

export { handler };
