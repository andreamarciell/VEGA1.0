-- Tabella tentativi di login admin
create table if not exists public.admin_login_attempts (
  id bigserial primary key,
  nickname text not null,
  ip text,
  attempts int not null default 0,
  last_attempt timestamptz not null default now()
);

create index if not exists idx_admin_login_attempts_nick on public.admin_login_attempts(nickname);

-- RLS opzionale (deny-all); la useremo solo con service-role
alter table public.admin_login_attempts enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='admin_login_attempts'
  ) then
    create policy "deny all admin_login_attempts" on public.admin_login_attempts
      for all using (false) with check (false);
  end if;
end$$;
