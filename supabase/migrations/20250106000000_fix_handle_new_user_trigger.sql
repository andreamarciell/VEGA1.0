-- Fix handle_new_user trigger to prevent duplicate profile creation during password reset
-- This addresses the issue where password reset operations inadvertently create new accounts

-- Create an improved trigger function that prevents duplicate profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = ''
AS $$
BEGIN
  -- Only create a profile if one doesn't already exist
  -- This prevents duplicate profiles during password reset operations
  INSERT INTO public.profiles (user_id, username)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'username')
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;
