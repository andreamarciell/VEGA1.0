-- Update admin_sessions table schema for secure cookie-based authentication
-- Migration: 20250927_update_admin_sessions_schema.sql
-- Description: Add token_hash column and ensure proper schema for server-side auth

-- Add token_hash column if it doesn't exist (to replace session_token)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'admin_sessions' 
    AND column_name = 'token_hash'
  ) THEN
    ALTER TABLE public.admin_sessions ADD COLUMN token_hash TEXT;
    RAISE NOTICE 'Added token_hash column to admin_sessions table';
  END IF;
END $$;

-- Add user_id column if it doesn't exist (for Supabase auth.users reference)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'admin_sessions' 
    AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.admin_sessions ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added user_id column to admin_sessions table';
  END IF;
END $$;

-- Ensure expires_at column exists with proper type
DO $$
BEGIN
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

-- Create index on token_hash for fast lookups
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash 
ON public.admin_sessions (token_hash);

-- Create index on expires_at for cleanup operations
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at 
ON public.admin_sessions (expires_at);

-- Log the schema update
DO $$
BEGIN
  RAISE NOTICE 'Admin sessions schema updated for secure server-side authentication';
  RAISE NOTICE 'Table now supports: user_id (UUID), token_hash (TEXT), expires_at (TIMESTAMPTZ)';
END $$;
