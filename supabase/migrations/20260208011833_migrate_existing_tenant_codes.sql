-- Migration script to populate tenant_code for existing data
-- This script:
-- 1. Populates tenant_code in account_dataset_mapping from api_clients via api_client_id
-- 2. Populates tenant_code in profiles based on account_id -> account_dataset_mapping -> tenant_code

-- Step 1: Populate tenant_code in account_dataset_mapping from api_clients
-- This uses the api_client_id to get the tenant_code from api_clients table
UPDATE public.account_dataset_mapping adm
SET tenant_code = ac.tenant_code
FROM public.api_clients ac
WHERE adm.api_client_id = ac.id
  AND ac.tenant_code IS NOT NULL
  AND adm.tenant_code IS NULL;

-- Log how many mappings were updated
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM public.account_dataset_mapping
  WHERE tenant_code IS NOT NULL;
  
  RAISE NOTICE 'Updated % account_dataset_mapping records with tenant_code from api_clients', updated_count;
END $$;

-- Step 2: Populate tenant_code in profiles based on account_id
-- This links profiles to tenant_code via account_id -> account_dataset_mapping -> tenant_code
UPDATE public.profiles p
SET tenant_code = adm.tenant_code
FROM public.account_dataset_mapping adm
WHERE p.account_id = adm.account_id
  AND adm.tenant_code IS NOT NULL
  AND p.tenant_code IS NULL;

-- Log how many profiles were updated
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM public.profiles
  WHERE tenant_code IS NOT NULL;
  
  RAISE NOTICE 'Updated % profiles with tenant_code from account_dataset_mapping', updated_count;
END $$;

-- Step 3: For account_dataset_mapping records without api_client_id but with dataset_id,
-- try to find tenant_code by matching dataset_id with api_clients
UPDATE public.account_dataset_mapping adm
SET tenant_code = ac.tenant_code
FROM public.api_clients ac
WHERE adm.dataset_id = ac.dataset_id
  AND ac.tenant_code IS NOT NULL
  AND ac.is_active = true
  AND adm.tenant_code IS NULL
  AND adm.api_client_id IS NULL;

-- Log final counts
DO $$
DECLARE
  mapping_count INTEGER;
  profile_count INTEGER;
  mapping_without_tenant INTEGER;
  profile_without_tenant INTEGER;
BEGIN
  SELECT COUNT(*) INTO mapping_count FROM public.account_dataset_mapping WHERE tenant_code IS NOT NULL;
  SELECT COUNT(*) INTO profile_count FROM public.profiles WHERE tenant_code IS NOT NULL;
  SELECT COUNT(*) INTO mapping_without_tenant FROM public.account_dataset_mapping WHERE tenant_code IS NULL;
  SELECT COUNT(*) INTO profile_without_tenant FROM public.profiles WHERE tenant_code IS NULL;
  
  RAISE NOTICE 'Migration summary:';
  RAISE NOTICE '  account_dataset_mapping with tenant_code: %', mapping_count;
  RAISE NOTICE '  account_dataset_mapping without tenant_code: %', mapping_without_tenant;
  RAISE NOTICE '  profiles with tenant_code: %', profile_count;
  RAISE NOTICE '  profiles without tenant_code: %', profile_without_tenant;
  
  IF mapping_without_tenant > 0 THEN
    RAISE WARNING 'Some account_dataset_mapping records still lack tenant_code. These may need manual assignment.';
  END IF;
  
  IF profile_without_tenant > 0 THEN
    RAISE WARNING 'Some profiles still lack tenant_code. These may need manual assignment or account_id association.';
  END IF;
END $$;

-- Add comment explaining the migration
COMMENT ON COLUMN public.account_dataset_mapping.tenant_code IS 'Tenant identifier code. Populated from api_clients via api_client_id or dataset_id matching.';
COMMENT ON COLUMN public.profiles.tenant_code IS 'Tenant identifier code. Populated from account_dataset_mapping based on account_id association.';
