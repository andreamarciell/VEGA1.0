-- Migration to add login attempts tracking for rate limiting
-- This replaces the in-memory rate limiting with database persistence

-- Create login_attempts table for tracking all login attempts
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address INET NOT NULL,
  attempt_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  username TEXT, -- Optional, for tracking specific user attempts
  success BOOLEAN DEFAULT FALSE,
  error_type TEXT, -- Type of error (invalid_credentials, rate_limit, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts(ip_address, attempt_time);
CREATE INDEX IF NOT EXISTS idx_login_attempts_username_time ON login_attempts(username, attempt_time);
CREATE INDEX IF NOT EXISTS idx_login_attempts_time ON login_attempts(attempt_time);
CREATE INDEX IF NOT EXISTS idx_login_attempts_success ON login_attempts(success, attempt_time);

-- Function to check rate limit for an IP address
CREATE OR REPLACE FUNCTION check_rate_limit(p_ip_address INET, p_window_minutes INTEGER DEFAULT 15, p_max_attempts INTEGER DEFAULT 5)
RETURNS TABLE(allowed BOOLEAN, remaining_attempts INTEGER, reset_time TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  window_start TIMESTAMPTZ;
  attempt_count INTEGER;
  next_reset TIMESTAMPTZ;
BEGIN
  -- Calculate window start time
  window_start := NOW() - (p_window_minutes || ' minutes')::INTERVAL;
  
  -- Count attempts in the window
  SELECT COUNT(*) INTO attempt_count
  FROM login_attempts
  WHERE ip_address = p_ip_address
    AND attempt_time >= window_start;
  
  -- Calculate next reset time (earliest attempt + window)
  SELECT MIN(attempt_time) + (p_window_minutes || ' minutes')::INTERVAL INTO next_reset
  FROM login_attempts
  WHERE ip_address = p_ip_address
    AND attempt_time >= window_start;
  
  -- If no attempts found, set reset time to now
  IF next_reset IS NULL THEN
    next_reset := NOW();
  END IF;
  
  -- Return results
  RETURN QUERY SELECT 
    (attempt_count < p_max_attempts) as allowed,
    GREATEST(0, p_max_attempts - attempt_count) as remaining_attempts,
    next_reset as reset_time;
END;
$$;

-- Function to record a login attempt
CREATE OR REPLACE FUNCTION record_login_attempt(
  p_ip_address INET,
  p_user_agent TEXT DEFAULT NULL,
  p_username TEXT DEFAULT NULL,
  p_success BOOLEAN DEFAULT FALSE,
  p_error_type TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  attempt_id UUID;
BEGIN
  INSERT INTO login_attempts (ip_address, user_agent, username, success, error_type)
  VALUES (p_ip_address, p_user_agent, p_username, p_success, p_error_type)
  RETURNING id INTO attempt_id;
  
  RETURN attempt_id;
END;
$$;

-- Function to clean up old login attempts (older than 24 hours)
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM login_attempts 
  WHERE attempt_time < NOW() - INTERVAL '24 hours';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Function to get login attempt statistics
CREATE OR REPLACE FUNCTION get_login_attempt_stats(p_hours INTEGER DEFAULT 24)
RETURNS TABLE(
  total_attempts BIGINT,
  successful_attempts BIGINT,
  failed_attempts BIGINT,
  unique_ips BIGINT,
  unique_users BIGINT,
  success_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  window_start TIMESTAMPTZ;
BEGIN
  window_start := NOW() - (p_hours || ' hours')::INTERVAL;
  
  RETURN QUERY 
  SELECT 
    COUNT(*) as total_attempts,
    COUNT(*) FILTER (WHERE success = true) as successful_attempts,
    COUNT(*) FILTER (WHERE success = false) as failed_attempts,
    COUNT(DISTINCT ip_address) as unique_ips,
    COUNT(DISTINCT username) FILTER (WHERE username IS NOT NULL) as unique_users,
    ROUND(
      (COUNT(*) FILTER (WHERE success = true)::NUMERIC / 
       NULLIF(COUNT(*)::NUMERIC, 0) * 100), 
      2
    ) as success_rate
  FROM login_attempts
  WHERE attempt_time >= window_start;
END;
$$;

-- Enable Row Level Security
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- Policy to allow the service role to read/write all data
CREATE POLICY "Service role full access" ON login_attempts
  FOR ALL 
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy to prevent public access
CREATE POLICY "Prevent public access" ON login_attempts
  FOR ALL 
  TO public
  USING (false);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON login_attempts TO service_role;
GRANT EXECUTE ON FUNCTION check_rate_limit(INET, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION record_login_attempt(INET, TEXT, TEXT, BOOLEAN, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_login_attempts() TO service_role;
GRANT EXECUTE ON FUNCTION get_login_attempt_stats(INTEGER) TO service_role;

-- Create a comment to track this migration
COMMENT ON TABLE login_attempts IS 'Tracks login attempts for rate limiting and security monitoring';
COMMENT ON FUNCTION check_rate_limit IS 'Checks if an IP address has exceeded rate limits';
COMMENT ON FUNCTION record_login_attempt IS 'Records a new login attempt for rate limiting tracking';
COMMENT ON FUNCTION cleanup_old_login_attempts IS 'Removes old login attempts to maintain table size';
COMMENT ON FUNCTION get_login_attempt_stats IS 'Provides statistics on login attempts for monitoring';
