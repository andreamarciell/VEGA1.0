-- Add missing admin functions for server-side authentication
-- Migration: 20250927_add_missing_admin_functions.sql

-- Function to update admin last login
CREATE OR REPLACE FUNCTION admin_update_last_login(admin_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE admin_users 
  SET last_login = NOW(), updated_at = NOW()
  WHERE id = admin_user_id;
END;
$$;

-- Function to validate admin session using token_hash
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

-- Updated function to create admin session using token_hash
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION admin_update_last_login(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_update_last_login(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION admin_validate_session(text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_validate_session(text) TO service_role;
GRANT EXECUTE ON FUNCTION admin_create_session(uuid, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_create_session(uuid, text, timestamptz) TO service_role;

-- Log the function creation
DO $$
BEGIN
  RAISE NOTICE 'Added admin functions for server-side authentication: admin_update_last_login, admin_validate_session, admin_create_session (updated)';
END $$;
