-- RLS "deny-all" su tabelle admin
-- Migration: 20250927_rls_admin_deny_all.sql
-- Description: Enable RLS and add deny-all policies for admin tables

-- ADMIN SESSIONS
ALTER TABLE IF EXISTS public.admin_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Remove existing policies for admin_sessions
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_sessions'
  ) THEN
    -- Drop all existing policies
    DROP POLICY IF EXISTS "Admin sessions access" ON public.admin_sessions;
    DROP POLICY IF EXISTS "Admin can manage sessions" ON public.admin_sessions;
    DROP POLICY IF EXISTS "Service role can access admin sessions" ON public.admin_sessions;
  END IF;
  
  RAISE NOTICE 'Removed existing policies for admin_sessions table';
END$$;

-- Policy "deny-all" for admin_sessions
CREATE POLICY "deny all admin_sessions" ON public.admin_sessions
FOR ALL USING (false) WITH CHECK (false);

-- ADMIN USERS
ALTER TABLE IF EXISTS public.admin_users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Remove existing policies for admin_users
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_users'
  ) THEN
    -- Drop all existing policies
    DROP POLICY IF EXISTS "Admin users access" ON public.admin_users;
    DROP POLICY IF EXISTS "Admin can manage users" ON public.admin_users;
    DROP POLICY IF EXISTS "Service role can access admin users" ON public.admin_users;
  END IF;
  
  RAISE NOTICE 'Removed existing policies for admin_users table';
END$$;

-- Policy "deny-all" for admin_users
CREATE POLICY "deny all admin_users" ON public.admin_users
FOR ALL USING (false) WITH CHECK (false);

-- Log the security change
DO $$
BEGIN
  RAISE NOTICE 'Security hardening: RLS enabled with deny-all policies for admin tables';
  RAISE NOTICE 'Admin tables are now only accessible via service_role or server-side functions';
END $$;
