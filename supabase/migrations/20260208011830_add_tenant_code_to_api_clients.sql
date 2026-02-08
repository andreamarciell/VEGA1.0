-- Add tenant_code to api_clients table
-- This allows each API client to have a unique tenant identifier

ALTER TABLE public.api_clients 
ADD COLUMN IF NOT EXISTS tenant_code TEXT UNIQUE;

-- Create index for tenant_code lookups
CREATE INDEX IF NOT EXISTS idx_api_clients_tenant_code 
ON public.api_clients(tenant_code) 
WHERE tenant_code IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.api_clients.tenant_code IS 'Unique tenant identifier code for this API client (e.g., CLIENT_001, AZIENDA_X)';
