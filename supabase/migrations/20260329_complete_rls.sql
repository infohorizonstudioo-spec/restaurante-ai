-- ================================================================
-- RESERVO.AI -- Complete RLS coverage for all tenant-scoped tables
-- Fecha: 2026-03-29
--
-- Ensures every table with tenant_id has:
--   1. RLS enabled
--   2. A tenant isolation policy (user can only see own tenant rows)
--   3. A service_role bypass policy (server-side operations)
--
-- Safe to re-run: uses DROP POLICY IF EXISTS before CREATE.
-- ================================================================

-- ── Helper: tenant isolation subquery ──────────────────────────
-- All user-facing policies use the same subquery:
--   tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())

-- ================================================================
-- 1. calls
-- ================================================================
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calls_tenant ON calls;
CREATE POLICY calls_tenant ON calls
  FOR ALL USING (
    tenant_id IN (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid())
  );

DROP POLICY IF EXISTS calls_service ON calls;
CREATE POLICY calls_service ON calls
  FOR ALL TO service_role USING (true);

-- ================================================================
-- 2. reservations
-- ================================================================
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reservations_tenant ON reservations;
CREATE POLICY reservations_tenant ON reservations
  FOR ALL USING (
    tenant_id IN (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid())
  );

DROP POLICY IF EXISTS reservations_service ON reservations;
CREATE POLICY reservations_service ON reservations
  FOR ALL TO service_role USING (true);

-- ================================================================
-- 3. order_events
-- ================================================================
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_events_tenant ON order_events;
CREATE POLICY order_events_tenant ON order_events
  FOR ALL USING (
    tenant_id IN (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid())
  );

DROP POLICY IF EXISTS order_events_service ON order_events;
CREATE POLICY order_events_service ON order_events
  FOR ALL TO service_role USING (true);

-- ================================================================
-- 4. customers
-- ================================================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customers_tenant ON customers;
CREATE POLICY customers_tenant ON customers
  FOR ALL USING (
    tenant_id IN (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid())
  );

DROP POLICY IF EXISTS customers_service ON customers;
CREATE POLICY customers_service ON customers
  FOR ALL TO service_role USING (true);

-- ================================================================
-- 5. notifications
-- ================================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_tenant ON notifications;
CREATE POLICY notifications_tenant ON notifications
  FOR ALL USING (
    tenant_id IN (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid())
  );

DROP POLICY IF EXISTS notifications_service ON notifications;
CREATE POLICY notifications_service ON notifications
  FOR ALL TO service_role USING (true);

-- ================================================================
-- 6. business_knowledge
-- ================================================================
ALTER TABLE business_knowledge ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_knowledge_tenant ON business_knowledge;
CREATE POLICY business_knowledge_tenant ON business_knowledge
  FOR ALL USING (
    tenant_id IN (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid())
  );

DROP POLICY IF EXISTS business_knowledge_service ON business_knowledge;
CREATE POLICY business_knowledge_service ON business_knowledge
  FOR ALL TO service_role USING (true);

-- ================================================================
-- 7. business_rules
-- ================================================================
ALTER TABLE business_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_rules_tenant ON business_rules;
CREATE POLICY business_rules_tenant ON business_rules
  FOR ALL USING (
    tenant_id IN (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid())
  );

DROP POLICY IF EXISTS business_rules_service ON business_rules;
CREATE POLICY business_rules_service ON business_rules
  FOR ALL TO service_role USING (true);

-- ================================================================
-- 8. business_memory
-- ================================================================
ALTER TABLE business_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_memory_tenant ON business_memory;
CREATE POLICY business_memory_tenant ON business_memory
  FOR ALL USING (
    tenant_id IN (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid())
  );

DROP POLICY IF EXISTS business_memory_service ON business_memory;
CREATE POLICY business_memory_service ON business_memory
  FOR ALL TO service_role USING (true);

-- ================================================================
-- 9. conversations
-- ================================================================
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conversations_tenant ON conversations;
CREATE POLICY conversations_tenant ON conversations
  FOR ALL USING (
    tenant_id IN (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid())
  );

DROP POLICY IF EXISTS conversations_service ON conversations;
CREATE POLICY conversations_service ON conversations
  FOR ALL TO service_role USING (true);

-- ================================================================
-- 10. messages
-- ================================================================
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS messages_tenant ON messages;
CREATE POLICY messages_tenant ON messages
  FOR ALL USING (
    tenant_id IN (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid())
  );

DROP POLICY IF EXISTS messages_service ON messages;
CREATE POLICY messages_service ON messages
  FOR ALL TO service_role USING (true);

-- ================================================================
-- Bonus: also cover tables that had RLS but no service_role bypass
-- ================================================================

-- agent_feedback (from 20260319 migration -- had tenant policy but no service bypass)
DROP POLICY IF EXISTS agent_feedback_service ON agent_feedback;
CREATE POLICY agent_feedback_service ON agent_feedback
  FOR ALL TO service_role USING (true);

-- interaction_patterns (from 20260327 -- had tenant policy but no service bypass)
DROP POLICY IF EXISTS interaction_patterns_service ON interaction_patterns;
CREATE POLICY interaction_patterns_service ON interaction_patterns
  FOR ALL TO service_role USING (true);

-- business_personality (from 20260327 -- had tenant policy but no service bypass)
DROP POLICY IF EXISTS business_personality_service ON business_personality;
CREATE POLICY business_personality_service ON business_personality
  FOR ALL TO service_role USING (true);

-- daily_summaries
DROP POLICY IF EXISTS daily_summaries_service ON daily_summaries;
CREATE POLICY daily_summaries_service ON daily_summaries
  FOR ALL TO service_role USING (true);

-- alert_rules
DROP POLICY IF EXISTS alert_rules_service ON alert_rules;
CREATE POLICY alert_rules_service ON alert_rules
  FOR ALL TO service_role USING (true);

-- reminder_configs
DROP POLICY IF EXISTS reminder_configs_service ON reminder_configs;
CREATE POLICY reminder_configs_service ON reminder_configs
  FOR ALL TO service_role USING (true);

-- scheduled_reminders
DROP POLICY IF EXISTS scheduled_reminders_service ON scheduled_reminders;
CREATE POLICY scheduled_reminders_service ON scheduled_reminders
  FOR ALL TO service_role USING (true);

-- usage_events
DROP POLICY IF EXISTS usage_events_service ON usage_events;
CREATE POLICY usage_events_service ON usage_events
  FOR ALL TO service_role USING (true);

-- channel_configs
DROP POLICY IF EXISTS channel_configs_service ON channel_configs;
CREATE POLICY channel_configs_service ON channel_configs
  FOR ALL TO service_role USING (true);

-- consultation_events (if exists)
DO $$ BEGIN
  ALTER TABLE consultation_events ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS consultation_events_tenant ON consultation_events';
  EXECUTE 'CREATE POLICY consultation_events_tenant ON consultation_events
    FOR ALL USING (
      tenant_id IN (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid())
    )';
  EXECUTE 'CREATE POLICY consultation_events_service ON consultation_events
    FOR ALL TO service_role USING (true)';
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
