-- Fix lockout system issues:
-- 1. Update progressive lockout durations (6 attempts = 1 minute instead of 5 minutes)
-- 2. Fix bug: Keep failed attempts when lockout expires (only reset on successful login)

-- Update the record_failed_login_attempt function with new durations
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
  new_lockout_duration INTERVAL;
  result json;
BEGIN
  -- Insert or update the lockout record
  INSERT INTO account_lockouts (username, failed_attempts, last_attempt_at, last_attempt_ip, last_attempt_user_agent)
  VALUES (p_username, 1, NOW(), p_ip_address, p_user_agent)
  ON CONFLICT (username) 
  DO UPDATE SET 
    failed_attempts = account_lockouts.failed_attempts + 1,
    last_attempt_at = NOW(),
    last_attempt_ip = p_ip_address,
    last_attempt_user_agent = p_user_agent,
    updated_at = NOW()
  RETURNING * INTO lockout_record;
  
  -- Determine lockout duration based on failed attempts (UPDATED DURATIONS)
  CASE 
    WHEN lockout_record.failed_attempts >= 9 THEN
      new_lockout_duration := interval '15 minutes';
    WHEN lockout_record.failed_attempts >= 6 THEN
      new_lockout_duration := interval '1 minute';  -- Changed from 5 minutes
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
  
  -- Return result with updated messages
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
      WHEN lockout_record.failed_attempts >= 6 THEN 'Account locked for 1 minute due to multiple failed attempts'  -- Updated message
      WHEN lockout_record.failed_attempts >= 3 THEN 'Account locked for 30 seconds due to failed attempts'
      WHEN lockout_record.failed_attempts >= 2 THEN 'Warning: Multiple failed attempts detected'
      ELSE 'Login attempt recorded'
    END
  );
  
  RETURN result;
END;
$$;

-- Update the check_account_lockout_status function to NOT reset failed attempts on expiry
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
    -- Lockout has expired, unlock but KEEP failed attempts count
    -- Failed attempts should only be reset by reset_account_lockout() on successful login
    UPDATE account_lockouts 
    SET is_locked = false, 
        lockout_expires_at = NULL,
        updated_at = NOW()
    WHERE username = p_username
    RETURNING * INTO lockout_record;
  END IF;
  
  -- Return current status with updated messages
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
          WHEN lockout_record.failed_attempts >= 6 THEN 'Account locked for 1 minute due to multiple failed attempts'  -- Updated message
          WHEN lockout_record.failed_attempts >= 3 THEN 'Account locked for 30 seconds due to failed attempts'
          ELSE 'Account is locked'
        END
      WHEN lockout_record.failed_attempts >= 2 THEN 'Warning: Multiple failed attempts detected'
      ELSE 'Account status is normal'
    END
  );
  
  RETURN result;
END;
$$;

-- Comment explaining the changes
COMMENT ON FUNCTION record_failed_login_attempt(text, text, text) IS 'Progressive lockout: 3 attempts = 30s, 6 attempts = 1min, 9+ attempts = 15min';
COMMENT ON FUNCTION check_account_lockout_status(text) IS 'Check lockout status - keeps failed attempts on expiry, only reset_account_lockout() clears them';
