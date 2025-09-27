-- Assicura RLS deny-all su tabelle admin
alter table if exists public.admin_users enable row level security;
alter table if exists public.admin_sessions enable row level security;

do $$
begin
  -- admin_users - Drop existing policies first
  drop policy if exists "deny all admin_users" on public.admin_users;
  drop policy if exists "Admin users access" on public.admin_users;
  drop policy if exists "Admin can manage users" on public.admin_users;
  drop policy if exists "Service role can access admin users" on public.admin_users;
  
  -- Create deny-all policy
  create policy "deny all admin_users" on public.admin_users
    for all using (false) with check (false);

  -- admin_sessions - Drop existing policies first
  drop policy if exists "deny all admin_sessions" on public.admin_sessions;
  drop policy if exists "Admin sessions access" on public.admin_sessions;
  drop policy if exists "Admin can manage sessions" on public.admin_sessions;
  drop policy if exists "Service role can access admin sessions" on public.admin_sessions;
  
  -- Create deny-all policy
  create policy "deny all admin_sessions" on public.admin_sessions
    for all using (false) with check (false);
end$$;
