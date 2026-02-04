-- Aggiorna il constraint per includere high-risk e critical-risk
ALTER TABLE public.player_risk_scores 
DROP CONSTRAINT IF EXISTS player_risk_scores_status_check;

ALTER TABLE public.player_risk_scores 
ADD CONSTRAINT player_risk_scores_status_check 
CHECK (status IN ('active', 'reviewed', 'escalated', 'archived', 'high-risk', 'critical-risk'));
