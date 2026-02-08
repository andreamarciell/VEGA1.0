import type { ApiHandler } from '../types';
import { createServiceClient } from './_supabaseAdmin';
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

  // Validate tenant_code if provided
  if (payload.tenant_code) {
    const service = createServiceClient();
    const { data: client, error: clientError } = await service
      .from('api_clients')
      .select('tenant_code')
      .eq('tenant_code', payload.tenant_code)
      .single();

    if (clientError || !client) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Invalid tenant_code. The tenant_code must exist in api_clients table.' })
      };
    }
  }

  const service = createServiceClient();
  const { data, error } = await service.auth.admin.createUser({
    email: payload.email,
    password: payload.password,
    email_confirm: true,
    user_metadata: payload.username ? { username: payload.username } : {}
  });

  if (error) return { statusCode: 500, body: error.message };
  
  // Update profile with tenant_code if provided
  if (data.user?.id && payload.tenant_code) {
    const { error: profileError } = await service
      .from('profiles')
      .update({ tenant_code: payload.tenant_code })
      .eq('user_id', data.user.id);

    if (profileError) {
      console.error('Error updating profile with tenant_code:', profileError);
      // Don't fail the user creation, but log the error
    }
  }

  return { statusCode: 200, body: JSON.stringify({ userId: data.user?.id }) };
};

