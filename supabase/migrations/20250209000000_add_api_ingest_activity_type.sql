-- Aggiunge il tipo 'api_ingest' alla lista di activity_type consentiti
-- per supportare il logging delle chiamate API di ingestTransactions

-- Rimuove il constraint esistente
ALTER TABLE public.player_activity_log 
DROP CONSTRAINT IF EXISTS player_activity_log_activity_type_check;

-- Aggiunge il nuovo constraint con 'api_ingest' incluso
ALTER TABLE public.player_activity_log 
ADD CONSTRAINT player_activity_log_activity_type_check 
CHECK (activity_type IN ('comment', 'status_change', 'auto_retrigger', 'attachment', 'api_ingest'));
