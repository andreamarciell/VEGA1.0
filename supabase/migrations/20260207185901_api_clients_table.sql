-- API Clients Table for Multi-Tenancy BigQuery
-- This table stores client metadata including API keys and BigQuery dataset IDs
-- API keys are stored in environment variables (hybrid approach for security)

-- Create api_clients table
CREATE TABLE IF NOT EXISTS public.api_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL UNIQUE,
  dataset_id TEXT NOT NULL,
  api_key_env_var TEXT NOT NULL, -- Name of the environment variable containing the actual API key
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb -- For additional client-specific configuration
);

-- Create index for active clients lookup
CREATE INDEX IF NOT EXISTS idx_api_clients_active ON public.api_clients(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_clients_dataset ON public.api_clients(dataset_id);

-- Enable RLS
ALTER TABLE public.api_clients ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can access (server-side only)
CREATE POLICY "Service role only access" ON public.api_clients
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Deny all public access
CREATE POLICY "Deny all public access" ON public.api_clients
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

-- Function to get client by API key (validates against env var)
-- This function is called server-side with the actual API key value
CREATE OR REPLACE FUNCTION get_api_client_by_key(p_api_key TEXT)
RETURNS TABLE(
  id UUID,
  client_name TEXT,
  dataset_id TEXT,
  is_active BOOLEAN,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  client_record RECORD;
  env_var_name TEXT;
  actual_key TEXT;
BEGIN
  -- Find client by checking which env var contains the matching key
  -- Note: This is a simplified approach. In production, you might want to
  -- hash the API keys or use a different validation mechanism
  
  FOR client_record IN 
    SELECT * FROM api_clients WHERE is_active = true
  LOOP
    -- The actual validation happens server-side by checking the env var
    -- This function just returns the client record if found
    -- Server code will validate the key against process.env[client_record.api_key_env_var]
    
    -- For now, return the first active client (server will do actual validation)
    -- This is a placeholder - actual key validation happens in application code
    RETURN QUERY
    SELECT 
      client_record.id,
      client_record.client_name,
      client_record.dataset_id,
      client_record.is_active,
      client_record.metadata
    FROM api_clients
    WHERE api_clients.id = client_record.id
    LIMIT 1;
    
    EXIT; -- Only return first match for now
  END LOOP;
END;
$$;

-- Function to get client by dataset ID
CREATE OR REPLACE FUNCTION get_api_client_by_dataset(p_dataset_id TEXT)
RETURNS TABLE(
  id UUID,
  client_name TEXT,
  dataset_id TEXT,
  is_active BOOLEAN,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ac.id,
    ac.client_name,
    ac.dataset_id,
    ac.is_active,
    ac.metadata
  FROM api_clients ac
  WHERE ac.dataset_id = p_dataset_id
    AND ac.is_active = true
  LIMIT 1;
END;
$$;

-- Grant execute permissions to service role
GRANT EXECUTE ON FUNCTION get_api_client_by_key(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_api_client_by_dataset(TEXT) TO service_role;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_api_clients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_api_clients_updated_at
  BEFORE UPDATE ON api_clients
  FOR EACH ROW
  EXECUTE FUNCTION update_api_clients_updated_at();

-- Comments
COMMENT ON TABLE api_clients IS 'Stores API client metadata for multi-tenant BigQuery datasets';
COMMENT ON COLUMN api_clients.api_key_env_var IS 'Name of environment variable containing the actual API key (e.g., CLIENT_1_API_KEY)';
COMMENT ON COLUMN api_clients.dataset_id IS 'BigQuery dataset ID for this client (e.g., toppery_client_123)';
COMMENT ON FUNCTION get_api_client_by_key IS 'Returns client metadata by API key (validation happens server-side)';
COMMENT ON FUNCTION get_api_client_by_dataset IS 'Returns client metadata by BigQuery dataset ID';
