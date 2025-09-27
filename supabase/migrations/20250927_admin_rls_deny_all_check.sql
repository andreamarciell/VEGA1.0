-- Assicura RLS deny-all su tabelle admin
alter table if exists public.admin_users enable row level security;
alter table if exists public.admin_sessions enable row level security;

do $$
begin
  -- admin_users
  delete from pg_policies where schemaname='public' and tablename='admin_users';
  create policy "deny all admin_users" on public.admin_users
    for all using (false) with check (false);

  -- admin_sessions
  delete from pg_policies where schemaname='public' and tablename='admin_sessions';
  create policy "deny all admin_sessions" on public.admin_sessions
    for all using (false) with check (false);
end$$;
