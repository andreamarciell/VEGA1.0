-- Add RLS policies to allow insert and delete on admin_sessions
-- Allows application layer to create and delete sessions.
CREATE POLICY "Admin sessions can be inserted"
ON public.admin_sessions
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admin sessions can be deleted"
ON public.admin_sessions
FOR DELETE
USING (true);

-- Ensure admin_users can be updated (last_login)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE polname = 'Admin users can be updated'
      AND schemaname = 'public'
      AND tablename = 'admin_users'
  ) THEN
    CREATE POLICY "Admin users can be updated"
    ON public.admin_users
    FOR UPDATE
    USING (true)
    WITH CHECK (true);
  END IF;
END;
$$ LANGUAGE plpgsql;
