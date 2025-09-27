import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export async function requireAdmin(event: any) {
  const cookie = event.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)admin_session=([^;]+)/);
  if (!m) return { ok: false };

  const token = m[1];
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const service = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data, error } = await service
    .from('admin_sessions')
    .select('user_id, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !data) return { ok: false };
  if (new Date(data.expires_at).getTime() < Date.now()) return { ok: false };

  return { ok: true, userId: data.user_id };
}
