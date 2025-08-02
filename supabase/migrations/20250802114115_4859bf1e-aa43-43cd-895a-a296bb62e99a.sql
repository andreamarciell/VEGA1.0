-- Update the admin user with proper password hash
-- First, remove the placeholder entry
DELETE FROM public.admin_users WHERE nickname = 'andreadmin';

-- The password will be hashed in the application code, so we'll insert a placeholder that will be updated
INSERT INTO public.admin_users (nickname, password_hash) 
VALUES ('andreadmin', 'placeholder_will_be_updated_by_app');