-- Migration to add session validation functionality
-- This adds server-side session validation to complement client-side checks

-- Create user_sessions table for tracking active user sessions
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_accessed TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  ip_address INET,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  terminated_at TIMESTAMPTZ NULL,
  termination_reason TEXT NULL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- Function to validate session and update last accessed time
CREATE OR REPLACE FUNCTION validate_user_session(p_session_token TEXT)
RETURNS TABLE(
  is_valid BOOLEAN,
  user_id UUID,
  expires_at TIMESTAMPTZ,
  last_accessed TIMESTAMPTZ,
  session_age_hours NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  session_record user_sessions%ROWTYPE;
BEGIN
  -- Find the session
  SELECT * INTO session_record
  FROM user_sessions
  WHERE session_token = p_session_token
    AND is_active = true;
  
  -- Check if session exists and is not expired
  IF NOT FOUND OR session_record.expires_at < NOW() THEN
    -- If session is expired, mark it as inactive
    IF FOUND AND session_record.expires_at < NOW() THEN
      UPDATE user_sessions 
      SET is_active = false, 
          terminated_at = NOW(),
          termination_reason = 'expired'
      WHERE session_token = p_session_token;
    END IF;
    
    RETURN QUERY SELECT false, NULL::UUID, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, NULL::NUMERIC;
    RETURN;
  END IF;
  
  -- Update last accessed time
  UPDATE user_sessions 
  SET last_accessed = NOW()
  WHERE session_token = p_session_token;
  
  -- Return session info
  RETURN QUERY SELECT 
    true as is_valid,
    session_record.user_id,
    session_record.expires_at,
    NOW() as last_accessed,
    EXTRACT(EPOCH FROM (NOW() - session_record.created_at)) / 3600 as session_age_hours;
END;
$$;

-- Function to create a new user session
CREATE OR REPLACE FUNCTION create_user_session(
  p_user_id UUID,
  p_session_token TEXT,
  p_expires_at TIMESTAMPTZ,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  session_id UUID;
BEGIN
  -- Deactivate any existing active sessions for this user (optional: single session per user)
  -- UPDATE user_sessions 
  -- SET is_active = false, 
  --     terminated_at = NOW(),
  --     termination_reason = 'new_session_created'
  -- WHERE user_id = p_user_id AND is_active = true;
  
  -- Create new session
  INSERT INTO user_sessions (user_id, session_token, expires_at, ip_address, user_agent)
  VALUES (p_user_id, p_session_token, p_expires_at, p_ip_address, p_user_agent)
  RETURNING id INTO session_id;
  
  RETURN session_id;
END;
$$;

-- Function to terminate a session
CREATE OR REPLACE FUNCTION terminate_user_session(
  p_session_token TEXT,
  p_reason TEXT DEFAULT 'manual_logout'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_sessions 
  SET is_active = false,
      terminated_at = NOW(),
      termination_reason = p_reason
  WHERE session_token = p_session_token
    AND is_active = true;
  
  RETURN FOUND;
END;
$$;

-- Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  -- Mark expired sessions as inactive
  UPDATE user_sessions 
  SET is_active = false,
      terminated_at = NOW(),
      termination_reason = 'expired'
  WHERE expires_at < NOW() 
    AND is_active = true;
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  
  -- Delete very old sessions (older than 30 days)
  DELETE FROM user_sessions
  WHERE created_at < NOW() - INTERVAL '30 days'
    AND is_active = false;
  
  RETURN cleaned_count;
END;
$$;

-- Function to get active sessions for a user
CREATE OR REPLACE FUNCTION get_user_active_sessions(p_user_id UUID)
RETURNS TABLE(
  session_id UUID,
  created_at TIMESTAMPTZ,
  last_accessed TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  is_current BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    us.id,
    us.created_at,
    us.last_accessed,
    us.expires_at,
    us.ip_address,
    us.user_agent,
    (us.last_accessed = (SELECT MAX(last_accessed) FROM user_sessions WHERE user_id = p_user_id AND is_active = true)) as is_current
  FROM user_sessions us
  WHERE us.user_id = p_user_id
    AND us.is_active = true
    AND us.expires_at > NOW()
  ORDER BY us.last_accessed DESC;
END;
$$;

-- Enable Row Level Security
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Policy for service role full access
CREATE POLICY "Service role full access" ON user_sessions
  FOR ALL 
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy for authenticated users to see only their own sessions
CREATE POLICY "Users can view own sessions" ON user_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy to prevent direct public access
CREATE POLICY "Prevent public access" ON user_sessions
  FOR ALL 
  TO public
  USING (false);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON user_sessions TO service_role;
GRANT EXECUTE ON FUNCTION validate_user_session(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION create_user_session(UUID, TEXT, TIMESTAMPTZ, INET, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION terminate_user_session(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_sessions() TO service_role;
GRANT EXECUTE ON FUNCTION get_user_active_sessions(UUID) TO service_role;

-- Grant read access to authenticated users for their own sessions
GRANT SELECT ON user_sessions TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_active_sessions(UUID) TO authenticated;

-- Add comments
COMMENT ON TABLE user_sessions IS 'Tracks active user sessions for enhanced security';
COMMENT ON FUNCTION validate_user_session IS 'Validates a session token and updates last accessed time';
COMMENT ON FUNCTION create_user_session IS 'Creates a new user session record';
COMMENT ON FUNCTION terminate_user_session IS 'Terminates an active session';
COMMENT ON FUNCTION cleanup_expired_sessions IS 'Cleans up expired and old sessions';
COMMENT ON FUNCTION get_user_active_sessions IS 'Returns active sessions for a user';
