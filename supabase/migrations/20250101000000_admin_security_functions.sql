-- Admin Security Functions Migration
-- This migration creates secure RPC functions for admin operations

-- Function to check if admin user exists (secure)
CREATE OR REPLACE FUNCTION admin_check_user_exists(username text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_users 
    WHERE nickname = username
  );
END;
$$;

-- Function to get admin user data for authentication (returns password hash)
CREATE OR REPLACE FUNCTION admin_get_user_for_auth(admin_nickname text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_record RECORD;
BEGIN
  -- Get admin user including password hash for client-side verification
  SELECT * INTO admin_record 
  FROM admin_users 
  WHERE nickname = admin_nickname;
  
  IF NOT FOUND THEN
    RETURN json_build_object('found', false);
  END IF;
  
  -- Return admin info including password hash for verification
  RETURN json_build_object(
    'found', true,
    'admin_id', admin_record.id,
    'nickname', admin_record.nickname,
    'password_hash', admin_record.password_hash,
    'created_at', admin_record.created_at,
    'updated_at', admin_record.updated_at,
    'last_login', admin_record.last_login
  );
END;
$$;

-- Function to create admin session securely
CREATE OR REPLACE FUNCTION admin_create_session(admin_user_id uuid, session_token text, expires_at timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO admin_sessions (admin_user_id, session_token, expires_at)
  VALUES (admin_user_id, session_token, expires_at);
  
  -- Update last login time
  UPDATE admin_users 
  SET last_login = NOW()
  WHERE id = admin_user_id;
END;
$$;

-- Function to check admin session validity
CREATE OR REPLACE FUNCTION admin_check_session(session_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  session_record RECORD;
  admin_record RECORD;
BEGIN
  -- Get session and admin info
  SELECT s.*, a.nickname, a.created_at, a.updated_at, a.last_login
  INTO session_record
  FROM admin_sessions s
  JOIN admin_users a ON s.admin_user_id = a.id
  WHERE s.session_token = session_token
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

-- Function to destroy admin session
CREATE OR REPLACE FUNCTION admin_destroy_session(session_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM admin_sessions 
  WHERE session_token = session_token;
END;
$$;

-- Ensure admin tables exist with proper structure
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  last_login timestamptz
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES admin_users(id) ON DELETE CASCADE,
  session_token text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_users_nickname ON admin_users(nickname);

-- Set up RLS policies to deny direct access
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies and create deny-all policies
DROP POLICY IF EXISTS "Deny all access to admin_users" ON admin_users;
DROP POLICY IF EXISTS "Deny all access to admin_sessions" ON admin_sessions;

CREATE POLICY "Deny all access to admin_users" ON admin_users
  FOR ALL USING (false);

CREATE POLICY "Deny all access to admin_sessions" ON admin_sessions
  FOR ALL USING (false);

-- Grant execute permissions to the functions for authenticated users
GRANT EXECUTE ON FUNCTION admin_check_user_exists(text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_get_user_for_auth(text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_create_session(uuid, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_check_session(text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_destroy_session(text) TO authenticated;
