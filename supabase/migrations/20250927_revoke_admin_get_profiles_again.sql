do $$
begin
  if exists (select 1 from information_schema.routines where routine_schema='public' and routine_name='admin_get_profiles') then
    revoke execute on function public.admin_get_profiles() from public;
    revoke execute on function public.admin_get_profiles() from anon;
  end if;
end$$;
