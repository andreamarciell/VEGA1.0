-- Aggiunge campo last_action_at per tracciare l'ultima azione manuale
-- quando un account viene spostato in reviewed/escalated/archived
ALTER TABLE public.player_risk_scores 
ADD COLUMN IF NOT EXISTS last_action_at TIMESTAMP WITH TIME ZONE;

-- Indice per ricerca rapida
CREATE INDEX IF NOT EXISTS idx_player_risk_scores_last_action_at 
ON public.player_risk_scores(last_action_at);
