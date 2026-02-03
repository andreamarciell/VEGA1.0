-- Tabella per salvare i risk scores calcolati periodicamente
CREATE TABLE IF NOT EXISTS public.player_risk_scores (
  account_id TEXT NOT NULL PRIMARY KEY,
  risk_score INTEGER NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('Low', 'Medium', 'High', 'Elevato')),
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indice per ricerca rapida
CREATE INDEX IF NOT EXISTS idx_player_risk_scores_level ON public.player_risk_scores(risk_level);
CREATE INDEX IF NOT EXISTS idx_player_risk_scores_updated_at ON public.player_risk_scores(updated_at);

-- RLS
ALTER TABLE public.player_risk_scores ENABLE ROW LEVEL SECURITY;

-- Policy: allow all reads/writes (gestito a livello applicazione)
CREATE POLICY "Allow all operations on player risk scores" 
ON public.player_risk_scores 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Trigger per updated_at
CREATE TRIGGER update_player_risk_scores_updated_at
BEFORE UPDATE ON public.player_risk_scores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
