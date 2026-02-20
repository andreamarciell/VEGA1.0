-- Run this migration against the master database (vega_master).
-- Adds enabled_features JSONB to tenants for feature flagging (e.g. Text Wizard).
-- Usage: psql $MASTER_DB_URL -f scripts/master/001_add_enabled_features_to_tenants.sql

ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS enabled_features JSONB NOT NULL DEFAULT '{"text_wizard": false}';

COMMENT ON COLUMN tenants.enabled_features IS 'Feature flags per tenant. Example: {"text_wizard": true}';
