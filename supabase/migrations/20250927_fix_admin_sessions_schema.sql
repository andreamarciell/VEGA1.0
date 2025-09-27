-- Fix admin_sessions schema inconsistencies
-- Migration: 20250927_fix_admin_sessions_schema.sql
-- Description: Ensure admin_sessions table has correct schema for server-side auth

-- Check current table structure and add missing columns
DO $$
BEGIN
  -- Add token_hash column if it doesn't exist and rename session_token if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'admin_sessions' 
    AND column_name = 'session_token'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'admin_sessions' 
    AND column_name = 'token_hash'
  ) THEN
    -- Rename session_token to token_hash for consistency
    ALTER TABLE public.admin_sessions RENAME COLUMN session_token TO token_hash;
    RAISE NOTICE 'Renamed session_token column to token_hash in admin_sessions table';
  END IF;

  -- Add token_hash column if neither exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'admin_sessions' 
    AND column_name = 'token_hash'
  ) THEN
    ALTER TABLE public.admin_sessions ADD COLUMN token_hash TEXT;
    RAISE NOTICE 'Added token_hash column to admin_sessions table';
  END IF;

  -- Ensure admin_user_id column exists with correct reference
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'admin_sessions' 
    AND column_name = 'admin_user_id'
  ) THEN
    ALTER TABLE public.admin_sessions ADD COLUMN admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added admin_user_id column to admin_sessions table';
  END IF;

  -- Ensure expires_at column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'admin_sessions' 
    AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE public.admin_sessions ADD COLUMN expires_at TIMESTAMPTZ;
    RAISE NOTICE 'Added expires_at column to admin_sessions table';
  END IF;
END $$;

-- Create/recreate indexes for performance
DROP INDEX IF EXISTS idx_admin_sessions_token;
DROP INDEX IF EXISTS idx_admin_sessions_session_token;
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON public.admin_sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON public.admin_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_user_id ON public.admin_sessions (admin_user_id);

-- Update the admin_create_session function to use correct column name
CREATE OR REPLACE FUNCTION admin_create_session(admin_user_id uuid, session_token text, expires_at timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO admin_sessions (admin_user_id, token_hash, expires_at)
  VALUES (admin_user_id, session_token, expires_at);
END;
$$;

-- Update the admin_validate_session function to use correct column name
CREATE OR REPLACE FUNCTION admin_validate_session(session_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  session_record RECORD;
BEGIN
  -- Get session and admin user data using token_hash column
  SELECT s.admin_user_id, s.expires_at, a.nickname, a.created_at, a.updated_at, a.last_login
  INTO session_record
  FROM admin_sessions s
  JOIN admin_users a ON s.admin_user_id = a.id
  WHERE s.token_hash = session_token
    AND s.expires_at > NOW();
  
  IF NOT FOUND THEN
    RETURN json_build_object('valid', false);
  END IF;
  
  RETURN json_build_object(
    'valid', true,
    'admin_id', session_record.admin_user_id,
    'nickname', session_record.nickname,
    'created_at', session_record.created_at,
    'updated_at', session_record.updated_at,
    'last_login', session_record.last_login
  );
END;
$$;

-- Ensure all permissions are granted
GRANT EXECUTE ON FUNCTION admin_create_session(uuid, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_create_session(uuid, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION admin_validate_session(text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_validate_session(text) TO service_role;

-- Log the schema fix
DO $$
BEGIN
  RAISE NOTICE 'Fixed admin_sessions schema inconsistencies - now using token_hash column consistently';
END $$;
