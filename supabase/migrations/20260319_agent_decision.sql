-- ============================================================
-- RESERVO.AI — Motor de Decisión del Agente
-- Migración: tablas de reglas, feedback y columnas de decisión
-- ============================================================

-- 1. Columnas de decisión en calls (si no existen)
ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS decision_status     TEXT,
  ADD COLUMN IF NOT EXISTS decision_flags      TEXT[],
  ADD COLUMN IF NOT EXISTS decision_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS reasoning_label     TEXT;

-- 2. Reglas del negocio por tenant
CREATE TABLE IF NOT EXISTS business_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rules       JSONB NOT NULL DEFAULT '{
    "max_auto_party_size": 6,
    "special_requests_require_review": true,
    "allow_auto_cancellations": true,
    "offer_alternative_times": true,
    "min_confidence_to_confirm": 0.72
  }',
  patterns    JSONB NOT NULL DEFAULT '{
    "large_group": "pending_review",
    "birthday_requests": "pending_review",
    "allergy_notes": "pending_review",
    "table_specific": "pending_review",
    "accessibility": "pending_review"
  }',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- 3. Historial de feedback y correcciones manuales
CREATE TABLE IF NOT EXISTS agent_feedback (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  call_sid          TEXT NOT NULL,
  original_status   TEXT NOT NULL,
  corrected_status  TEXT NOT NULL,
  flags             TEXT[] DEFAULT '{}',
  intent            TEXT,
  note              TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas de patrones
CREATE INDEX IF NOT EXISTS idx_agent_feedback_tenant    ON agent_feedback(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_flags     ON agent_feedback USING GIN(flags);
CREATE INDEX IF NOT EXISTS idx_calls_decision_status    ON calls(tenant_id, decision_status);

-- RLS: solo el tenant puede ver sus reglas y feedback
ALTER TABLE business_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_feedback  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_rules" ON business_rules;
CREATE POLICY "tenant_rules" ON business_rules
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "tenant_feedback" ON agent_feedback;
CREATE POLICY "tenant_feedback" ON agent_feedback
  USING (tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

-- Service role bypasses RLS (para el backend)
CREATE POLICY "service_rules" ON business_rules
  USING (true)
  WITH CHECK (true);

-- Trigger para updated_at en business_rules
CREATE OR REPLACE FUNCTION update_business_rules_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_business_rules_updated ON business_rules;
CREATE TRIGGER trg_business_rules_updated
  BEFORE UPDATE ON business_rules
  FOR EACH ROW EXECUTE FUNCTION update_business_rules_timestamp();
