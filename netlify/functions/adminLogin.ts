import type { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

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
  let payload: { nickname?: string; password?: string };
  try { payload = JSON.parse(event.body); } catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const nickname = payload.nickname?.trim() || '';
  const password = payload.password || '';
  const nicknameOk = /^[a-zA-Z0-9_-]{3,20}$/.test(nickname);
  if (!nicknameOk || password.length < 8) return { statusCode: 400, body: 'Invalid credentials' };

  // Use service role client to access admin_users table
  const service = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  // Get admin user from admin_users table using the secure RPC function
  const { data: adminData, error: adminError } = await service.rpc('admin_get_user_for_auth', {
    admin_nickname: nickname
  });

  if (adminError || !adminData?.found) {
    // Add delay to prevent timing attacks
    await new Promise(r => setTimeout(r, 300));
    return { statusCode: 401, body: 'Invalid credentials' };
  }

  // Verify password using bcrypt
  const isPasswordValid = await bcrypt.compare(password, adminData.password_hash);
  if (!isPasswordValid) {
    // Add delay to prevent timing attacks
    await new Promise(r => setTimeout(r, 300));
    return { statusCode: 401, body: 'Invalid credentials' };
  }

  // Create session token
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + SEC * 1000).toISOString();

  // Create admin session using the secure RPC function
  const { error: sessionError } = await service.rpc('admin_create_session', {
    admin_user_id: adminData.admin_id,
    session_token: tokenHash,
    expires_at: expiresAt
  });

  if (sessionError) {
    console.error('Failed to create admin session:', sessionError);
    return { statusCode: 500, body: 'Session error' };
  }

  // Update last login
  const { error: updateError } = await service.rpc('admin_update_last_login', {
    admin_user_id: adminData.admin_id
  });

  if (updateError) {
    console.warn('Failed to update last login:', updateError);
    // Don't fail the login for this
  }

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
