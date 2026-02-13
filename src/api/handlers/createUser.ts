import type { ApiHandler } from '../types';
import { requireAdmin } from './_adminGuard';

export const handler: ApiHandler = async (event) => {
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
  let payload: { email: string; password: string; username?: string; tenant_code?: string };
  try { payload = JSON.parse(event.body); } catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  // Validazione minima
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email);
  const passOk = typeof payload.password === 'string' && payload.password.length >= 8;
  const usernameOk = !payload.username || (typeof payload.username === 'string' && payload.username.length >= 2);
  if (!emailOk || !passOk || !usernameOk) {
    return { statusCode: 400, body: 'Invalid email, password, or username' };
  }

  // NOTA: Dopo la migrazione da Supabase a Clerk, la creazione utenti deve usare Clerk Admin API
  // Per ora, questo endpoint è disabilitato. Implementare usando Clerk Admin SDK.
  return { 
    statusCode: 501, 
    body: JSON.stringify({ 
      error: 'Not Implemented',
      message: 'User creation needs to be reimplemented using Clerk Admin API after Supabase migration.'
    })
  };
};

