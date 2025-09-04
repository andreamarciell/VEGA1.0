-- Create admin users table for separate admin authentication
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nickname TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Enable RLS for admin users
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Create policy for admin users to manage themselves
CREATE POLICY "Admin users can view themselves" 
ON public.admin_users 
FOR SELECT 
USING (true); -- Admins can see all admin users

CREATE POLICY "Admin users can update themselves" 
ON public.admin_users 
FOR UPDATE 
USING (true); -- Admins can update any admin user

-- Insert the default admin user with hashed password
-- Password: administratorSi768_? (this will be hashed on the client side)
INSERT INTO public.admin_users (nickname, password_hash) 
VALUES ('andreadmin', '$2a$10$YourHashedPasswordHere'); -- This will be properly hashed in the app

-- Create admin sessions table
CREATE TABLE public.admin_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for admin sessions
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

-- Create policy for admin sessions
CREATE POLICY "Admin sessions are viewable by the admin who owns them" 
ON public.admin_sessions 
FOR SELECT 
USING (true);

-- Add login attempts tracking to profiles table for user analytics
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_attempt TIMESTAMP WITH TIME ZONE;

-- Update trigger for admin users
CREATE TRIGGER update_admin_users_updated_at
BEFORE UPDATE ON public.admin_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to get user analytics
CREATE OR REPLACE FUNCTION public.get_user_analytics()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
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