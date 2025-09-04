-- Enhanced Rate Limiting with Progressive Delays
-- This migration improves security by adding progressive delay functionality

-- Add progressive delay tracking to login_attempts table
ALTER TABLE login_attempts ADD COLUMN IF NOT EXISTS delay_until TIMESTAMPTZ;
ALTER TABLE login_attempts ADD COLUMN IF NOT EXISTS attempt_count_in_window INTEGER DEFAULT 1;

-- Enhanced rate limit check with progressive delays
CREATE OR REPLACE FUNCTION check_rate_limit_with_delays(
  p_ip_address INET,
  p_window_minutes INT,
  p_max_attempts INT
)
RETURNS TABLE(allowed BOOLEAN, remaining_attempts INT, reset_time TIMESTAMPTZ, delay_seconds INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_window_start TIMESTAMPTZ := NOW() - (p_window_minutes || ' minutes')::INTERVAL;
  v_attempt_count INT;
  v_reset_time TIMESTAMPTZ;
  v_last_attempt TIMESTAMPTZ;
  v_delay_seconds INT := 0;
  v_progressive_delay INT;
BEGIN
  -- Get attempt count in current window
  SELECT COUNT(*), MAX(attempt_time)
  INTO v_attempt_count, v_last_attempt
  FROM login_attempts
  WHERE ip_address = p_ip_address
    AND attempt_time >= v_window_start;

  -- Calculate progressive delay based on failed attempts
  IF v_attempt_count >= 1 THEN
    -- Progressive delays: 1st fail = 30s, 2nd = 60s, 3rd = 300s (5min), 4th+ = 900s (15min)
    CASE 
      WHEN v_attempt_count = 1 THEN v_progressive_delay := 30;   -- 30 seconds
      WHEN v_attempt_count = 2 THEN v_progressive_delay := 60;   -- 1 minute  
      WHEN v_attempt_count = 3 THEN v_progressive_delay := 300;  -- 5 minutes
      ELSE v_progressive_delay := 900;                           -- 15 minutes
    END CASE;
    
    -- Check if we're still in delay period from last attempt
    IF v_last_attempt + (v_progressive_delay || ' seconds')::INTERVAL > NOW() THEN
      v_delay_seconds := EXTRACT(EPOCH FROM (v_last_attempt + (v_progressive_delay || ' seconds')::INTERVAL - NOW()))::INT;
    END IF;
  END IF;

  -- Check if attempts exceed limit
  IF v_attempt_count >= p_max_attempts THEN
    -- Calculate when the next attempt will be allowed
    SELECT MIN(attempt_time) + (p_window_minutes || ' minutes')::INTERVAL
    INTO v_reset_time
    FROM login_attempts
    WHERE ip_address = p_ip_address
      AND attempt_time >= v_window_start;

    RETURN QUERY SELECT FALSE, 0, v_reset_time, GREATEST(v_delay_seconds, 
      EXTRACT(EPOCH FROM (v_reset_time - NOW()))::INT);
  ELSE
    -- Still within limit, but may have progressive delay
    RETURN QUERY SELECT 
      (v_delay_seconds = 0), -- Only allowed if no delay
      p_max_attempts - v_attempt_count, 
      NOW() + (p_window_minutes || ' minutes')::INTERVAL,
      v_delay_seconds;
  END IF;
END;
$$;

-- Enhanced login attempt recording with delay tracking
CREATE OR REPLACE FUNCTION record_login_attempt_with_delay(
  p_ip_address INET,
  p_user_agent TEXT,
  p_username TEXT DEFAULT NULL,
  p_success BOOLEAN DEFAULT FALSE,
  p_error_type TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_delay_until TIMESTAMPTZ;
  v_attempt_count INT;
BEGIN
  -- Calculate delay until next attempt for failed logins
  IF NOT p_success THEN
    -- Count recent attempts from this IP
    SELECT COUNT(*) INTO v_attempt_count
    FROM login_attempts
    WHERE ip_address = p_ip_address
      AND attempt_time >= NOW() - INTERVAL '5 minutes'
      AND success = FALSE;
    
    -- Set progressive delay
    CASE 
      WHEN v_attempt_count = 0 THEN v_delay_until := NOW() + INTERVAL '30 seconds';
      WHEN v_attempt_count = 1 THEN v_delay_until := NOW() + INTERVAL '1 minute';  
      WHEN v_attempt_count = 2 THEN v_delay_until := NOW() + INTERVAL '5 minutes';
      ELSE v_delay_until := NOW() + INTERVAL '15 minutes';
    END CASE;
  END IF;

  INSERT INTO login_attempts (
    ip_address, 
    user_agent, 
    username, 
    success, 
    error_type,
    delay_until,
    attempt_count_in_window
  )
  VALUES (
    p_ip_address, 
    p_user_agent, 
    p_username, 
    p_success, 
    p_error_type,
    v_delay_until,
    v_attempt_count + 1
  );
END;
$$;

-- Create index for delay_until queries
CREATE INDEX IF NOT EXISTS idx_login_attempts_delay_until ON login_attempts(ip_address, delay_until);

-- Enhanced cleanup function that respects delays
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only delete attempts older than 24 hours AND past their delay period
  DELETE FROM login_attempts
  WHERE attempt_time < NOW() - INTERVAL '24 hours'
    AND (delay_until IS NULL OR delay_until < NOW());
END;
$$;
