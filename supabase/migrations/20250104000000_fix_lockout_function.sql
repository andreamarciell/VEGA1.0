-- Fix lockout function column mismatch
-- The function was using non-existent columns - fix to match actual table structure

-- Update the record_failed_login_attempt function to use correct column names
CREATE OR REPLACE FUNCTION record_failed_login_attempt(
  p_username text
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
  -- Insert or update the lockout record (using correct column names)
  INSERT INTO account_lockouts (username, failed_attempts, last_failed_attempt)
  VALUES (p_username, 1, NOW())
  ON CONFLICT (username) 
  DO UPDATE SET 
    failed_attempts = account_lockouts.failed_attempts + 1,
    last_failed_attempt = NOW(),
    updated_at = NOW()
  RETURNING * INTO lockout_record;
  
  -- Determine lockout duration based on failed attempts
  CASE 
    WHEN lockout_record.failed_attempts >= 9 THEN
      new_lockout_duration := interval '15 minutes';
    WHEN lockout_record.failed_attempts >= 6 THEN
      new_lockout_duration := interval '1 minute';
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
      WHEN lockout_record.failed_attempts >= 6 THEN 'Account locked for 1 minute due to multiple failed attempts'
      WHEN lockout_record.failed_attempts >= 3 THEN 'Account locked for 30 seconds due to failed attempts'
      WHEN lockout_record.failed_attempts >= 2 THEN 'Warning: Multiple failed attempts detected'
      ELSE 'Login attempt recorded'
    END
  );
  
  RETURN result;
END;
$$;

-- Comment explaining the fix
COMMENT ON FUNCTION record_failed_login_attempt(text) IS 'Fixed column names - Progressive lockout: 3 attempts = 30s, 6 attempts = 1min, 9+ attempts = 15min';
