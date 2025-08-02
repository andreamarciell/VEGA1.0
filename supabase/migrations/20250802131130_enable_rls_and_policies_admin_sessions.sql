
-- Enable RLS and add missing policies for admin_sessions / admin_users
-- Generated automatically to fix login issue (INSERT blocked by RLS)

-- admin_sessions ----------------------------------------------------------
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- policy for INSERT
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename  = 'admin_sessions'
          AND policyname = 'Admin sessions can be inserted'
    ) THEN
        EXECUTE '
        CREATE POLICY "Admin sessions can be inserted"
            ON public.admin_sessions
            FOR INSERT
            WITH CHECK (true);';
    END IF;

    -- policy for DELETE
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename  = 'admin_sessions'
          AND policyname = 'Admin sessions can be deleted'
    ) THEN
        EXECUTE '
        CREATE POLICY "Admin sessions can be deleted"
            ON public.admin_sessions
            FOR DELETE
            USING (true);';
    END IF;
END $$;

-- admin_users -------------------------------------------------------------
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename  = 'admin_users'
          AND policyname = 'Admin users can be updated'
    ) THEN
        EXECUTE '
        CREATE POLICY "Admin users can be updated"
            ON public.admin_users
            FOR UPDATE
            USING (true)
            WITH CHECK (true);';
    END IF;
END $$;
