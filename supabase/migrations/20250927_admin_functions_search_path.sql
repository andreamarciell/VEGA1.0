do $$
begin
  if exists (select 1 from pg_proc where proname='admin_get_user_for_auth') then
    alter function public.admin_get_user_for_auth(text)
      set search_path = public, pg_catalog;
  end if;

  if exists (select 1 from pg_proc where proname='admin_create_session') then
    alter function public.admin_create_session(uuid, text, timestamptz)
      set search_path = public, pg_catalog;
  end if;

  if exists (select 1 from pg_proc where proname='admin_validate_session') then
    alter function public.admin_validate_session(text)
      set search_path = public, pg_catalog;
  end if;
end$$;
