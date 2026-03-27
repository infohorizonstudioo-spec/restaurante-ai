-- ─────────────────────────────────────────────────────────────
-- RESERVO.AI — Voice Multilanguage Support
-- Adds language detection and client type classification to calls
-- ─────────────────────────────────────────────────────────────

-- Add language and client type columns to calls table
ALTER TABLE calls ADD COLUMN IF NOT EXISTS detected_language TEXT DEFAULT NULL;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS client_type TEXT DEFAULT NULL;

-- Index for querying by language (analytics, repeat callers)
CREATE INDEX IF NOT EXISTS idx_calls_detected_language ON calls(tenant_id, detected_language) WHERE detected_language IS NOT NULL;

-- Index for querying by client type
CREATE INDEX IF NOT EXISTS idx_calls_client_type ON calls(tenant_id, client_type) WHERE client_type IS NOT NULL;

-- Add language preference to customers table for SMS routing
ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'es';

-- Comment
COMMENT ON COLUMN calls.detected_language IS 'ISO 639-1 language code detected during call (es, en, fr, de, etc.)';
COMMENT ON COLUMN calls.client_type IS 'Client classification: local or extranjero';
COMMENT ON COLUMN customers.preferred_language IS 'Preferred language for SMS/email communications';
