-- Add tenant_code to profiles table
-- This links platform users to their tenant organization

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS tenant_code TEXT;

-- Create index for tenant_code lookups
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_code 
ON public.profiles(tenant_code) 
WHERE tenant_code IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.profiles.tenant_code IS 'Tenant identifier code for this user profile. Links user to their organization/client.';
