-- Tabella per loggare tutte le attività sui player: commenti, cambi di status, re-trigger automatici
CREATE TABLE IF NOT EXISTS public.player_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id TEXT NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('comment', 'status_change', 'auto_retrigger', 'attachment')),
  content TEXT,
  old_status TEXT,
  new_status TEXT,
  created_by TEXT, -- username o user_id
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB -- per dati aggiuntivi (es. file attachments)
);

-- Indici per ricerca rapida
CREATE INDEX IF NOT EXISTS idx_player_activity_log_account_id 
ON public.player_activity_log(account_id);

CREATE INDEX IF NOT EXISTS idx_player_activity_log_created_at 
ON public.player_activity_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_player_activity_log_activity_type 
ON public.player_activity_log(activity_type);

-- RLS
ALTER TABLE public.player_activity_log ENABLE ROW LEVEL SECURITY;

-- Policy: allow all operations (gestito a livello applicazione)
CREATE POLICY "Allow all operations on player activity log" 
ON public.player_activity_log 
FOR ALL 
USING (true)
WITH CHECK (true);
