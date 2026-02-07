-- Account Dataset Mapping Table
-- Maps account_id to dataset_id for multi-tenant BigQuery queries
-- This allows the system to know which BigQuery dataset contains data for each account_id

CREATE TABLE IF NOT EXISTS public.account_dataset_mapping (
  account_id TEXT NOT NULL PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  api_client_id UUID REFERENCES public.api_clients(id),
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_account_dataset_mapping_dataset 
ON public.account_dataset_mapping(dataset_id);

CREATE INDEX IF NOT EXISTS idx_account_dataset_mapping_client 
ON public.account_dataset_mapping(api_client_id);

-- RLS: solo service role può accedere (server-side only)
ALTER TABLE public.account_dataset_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only access" 
ON public.account_dataset_mapping 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Deny all public access" 
ON public.account_dataset_mapping 
FOR ALL 
TO public 
USING (false) 
WITH CHECK (false);

-- Trigger per aggiornare last_updated_at
CREATE TRIGGER update_account_dataset_mapping_updated_at
BEFORE UPDATE ON public.account_dataset_mapping
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Comments
COMMENT ON TABLE public.account_dataset_mapping IS 'Maps account_id to BigQuery dataset_id for multi-tenant data queries';
COMMENT ON COLUMN public.account_dataset_mapping.account_id IS 'Account ID from the gaming platform';
COMMENT ON COLUMN public.account_dataset_mapping.dataset_id IS 'BigQuery dataset ID where this account data is stored';
COMMENT ON COLUMN public.account_dataset_mapping.api_client_id IS 'API client that owns this account data';
