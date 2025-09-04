-- Drop the old lockout function with 3 parameters to avoid conflicts
-- This will force the system to use the new single-parameter version

-- Drop the old function that has the wrong signature
DROP FUNCTION IF EXISTS record_failed_login_attempt(text, text, text);

-- Ensure the new function is the only one available
-- (The new function with single parameter should already exist from previous migration)
