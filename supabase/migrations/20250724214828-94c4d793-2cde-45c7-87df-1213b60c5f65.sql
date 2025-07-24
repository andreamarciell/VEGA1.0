-- Create profiles table for additional user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  login_attempts INTEGER DEFAULT 0,
  last_login_attempt TIMESTAMP WITH TIME ZONE,
  account_locked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle login attempts and account lockout
CREATE OR REPLACE FUNCTION public.handle_login_attempt(user_email text, success boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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
  
  IF user_profile.id IS NOT NULL THEN
    IF success THEN
      -- Reset login attempts on successful login
      UPDATE public.profiles 
      SET login_attempts = 0, 
          last_login_attempt = now(),
          account_locked_until = NULL
      WHERE id = user_profile.id;
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
      WHERE id = user_profile.id;
    END IF;
  END IF;
END;
$$;

-- Create function to check if account is locked
CREATE OR REPLACE FUNCTION public.is_account_locked(user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_profile RECORD;
BEGIN
  SELECT p.* INTO user_profile
  FROM public.profiles p
  JOIN auth.users u ON p.user_id = u.id
  WHERE u.email = user_email;
  
  IF user_profile.id IS NOT NULL THEN
    RETURN user_profile.account_locked_until IS NOT NULL AND user_profile.account_locked_until > now();
  END IF;
  
  RETURN false;
END;
$$;

-- Create trigger to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'username');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();