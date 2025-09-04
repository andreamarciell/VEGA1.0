# Password Reset Fix Summary

## Issue Description
The forgot password functionality was creating new user accounts (like "test2") instead of updating the password for existing users. This was happening because of the `handle_new_user` database trigger.

## Root Cause
The `handle_new_user` trigger function was firing on every INSERT to the `auth.users` table, including internal operations performed by Supabase during password reset flows. The trigger was attempting to create new profiles without checking if a profile already existed for the user.

## The Fix
Updated the `handle_new_user` trigger function to include `ON CONFLICT (user_id) DO NOTHING` clause. This prevents duplicate profile creation when the trigger fires during password reset operations.

### Before:
```sql
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
```

### After:
```sql
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
```

## How to Apply the Fix

### Option 1: Via Migration
Run the migration file: `supabase/migrations/20250106000000_fix_handle_new_user_trigger.sql`

### Option 2: Manual SQL (Recommended)
1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Run the contents of `fix_password_reset_manually.sql`

## Testing the Fix
1. Create a test user account
2. Use the forgot password functionality 
3. Verify that no duplicate accounts are created
4. Confirm that the password is successfully updated for the existing user

## Files Modified
- `supabase/migrations/20250106000000_fix_handle_new_user_trigger.sql` - New migration
- `fix_password_reset_manually.sql` - Manual fix SQL script

## Current Status
- ✅ Issue identified and root cause found
- ✅ Fix implemented in migration files
- ✅ Manual fix script created
- ⏳ Testing required to confirm fix works correctly
- ⏳ Apply fix to production database

The password reset functionality should now work correctly without creating duplicate user accounts.
