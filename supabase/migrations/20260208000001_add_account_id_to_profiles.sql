-- Add account_id to profiles table
-- This links platform users (profiles.user_id) to their gaming account_id
-- Allows users to automatically access their data without manually entering account_id

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS account_id TEXT;

-- Create index for account_id lookups
CREATE INDEX IF NOT EXISTS idx_profiles_account_id 
ON public.profiles(account_id) 
WHERE account_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.profiles.account_id IS 'Gaming platform account_id associated with this user profile';
