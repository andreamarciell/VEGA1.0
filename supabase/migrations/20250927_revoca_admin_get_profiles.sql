-- Revoca esecuzione funzione admin_get_profiles da anon
-- Migration: 20250927_revoca_admin_get_profiles.sql
-- Description: Revoke execution of admin_get_profiles function from public/anon roles

-- Revoca esecuzione a ruoli pubblici
REVOKE EXECUTE ON FUNCTION public.admin_get_profiles() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_get_profiles() FROM anon;

-- (opzionale ma consigliato) limita a un ruolo applicativo server-side
-- GRANT EXECUTE ON FUNCTION public.admin_get_profiles() TO service_role;

-- Facoltativo: se NON vuoi più esporla, valuta direttamente:
-- DROP FUNCTION IF EXISTS public.admin_get_profiles();

-- Log the security change
DO $$
BEGIN
  RAISE NOTICE 'Security hardening: admin_get_profiles function access revoked from public/anon roles';
END $$;
