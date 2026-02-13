/**
 * Admin guard - DISABLED after Supabase migration
 * The admin panel (/control) has been disabled. This function always returns { ok: false }.
 */
export async function requireAdmin(event: any) {
  // Admin functionality has been disabled after Supabase migration
  // Always return false to block all admin access
  return { ok: false };
  
  /* OLD CODE - DISABLED AFTER SUPABASE MIGRATION
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
  */
}
