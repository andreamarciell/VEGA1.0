-- Account Lockout System Migration
-- This migration creates a comprehensive account lockout system

-- Table to track failed login attempts and account lockouts
CREATE TABLE IF NOT EXISTS account_lockouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  failed_attempts integer DEFAULT 0,
  is_locked boolean DEFAULT false,
  lockout_expires_at timestamptz,
  first_failed_attempt timestamptz DEFAULT NOW(),
  last_failed_attempt timestamptz DEFAULT NOW(),
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- Create unique index on username to ensure one record per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_lockouts_username ON account_lockouts(username);

-- Create index for performance on lockout status
CREATE INDEX IF NOT EXISTS idx_account_lockouts_locked ON account_lockouts(is_locked, lockout_expires_at);

-- Function to record a failed login attempt
CREATE OR REPLACE FUNCTION record_failed_login_attempt(
  p_username text,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  lockout_record RECORD;
  new_lockout_duration interval;
  result json;
BEGIN
  -- Get or create lockout record for this username
  SELECT * INTO lockout_record 
  FROM account_lockouts 
  WHERE username = p_username;
  
  IF NOT FOUND THEN
    -- First failed attempt for this username
    INSERT INTO account_lockouts (username, failed_attempts, last_failed_attempt)
    VALUES (p_username, 1, NOW())
    RETURNING * INTO lockout_record;
  ELSE
    -- Check if account is currently locked
    IF lockout_record.is_locked AND lockout_record.lockout_expires_at > NOW() THEN
      -- Account is still locked
      RETURN json_build_object(
        'is_locked', true,
        'lockout_expires_at', lockout_record.lockout_expires_at,
        'remaining_seconds', EXTRACT(EPOCH FROM (lockout_record.lockout_expires_at - NOW())),
        'message', 'Account is currently locked'
      );
    END IF;
    
    -- Reset lockout if time has passed
    IF lockout_record.is_locked AND lockout_record.lockout_expires_at <= NOW() THEN
      UPDATE account_lockouts 
      SET is_locked = false, 
          lockout_expires_at = NULL,
          failed_attempts = 0,
          updated_at = NOW()
      WHERE username = p_username
      RETURNING * INTO lockout_record;
    END IF;
    
    -- Increment failed attempts
    UPDATE account_lockouts 
    SET failed_attempts = failed_attempts + 1,
        last_failed_attempt = NOW(),
        updated_at = NOW()
    WHERE username = p_username
    RETURNING * INTO lockout_record;
  END IF;
  
  -- Determine lockout duration based on failed attempts
  CASE 
    WHEN lockout_record.failed_attempts >= 9 THEN
      new_lockout_duration := interval '15 minutes';
    WHEN lockout_record.failed_attempts >= 6 THEN
      new_lockout_duration := interval '5 minutes';
    WHEN lockout_record.failed_attempts >= 3 THEN
      new_lockout_duration := interval '30 seconds';
    ELSE
      new_lockout_duration := NULL;
  END CASE;
  
  -- Apply lockout if threshold reached
  IF new_lockout_duration IS NOT NULL THEN
    UPDATE account_lockouts 
    SET is_locked = true,
        lockout_expires_at = NOW() + new_lockout_duration,
        updated_at = NOW()
    WHERE username = p_username
    RETURNING * INTO lockout_record;
  END IF;
  
  -- Return result
  result := json_build_object(
    'username', lockout_record.username,
    'failed_attempts', lockout_record.failed_attempts,
    'is_locked', lockout_record.is_locked,
    'lockout_expires_at', lockout_record.lockout_expires_at,
    'remaining_seconds', CASE 
      WHEN lockout_record.lockout_expires_at IS NOT NULL THEN
        EXTRACT(EPOCH FROM (lockout_record.lockout_expires_at - NOW()))
      ELSE 0
    END,
    'message', CASE 
      WHEN lockout_record.failed_attempts >= 9 THEN 'Account locked for 15 minutes due to excessive failed attempts'
      WHEN lockout_record.failed_attempts >= 6 THEN 'Account locked for 5 minutes due to multiple failed attempts'
      WHEN lockout_record.failed_attempts >= 3 THEN 'Account locked for 30 seconds due to failed attempts'
      WHEN lockout_record.failed_attempts >= 2 THEN 'Warning: Multiple failed attempts detected'
      ELSE 'Login attempt recorded'
    END
  );
  
  RETURN result;
END;
$$;

-- Function to check if an account is locked
CREATE OR REPLACE FUNCTION check_account_lockout_status(p_username text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  lockout_record RECORD;
  result json;
BEGIN
  SELECT * INTO lockout_record 
  FROM account_lockouts 
  WHERE username = p_username;
  
  IF NOT FOUND THEN
    -- No lockout record exists, account is not locked
    RETURN json_build_object(
      'username', p_username,
      'is_locked', false,
      'failed_attempts', 0,
      'lockout_expires_at', NULL,
      'remaining_seconds', 0,
      'message', 'Account is not locked'
    );
  END IF;
  
  -- Check if lockout has expired
  IF lockout_record.is_locked AND lockout_record.lockout_expires_at <= NOW() THEN
    -- Lockout has expired, reset it
    UPDATE account_lockouts 
    SET is_locked = false, 
        lockout_expires_at = NULL,
        failed_attempts = 0,
        updated_at = NOW()
    WHERE username = p_username
    RETURNING * INTO lockout_record;
  END IF;
  
  -- Return current status
  result := json_build_object(
    'username', lockout_record.username,
    'is_locked', lockout_record.is_locked,
    'failed_attempts', lockout_record.failed_attempts,
    'lockout_expires_at', lockout_record.lockout_expires_at,
    'remaining_seconds', CASE 
      WHEN lockout_record.lockout_expires_at IS NOT NULL AND lockout_record.lockout_expires_at > NOW() THEN
        EXTRACT(EPOCH FROM (lockout_record.lockout_expires_at - NOW()))
      ELSE 0
    END,
    'message', CASE 
      WHEN lockout_record.is_locked AND lockout_record.lockout_expires_at > NOW() THEN
        CASE 
          WHEN lockout_record.failed_attempts >= 9 THEN 'Account locked for 15 minutes due to excessive failed attempts'
          WHEN lockout_record.failed_attempts >= 6 THEN 'Account locked for 5 minutes due to multiple failed attempts'
          WHEN lockout_record.failed_attempts >= 3 THEN 'Account locked for 30 seconds due to failed attempts'
          ELSE 'Account is locked'
        END
      WHEN lockout_record.failed_attempts >= 2 THEN 'Warning: Multiple failed attempts detected'
      ELSE 'Account is not locked'
    END
  );
  
  RETURN result;
END;
$$;

-- Function to reset account lockout (for successful login or admin override)
CREATE OR REPLACE FUNCTION reset_account_lockout(p_username text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  UPDATE account_lockouts 
  SET is_locked = false,
      lockout_expires_at = NULL,
      failed_attempts = 0,
      updated_at = NOW()
  WHERE username = p_username;
  
  IF FOUND THEN
    result := json_build_object(
      'username', p_username,
      'success', true,
      'message', 'Account lockout reset successfully'
    );
  ELSE
    result := json_build_object(
      'username', p_username,
      'success', false,
      'message', 'No lockout record found for this username'
    );
  END IF;
  
  RETURN result;
END;
$$;

-- Function to get lockout statistics (for admin monitoring)
CREATE OR REPLACE FUNCTION get_lockout_statistics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_locked integer;
  total_attempts integer;
  recent_lockouts integer;
BEGIN
  SELECT 
    COUNT(*) FILTER (WHERE is_locked = true AND lockout_expires_at > NOW()),
    SUM(failed_attempts),
    COUNT(*) FILTER (WHERE last_failed_attempt > NOW() - interval '1 hour')
  INTO total_locked, total_attempts, recent_lockouts
  FROM account_lockouts;
  
  RETURN json_build_object(
    'total_currently_locked', COALESCE(total_locked, 0),
    'total_failed_attempts', COALESCE(total_attempts, 0),
    'recent_lockouts_last_hour', COALESCE(recent_lockouts, 0),
    'timestamp', NOW()
  );
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION record_failed_login_attempt(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION check_account_lockout_status(text) TO authenticated;
GRANT EXECUTE ON FUNCTION reset_account_lockout(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_lockout_statistics() TO authenticated;

-- Enable RLS on the lockout table
ALTER TABLE account_lockouts ENABLE ROW LEVEL SECURITY;

-- Create policy to deny direct access (only functions can access)
CREATE POLICY "Deny all access to account_lockouts" ON account_lockouts
  FOR ALL USING (false);

-- Insert some initial data for testing (optional)
-- INSERT INTO account_lockouts (username, failed_attempts, is_locked) 
-- VALUES ('test_user', 0, false) ON CONFLICT (username) DO NOTHING;
