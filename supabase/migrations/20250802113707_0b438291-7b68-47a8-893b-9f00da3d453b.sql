-- Fix security issues: Set search_path for functions to prevent potential security vulnerabilities

-- Update existing functions to set search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'username');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_login_attempt(user_email text, success boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_profile RECORD;
  max_attempts INTEGER := 5;
  lockout_duration INTERVAL := '15 minutes';
BEGIN
  -- Get user profile
  SELECT p.* INTO user_profile
  FROM public.profiles p
  JOIN auth.users u ON p.user_id = u.id
  WHERE u.email = user_email;
  
  IF user_profile.user_id IS NOT NULL THEN
    IF success THEN
      -- Reset login attempts on successful login
      UPDATE public.profiles 
      SET login_attempts = 0, 
          last_login_attempt = now(),
          account_locked_until = NULL
      WHERE user_id = user_profile.user_id;
    ELSE
      -- Increment failed attempts
      UPDATE public.profiles 
      SET login_attempts = COALESCE(login_attempts, 0) + 1,
          last_login_attempt = now(),
          account_locked_until = CASE 
            WHEN COALESCE(login_attempts, 0) + 1 >= max_attempts 
            THEN now() + lockout_duration 
            ELSE account_locked_until 
          END
      WHERE user_id = user_profile.user_id;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_analytics()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM public.profiles),
    'users_created_today', (SELECT COUNT(*) FROM public.profiles WHERE created_at::date = CURRENT_DATE),
    'users_created_this_week', (SELECT COUNT(*) FROM public.profiles WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
    'users_created_this_month', (SELECT COUNT(*) FROM public.profiles WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'),
    'users_with_failed_logins', (SELECT COUNT(*) FROM public.profiles WHERE login_attempts > 0),
    'locked_accounts', (SELECT COUNT(*) FROM public.profiles WHERE account_locked_until > now())
  ) INTO result;
  
  RETURN result;
END;
$$;