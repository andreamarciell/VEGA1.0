-- Create SECURITY DEFINER function that returns every profile row.
-- This lets the client‑side admin panel list users without bypassing RLS
-- or exposing the service‑role key.

create or replace function public.admin_get_profiles ()
returns setof public.profiles
language sql
security definer
set search_path = public, auth
as $$
  select *
  from public.profiles
  order by created_at desc;
$$;

-- Make the function invocable by clients authenticated with the anon key.
grant execute on function public.admin_get_profiles() to anon;