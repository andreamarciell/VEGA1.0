-- Grant write privileges to anon/authenticated roles on admin tables
GRANT INSERT, DELETE ON TABLE public.admin_sessions TO anon, authenticated;
GRANT UPDATE ON TABLE public.admin_users TO anon, authenticated;
