-- ================================================================
-- RESERVO.AI — Business Brain: Enhanced Learning System
-- Fecha: 2026-03-27
--
-- Mejora el sistema de aprendizaje del agente para que cada negocio
-- tenga su propia "memoria" aprendida de interacciones.
-- ================================================================

-- ── 1. Ampliar business_memory con tipos más específicos ────────
-- Añadir memory_type si no tiene restricción (para categorizar mejor)
DO $$ BEGIN
  -- Asegurar que memory_type tiene los tipos que necesitamos
  ALTER TABLE business_memory
    ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS last_reinforced_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS reinforcement_count INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS related_customer_id UUID REFERENCES customers(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

COMMENT ON COLUMN business_memory.source IS 'Origen: manual, post_call, pattern_detection, feedback';
COMMENT ON COLUMN business_memory.last_reinforced_at IS 'Última vez que se confirmó/reforzó esta memoria';
COMMENT ON COLUMN business_memory.reinforcement_count IS 'Cuántas veces se ha visto este patrón';

-- ── 2. Tabla de patrones de interacción por negocio ─────────────
CREATE TABLE IF NOT EXISTS interaction_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL, -- 'peak_hour', 'common_request', 'cancellation_pattern', 'group_size', 'seasonal', 'day_preference'
  pattern_key TEXT NOT NULL,  -- e.g., 'friday_20:00', 'birthday_groups', 'summer_terrace'
  pattern_value JSONB NOT NULL DEFAULT '{}',
  occurrences INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.5,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, pattern_type, pattern_key)
);

ALTER TABLE interaction_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenants see own patterns" ON interaction_patterns
  FOR ALL USING (tenant_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_interaction_patterns_tenant
  ON interaction_patterns(tenant_id, active, confidence DESC);

COMMENT ON TABLE interaction_patterns IS 'Patrones aprendidos de las interacciones de cada negocio';

-- ── 3. Tabla de personalidad aprendida del negocio ──────────────
CREATE TABLE IF NOT EXISTS business_personality (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trait_type TEXT NOT NULL, -- 'communication_style', 'common_objection', 'upsell_opportunity', 'pain_point', 'strength'
  trait_key TEXT NOT NULL,
  trait_value TEXT NOT NULL,
  learned_from TEXT, -- 'calls', 'feedback', 'reviews', 'manual'
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.5,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, trait_type, trait_key)
);

ALTER TABLE business_personality ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenants see own personality" ON business_personality
  FOR ALL USING (tenant_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_business_personality_tenant
  ON business_personality(tenant_id, active, confidence DESC);

COMMENT ON TABLE business_personality IS 'Rasgos aprendidos de cada negocio específico';

-- ── 4. Canal preferido por cliente ──────────────────────────────
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS interaction_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_interaction_channel TEXT,
  ADD COLUMN IF NOT EXISTS personality_notes TEXT;

-- ── 5. Métricas de llamada para aprendizaje ─────────────────────
ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS response_quality TEXT, -- 'excellent', 'good', 'needs_improvement', 'failed'
  ADD COLUMN IF NOT EXISTS customer_sentiment TEXT, -- 'positive', 'neutral', 'negative'
  ADD COLUMN IF NOT EXISTS patterns_detected TEXT[]; -- patrones detectados en esta llamada

-- ── 6. Función para reforzar un patrón (upsert + incremento) ────
CREATE OR REPLACE FUNCTION reinforce_pattern(
  p_tenant_id UUID,
  p_pattern_type TEXT,
  p_pattern_key TEXT,
  p_pattern_value JSONB DEFAULT '{}'
) RETURNS void AS $$
BEGIN
  INSERT INTO interaction_patterns (tenant_id, pattern_type, pattern_key, pattern_value, occurrences, confidence)
  VALUES (p_tenant_id, p_pattern_type, p_pattern_key, p_pattern_value, 1, 0.5)
  ON CONFLICT (tenant_id, pattern_type, pattern_key)
  DO UPDATE SET
    occurrences = interaction_patterns.occurrences + 1,
    last_seen_at = NOW(),
    pattern_value = COALESCE(p_pattern_value, interaction_patterns.pattern_value),
    -- Confianza sube con cada observación: 0.5 → 0.6 → 0.7 → 0.8 → 0.85 → 0.9 (max)
    confidence = LEAST(0.9, interaction_patterns.confidence + (0.9 - interaction_patterns.confidence) * 0.15);
END;
$$ LANGUAGE plpgsql;

-- ── 7. Función para reforzar memoria de negocio ─────────────────
CREATE OR REPLACE FUNCTION reinforce_memory(
  p_tenant_id UUID,
  p_content TEXT,
  p_memory_type TEXT DEFAULT 'general'
) RETURNS void AS $$
BEGIN
  UPDATE business_memory
  SET
    last_reinforced_at = NOW(),
    reinforcement_count = COALESCE(reinforcement_count, 0) + 1,
    confidence = LEAST(0.95, COALESCE(confidence, 0.5) + (0.95 - COALESCE(confidence, 0.5)) * 0.1)
  WHERE tenant_id = p_tenant_id
    AND memory_type = p_memory_type
    AND content ILIKE '%' || LEFT(p_content, 50) || '%'
    AND active = TRUE;

  -- Si no actualizó nada, crear nueva
  IF NOT FOUND THEN
    INSERT INTO business_memory (tenant_id, content, memory_type, confidence, source)
    VALUES (p_tenant_id, p_content, p_memory_type, 0.5, 'post_call')
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql;
