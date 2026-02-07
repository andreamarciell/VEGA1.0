-- Make api_client_id nullable in account_dataset_mapping
-- This allows the system to work with env vars-based multi-tenant without requiring api_clients table entries

ALTER TABLE public.account_dataset_mapping 
ALTER COLUMN api_client_id DROP NOT NULL;

-- Add comment explaining the change
COMMENT ON COLUMN public.account_dataset_mapping.api_client_id IS 'Optional reference to api_clients. Can be NULL when using env vars-based multi-tenant system.';
