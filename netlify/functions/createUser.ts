import type { Handler } from '@netlify/functions';
import { createServiceClient } from './_supabaseAdmin';
import { requireAdmin } from './_adminGuard';

const handler: Handler = async (event) => {
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
