-- ============================================================
-- RESERVO.AI — Multichannel Reception System
-- Migration: conversations, messages, channel_configs, usage_events
-- ============================================================

-- ── 1. CONVERSATIONS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  channel         TEXT NOT NULL CHECK (channel IN ('voice','whatsapp','sms','email')),
  direction       TEXT NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound','outbound')),
  external_id     TEXT,
  from_identifier TEXT,
  to_identifier   TEXT,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active','closed','pending','archived')),
  intent          TEXT,
  summary         TEXT,
  decision_status TEXT,
  decision_confidence NUMERIC(4,3),
  decision_flags  TEXT[],
  reasoning_label TEXT,
  metadata        JSONB DEFAULT '{}',
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant   ON conversations(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_customer ON conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_channel  ON conversations(tenant_id, channel);
CREATE INDEX IF NOT EXISTS idx_conversations_status   ON conversations(tenant_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_conversations_external ON conversations(external_id) WHERE external_id IS NOT NULL;

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_conversations" ON conversations
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ── 2. MESSAGES ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('customer','agent','system')),
  channel         TEXT NOT NULL CHECK (channel IN ('voice','whatsapp','sms','email')),
  content         TEXT NOT NULL,
  content_type    TEXT DEFAULT 'text' CHECK (content_type IN ('text','image','audio','document','location','template')),
  external_id     TEXT,
  status          TEXT DEFAULT 'sent' CHECK (status IN ('sent','delivered','read','failed','queued')),
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_tenant       ON messages(tenant_id, created_at DESC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_messages" ON messages
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ── 3. CHANNEL CONFIGS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.channel_configs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel           TEXT NOT NULL CHECK (channel IN ('whatsapp','email','sms','voice')),
  enabled           BOOLEAN DEFAULT false,
  auto_respond      BOOLEAN DEFAULT true,
  provider          TEXT,
  provider_config   JSONB DEFAULT '{}',
  response_tone     TEXT DEFAULT 'professional' CHECK (response_tone IN ('professional','friendly','casual')),
  greeting_message  TEXT,
  away_message      TEXT,
  max_response_time_seconds INTEGER DEFAULT 30,
  allowed_intents   TEXT[] DEFAULT ARRAY['reserva','consulta','cancelacion','pedido'],
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, channel)
);

ALTER TABLE channel_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_channel_configs" ON channel_configs
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ── 4. USAGE EVENTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usage_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  channel         TEXT NOT NULL,
  conversation_id UUID REFERENCES conversations(id),
  billable        BOOLEAN DEFAULT true,
  units           INTEGER DEFAULT 1,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_tenant_month ON usage_events(tenant_id, created_at);

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_usage" ON usage_events
  USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- ── 5. ALTER EXISTING TABLES ─────────────────────────────────

-- tenants: multichannel columns
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS whatsapp_phone       TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email_address         TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS channels_enabled      TEXT[] DEFAULT ARRAY['voice'];
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_messages_used    INTEGER DEFAULT 0;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_messages_included INTEGER DEFAULT 0;

-- customers: cross-channel identity
ALTER TABLE customers ADD COLUMN IF NOT EXISTS whatsapp_phone       TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_channel    TEXT DEFAULT 'voice';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS channel_identifiers  JSONB DEFAULT '{}';

-- calls: link to unified conversations
ALTER TABLE calls ADD COLUMN IF NOT EXISTS conversation_id_ref UUID REFERENCES conversations(id);

-- ── 6. BILLING RPC ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION process_billable_message(
  p_tenant_id UUID,
  p_channel TEXT,
  p_conversation_id UUID
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_plan TEXT;
  v_used INTEGER;
  v_included INTEGER;
BEGIN
  SELECT plan, plan_messages_used, plan_messages_included
  INTO v_plan, v_used, v_included
  FROM tenants WHERE id = p_tenant_id FOR UPDATE;

  INSERT INTO usage_events (tenant_id, event_type, channel, conversation_id)
  VALUES (p_tenant_id, p_channel || '_message', p_channel, p_conversation_id);

  UPDATE tenants SET plan_messages_used = plan_messages_used + 1 WHERE id = p_tenant_id;

  RETURN jsonb_build_object(
    'used', v_used + 1,
    'included', v_included,
    'over_limit', (v_used + 1) > v_included
  );
END;
$$;

-- ── 7. AUTO-CLOSE STALE CONVERSATIONS ────────────────────────
CREATE OR REPLACE FUNCTION close_stale_conversations()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE conversations
  SET status = 'closed', closed_at = NOW(), updated_at = NOW()
  WHERE status = 'active'
    AND last_message_at < NOW() - INTERVAL '24 hours';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
