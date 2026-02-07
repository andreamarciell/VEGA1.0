import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export async function requireAdmin(event: any) {
  const cookie = event.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)admin_session=([^;]+)/);
  if (!m) return { ok: false };

  const token = m[1];
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const service = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  
  // Use RPC function to validate admin session
  const { data, error } = await service.rpc('admin_validate_session', {
    session_token: tokenHash
  });

  if (error || !data?.valid) return { ok: false };

  return { ok: true, adminId: data.admin_id, nickname: data.nickname };
}
