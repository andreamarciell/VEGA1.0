-- DEFINITIVE FIX for admin_sessions schema issues
-- Migration: 20250927_fix_admin_sessions_definitive.sql
-- Description: Resolve null constraint issues in admin_sessions table

-- First, let's check what columns exist and fix constraints
DO $$
DECLARE
    has_session_token boolean;
    has_token_hash boolean;
BEGIN
    -- Check if session_token column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'admin_sessions' 
        AND column_name = 'session_token'
    ) INTO has_session_token;

    -- Check if token_hash column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'admin_sessions' 
        AND column_name = 'token_hash'
    ) INTO has_token_hash;

    RAISE NOTICE 'Table state: session_token=%, token_hash=%', has_session_token, has_token_hash;

    -- Scenario 1: Only session_token exists (rename it)
    IF has_session_token AND NOT has_token_hash THEN
        ALTER TABLE public.admin_sessions RENAME COLUMN session_token TO token_hash;
        RAISE NOTICE 'Renamed session_token to token_hash';
    END IF;

    -- Scenario 2: Both exist (drop session_token, keep token_hash)
    IF has_session_token AND has_token_hash THEN
        ALTER TABLE public.admin_sessions DROP COLUMN session_token;
        RAISE NOTICE 'Dropped session_token column, keeping token_hash';
    END IF;

    -- Scenario 3: Only token_hash exists (good, do nothing)
    IF NOT has_session_token AND has_token_hash THEN
        RAISE NOTICE 'Table already has correct token_hash column';
    END IF;

    -- Scenario 4: Neither exists (create token_hash)
    IF NOT has_session_token AND NOT has_token_hash THEN
        ALTER TABLE public.admin_sessions ADD COLUMN token_hash TEXT NOT NULL;
        RAISE NOTICE 'Added token_hash column';
    END IF;

    -- Ensure token_hash has NOT NULL constraint
    BEGIN
        ALTER TABLE public.admin_sessions ALTER COLUMN token_hash SET NOT NULL;
        RAISE NOTICE 'Set token_hash NOT NULL constraint';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'token_hash already has NOT NULL constraint or other issue: %', SQLERRM;
    END;

    -- Ensure other required columns exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'admin_sessions' 
        AND column_name = 'admin_user_id'
    ) THEN
        ALTER TABLE public.admin_sessions ADD COLUMN admin_user_id UUID REFERENCES admin_users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added admin_user_id column';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'admin_sessions' 
        AND column_name = 'expires_at'
    ) THEN
        ALTER TABLE public.admin_sessions ADD COLUMN expires_at TIMESTAMPTZ NOT NULL;
        RAISE NOTICE 'Added expires_at column';
    END IF;

END $$;

-- Clean up any existing data that might be inconsistent
DELETE FROM admin_sessions WHERE token_hash IS NULL OR admin_user_id IS NULL OR expires_at IS NULL;

-- Recreate indexes
DROP INDEX IF EXISTS idx_admin_sessions_token;
DROP INDEX IF EXISTS idx_admin_sessions_session_token;
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON public.admin_sessions (token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON public.admin_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_user_id ON public.admin_sessions (admin_user_id);

-- Update the admin_create_session function to handle the correct schema
CREATE OR REPLACE FUNCTION admin_create_session(admin_user_id uuid, session_token text, expires_at timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO admin_sessions (admin_user_id, token_hash, expires_at)
    VALUES (admin_user_id, session_token, expires_at);
    
    RAISE NOTICE 'Created admin session for user: %', admin_user_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION admin_create_session(uuid, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_create_session(uuid, text, timestamptz) TO service_role;

-- Final verification
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE 'Final admin_sessions table structure:';
    FOR rec IN 
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'admin_sessions'
        ORDER BY ordinal_position
    LOOP
        RAISE NOTICE '  - %: % (nullable: %)', rec.column_name, rec.data_type, rec.is_nullable;
    END LOOP;
END $$;
