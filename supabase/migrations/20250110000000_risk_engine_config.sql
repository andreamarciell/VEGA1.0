-- Create risk engine configuration table
CREATE TABLE IF NOT EXISTS public.risk_engine_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.risk_engine_config ENABLE ROW LEVEL SECURITY;

-- Policy: allow all reads/writes (in production, should verify admin)
-- For now, we'll use a more permissive policy since admin auth is handled at application level
CREATE POLICY "Allow all operations on risk config" 
ON public.risk_engine_config 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Insert default configurations
INSERT INTO public.risk_engine_config (config_key, config_value, description) VALUES
('volume_thresholds', '{"daily": 5000, "weekly": 10000, "monthly": 15000}', 'Soglie per volumi depositi/prelievi (in EUR)'),
('risk_motivations', '{
  "frazionate": {
    "name": "Rilevato structuring tramite operazioni frazionate.",
    "weight": "major",
    "enabled": true
  },
  "bonus_concentration": {
    "name": "Rilevata concentrazione di bonus.",
    "weight": "major",
    "threshold_percentage": 10,
    "enabled": true
  },
  "casino_live": {
    "name": "Rilevata attività significativa su casino live.",
    "weight": "minor",
    "threshold_percentage": 40,
    "enabled": true
  },
  "volumes_daily": {
    "name": "Rilevati volumi significativamente elevati su base giornaliera",
    "weight": "base",
    "enabled": true
  },
  "volumes_weekly": {
    "name": "Rilevati volumi significativamente elevati su base settimanale",
    "weight": "base",
    "enabled": true
  },
  "volumes_monthly": {
    "name": "Rilevati volumi significativamente elevati su base mensile",
    "weight": "base",
    "enabled": true
  }
}'::jsonb, 'Configurazione motivazioni di rischio'),
('risk_levels', '{
  "base_levels": {
    "monthly_exceeded": "High",
    "weekly_or_daily_exceeded": "Medium",
    "default": "Low"
  },
  "escalation_rules": {
    "Low": {
      "major_aggravants": "High",
      "minor_aggravants": "Medium"
    },
    "Medium": {
      "major_aggravants": "High"
    },
    "High": {
      "any_aggravants": "Elevato"
    }
  },
  "score_mapping": {
    "Elevato": 100,
    "High": 80,
    "Medium": 50,
    "Low": 20
  }
}'::jsonb, 'Configurazione livelli e escalation del rischio');

-- Trigger for updated_at
CREATE TRIGGER update_risk_engine_config_updated_at
BEFORE UPDATE ON public.risk_engine_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
