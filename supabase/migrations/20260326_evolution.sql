-- ═══════════════════════════════════════════════════════════
-- RESERVO.AI Evolution Migration
-- Phase 1: Message Intelligence + Escalation
-- Phase 2: Summaries + Alert Rules
-- Phase 3: Configurable Reminders
-- Phase 4: Visual Editor (rotation)
-- ═══════════════════════════════════════════════════════════

-- ── Phase 1: Message Intelligence ──────────────────────────
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS priority VARCHAR(20);
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS escalated_reason TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS classification JSONB;

-- ── Phase 2A: Summaries ────────────────────────────────────
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS summary_data JSONB;

CREATE TABLE IF NOT EXISTS daily_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  channel_breakdown JSONB DEFAULT '{}',
  highlights JSONB DEFAULT '[]',
  pending_actions JSONB DEFAULT '[]',
  top_intents JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, date)
);

ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_summaries_tenant_isolation" ON daily_summaries
  FOR ALL USING (tenant_id = auth.uid()::uuid OR
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ── Phase 2B: Alert Rules ──────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  priority VARCHAR(20) DEFAULT 'info',
  channels JSONB DEFAULT '["in_app"]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, event_type)
);

ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alert_rules_tenant_isolation" ON alert_rules
  FOR ALL USING (tenant_id = auth.uid()::uuid OR
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ── Phase 3: Reminders ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS reminder_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  intervals JSONB DEFAULT '["24h"]',
  channel VARCHAR(20) DEFAULT 'sms',
  template_override TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reminder_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reminder_configs_tenant_isolation" ON reminder_configs
  FOR ALL USING (tenant_id = auth.uid()::uuid OR
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS scheduled_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reservation_id UUID NOT NULL,
  interval_key VARCHAR(20) NOT NULL,
  send_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  channel VARCHAR(20) DEFAULT 'sms',
  attempts JSONB DEFAULT '[]',
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(reservation_id, interval_key)
);

ALTER TABLE scheduled_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scheduled_reminders_tenant_isolation" ON scheduled_reminders
  FOR ALL USING (tenant_id = auth.uid()::uuid OR
    tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Index for cron efficiency: find due reminders quickly
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_due
  ON scheduled_reminders(send_at, status)
  WHERE status = 'pending';

-- Index for cleanup: find reminders by reservation
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_reservation
  ON scheduled_reminders(reservation_id);

-- ── Phase 4: Visual Editor ─────────────────────────────────
ALTER TABLE tables ADD COLUMN IF NOT EXISTS rotation FLOAT DEFAULT 0;

-- ── Indexes for query performance ──────────────────────────
CREATE INDEX IF NOT EXISTS idx_daily_summaries_tenant_date
  ON daily_summaries(tenant_id, date);

CREATE INDEX IF NOT EXISTS idx_alert_rules_tenant
  ON alert_rules(tenant_id);

CREATE INDEX IF NOT EXISTS idx_conversations_priority
  ON conversations(tenant_id, priority)
  WHERE priority IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_escalated
  ON conversations(tenant_id, status)
  WHERE status = 'escalated';
