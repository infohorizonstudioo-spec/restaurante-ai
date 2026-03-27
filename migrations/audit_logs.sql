-- ══════════════════════════════════════════════════════════════════════
-- RESERVO.AI — Audit Logs Table
-- Immutable audit trail for security & business events.
-- Run: supabase db push or paste in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS audit_logs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  timestamptz DEFAULT now() NOT NULL,
  action      text NOT NULL,                            -- e.g. 'auth.login', 'reservation.create'
  actor_id    text NOT NULL DEFAULT 'system',           -- user id, 'system', 'agent'
  tenant_id   uuid REFERENCES tenants(id) ON DELETE SET NULL,
  target_type text,                                     -- 'reservation', 'customer', 'user'
  target_id   text,                                     -- UUID of affected entity
  metadata    jsonb DEFAULT '{}'::jsonb,                -- arbitrary context
  ip          text,                                     -- client IP
  user_agent  text,                                     -- browser/client
  severity    text DEFAULT 'info' CHECK (severity IN ('info', 'warn', 'critical'))
);

-- Indices for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity) WHERE severity != 'info';
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- RLS: only service role can write, tenant admins can read their own
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_read_own ON audit_logs
  FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  ));

-- No INSERT/UPDATE/DELETE policies for anon/authenticated = immutable from client side
-- Only service_role can insert (which is what the audit-log.ts module uses)

-- Auto-cleanup: keep 90 days of logs (run via cron)
-- DELETE FROM audit_logs WHERE created_at < now() - interval '90 days';

COMMENT ON TABLE audit_logs IS 'Immutable audit trail for security and business events';
