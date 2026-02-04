-- Aggiunge campo status per categorizzare manualmente i giocatori
ALTER TABLE public.player_risk_scores 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' 
CHECK (status IN ('active', 'reviewed', 'escalated', 'archived'));

-- Indice per ricerca rapida per status
CREATE INDEX IF NOT EXISTS idx_player_risk_scores_status 
ON public.player_risk_scores(status);
