-- Admin Account Lockout System - Migration
-- This creates the same progressive lockout system used for regular users, but for admin accounts

-- Create admin_account_lockouts table (same structure as account_lockouts but for admins)
CREATE TABLE IF NOT EXISTS public.admin_account_lockouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname text NOT NULL UNIQUE, -- admin nickname instead of username
  failed_attempts integer DEFAULT 0,
  is_locked boolean DEFAULT false,
  lockout_expires_at timestamptz,
  first_failed_attempt timestamptz DEFAULT NOW(),
  last_failed_attempt timestamptz DEFAULT NOW(),
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_admin_account_lockouts_nickname ON public.admin_account_lockouts(nickname);
CREATE INDEX IF NOT EXISTS idx_admin_account_lockouts_lockout_expires ON public.admin_account_lockouts(lockout_expires_at);

-- Enable RLS (Row Level Security)
ALTER TABLE public.admin_account_lockouts ENABLE ROW LEVEL SECURITY;

-- Create policy to deny all access (only service role can access)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='admin_account_lockouts'
  ) THEN
    CREATE POLICY "deny all admin_account_lockouts" ON public.admin_account_lockouts
      FOR ALL USING (false) WITH CHECK (false);
  END IF;
END$$;

-- Function to record admin failed login attempt
CREATE OR REPLACE FUNCTION record_admin_failed_login_attempt(
  p_nickname text
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
  INSERT INTO admin_account_lockouts (nickname, failed_attempts, last_failed_attempt)
  VALUES (p_nickname, 1, NOW())
  ON CONFLICT (nickname) 
  DO UPDATE SET 
    failed_attempts = admin_account_lockouts.failed_attempts + 1,
    last_failed_attempt = NOW(),
    updated_at = NOW()
  RETURNING * INTO lockout_record;
  
  -- Determine lockout duration based on failed attempts (same as user system)
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
    UPDATE admin_account_lockouts 
    SET is_locked = true,
        lockout_expires_at = NOW() + new_lockout_duration,
        updated_at = NOW()
    WHERE nickname = p_nickname
    RETURNING * INTO lockout_record;
  END IF;
  
  -- Return result
  result := json_build_object(
    'nickname', lockout_record.nickname,
    'failed_attempts', lockout_record.failed_attempts,
    'is_locked', lockout_record.is_locked,
    'lockout_expires_at', lockout_record.lockout_expires_at,
    'remaining_seconds', 
      CASE 
        WHEN lockout_record.is_locked AND lockout_record.lockout_expires_at > NOW() THEN
          EXTRACT(EPOCH FROM (lockout_record.lockout_expires_at - NOW()))::integer
        ELSE 0
      END,
    'message',
      CASE 
        WHEN lockout_record.is_locked AND lockout_record.lockout_expires_at > NOW() THEN
          CASE 
            WHEN lockout_record.failed_attempts >= 9 THEN
              'Account locked for 15 minutes due to multiple failed attempts'
            WHEN lockout_record.failed_attempts >= 6 THEN
              'Account locked for 1 minute due to multiple failed attempts'
            WHEN lockout_record.failed_attempts >= 3 THEN
              'Account locked for 30 seconds due to multiple failed attempts'
            ELSE ''
          END
        ELSE ''
      END
  );
  
  RETURN result;
END;
$$;

-- Function to check admin account lockout status
CREATE OR REPLACE FUNCTION check_admin_account_lockout_status(
  p_nickname text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  lockout_record RECORD;
  result json;
BEGIN
  -- Get lockout record
  SELECT * INTO lockout_record 
  FROM admin_account_lockouts 
  WHERE nickname = p_nickname;
  
  IF NOT FOUND THEN
    -- No lockout record found, account is not locked
    RETURN json_build_object(
      'is_locked', false,
      'failed_attempts', 0,
      'remaining_seconds', 0,
      'message', ''
    );
  END IF;
  
  -- Check if lockout has expired
  IF lockout_record.is_locked AND lockout_record.lockout_expires_at <= NOW() THEN
    -- Lockout has expired, unlock account but keep failed attempts
    UPDATE admin_account_lockouts 
    SET is_locked = false, 
        lockout_expires_at = NULL,
        updated_at = NOW()
    WHERE nickname = p_nickname
    RETURNING * INTO lockout_record;
  END IF;
  
  -- Return current status
  result := json_build_object(
    'is_locked', lockout_record.is_locked,
    'failed_attempts', lockout_record.failed_attempts,
    'remaining_seconds', 
      CASE 
        WHEN lockout_record.is_locked AND lockout_record.lockout_expires_at > NOW() THEN
          EXTRACT(EPOCH FROM (lockout_record.lockout_expires_at - NOW()))::integer
        ELSE 0
      END,
    'message',
      CASE 
        WHEN lockout_record.is_locked AND lockout_record.lockout_expires_at > NOW() THEN
          CASE 
            WHEN lockout_record.failed_attempts >= 9 THEN
              'Admin account locked for 15 minutes due to multiple failed attempts'
            WHEN lockout_record.failed_attempts >= 6 THEN
              'Admin account locked for 1 minute due to multiple failed attempts'
            WHEN lockout_record.failed_attempts >= 3 THEN
              'Admin account locked for 30 seconds due to multiple failed attempts'
            ELSE 'Admin account is locked'
          END
        ELSE ''
      END
  );
  
  RETURN result;
END;
$$;

-- Function to reset admin account lockout (on successful login)
CREATE OR REPLACE FUNCTION reset_admin_account_lockout(
  p_nickname text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  -- Delete the lockout record on successful login (same as user system)
  DELETE FROM admin_account_lockouts 
  WHERE nickname = p_nickname;
  
  result := json_build_object(
    'success', true,
    'message', 'Admin account lockout reset successfully'
  );
  
  RETURN result;
END;
$$;

-- Function to get admin lockout statistics (for monitoring)
CREATE OR REPLACE FUNCTION get_admin_lockout_statistics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stats json;
BEGIN
  SELECT json_build_object(
    'total_locked_accounts', (SELECT COUNT(*) FROM admin_account_lockouts WHERE is_locked = true),
    'total_accounts_with_failed_attempts', (SELECT COUNT(*) FROM admin_account_lockouts WHERE failed_attempts > 0),
    'accounts_locked_30s', (SELECT COUNT(*) FROM admin_account_lockouts WHERE is_locked = true AND failed_attempts >= 3 AND failed_attempts < 6),
    'accounts_locked_1m', (SELECT COUNT(*) FROM admin_account_lockouts WHERE is_locked = true AND failed_attempts >= 6 AND failed_attempts < 9),
    'accounts_locked_15m', (SELECT COUNT(*) FROM admin_account_lockouts WHERE is_locked = true AND failed_attempts >= 9),
    'last_updated', NOW()
  ) INTO stats;
  
  RETURN stats;
END;
$$;
