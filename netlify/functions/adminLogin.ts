import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const SEC = Number(process.env.ADMIN_SESSION_TTL_SEC || 60 * 60 * 8); // 8h
const COOKIE = 'admin_session';

function setCookie(token: string) {
  const attrs = [
    `${COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    `Max-Age=${SEC}`
  ].join('; ');
  return attrs;
}

const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '', 'Access-Control-Allow-Headers': 'content-type,authorization', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Vary': 'Origin' }, body: '' };
  }
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const origin = event.headers.origin || '';
  const allowed = process.env.ALLOWED_ORIGIN || '';
  if (allowed && origin !== allowed) return { statusCode: 403, body: 'Forbidden origin' };

  if (!event.body) return { statusCode: 400, body: 'Missing body' };
  let payload: { email?: string; password?: string };
  try { payload = JSON.parse(event.body); } catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const email = payload.email?.trim() || '';
  const password = payload.password || '';
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk || password.length < 8) return { statusCode: 400, body: 'Invalid credentials' };

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
  const { data: signIn, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !signIn?.user) return { statusCode: 401, body: 'Invalid credentials' };

  const role = (signIn.user.app_metadata as any)?.role || (signIn.user.user_metadata as any)?.role;
  if (role !== 'admin') return { statusCode: 403, body: 'Not an admin' };

  // Crea token sessione admin e salva lato DB (usa tabella esistente)
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + SEC * 1000).toISOString();

  // Inserisci su admin_sessions via service role
  const service = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { error: insErr } = await service.from('admin_sessions').insert({
    user_id: signIn.user.id,
    token_hash: tokenHash,
    expires_at: expiresAt
  });
  if (insErr) return { statusCode: 500, body: 'Session error' };

  return {
    statusCode: 200,
    headers: {
      'Set-Cookie': setCookie(token),
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowed || ''
    },
    body: JSON.stringify({ ok: true })
  };
};

export { handler };
