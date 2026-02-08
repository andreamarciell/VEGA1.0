-- Add tenant_code to account_dataset_mapping table
-- This allows filtering account_ids by tenant_code for multi-tenant queries

ALTER TABLE public.account_dataset_mapping 
ADD COLUMN IF NOT EXISTS tenant_code TEXT;

-- Create index for tenant_code lookups
CREATE INDEX IF NOT EXISTS idx_account_dataset_mapping_tenant_code 
ON public.account_dataset_mapping(tenant_code) 
WHERE tenant_code IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.account_dataset_mapping.tenant_code IS 'Tenant identifier code for this account_id. Populated from api_clients via api_client_id.';
