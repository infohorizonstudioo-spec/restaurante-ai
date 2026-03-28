-- ============================================================
-- RESERVO.AI — Customer Memory & Intelligence System
-- Memoria viva, útil y operativa por cliente
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. CUSTOMER MEMORY — Memorias individuales con peso/confianza
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_memory (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Tipo de memoria
  memory_type   TEXT NOT NULL CHECK (memory_type IN (
    'preference',      -- preferencias (mesa terraza, horario tarde, etc.)
    'behavior',        -- patrones de comportamiento (llega tarde, cambia citas)
    'relationship',    -- relación con el negocio (VIP, habitual, problemático)
    'context',         -- contexto personal (cumpleaños, alergias, mascota)
    'interaction',     -- resumen de interacciones pasadas
    'suggestion',      -- sugerencias generadas por el sistema
    'alert',           -- alertas internas para el negocio
    'feedback'         -- feedback del cliente sobre el servicio
  )),

  -- Contenido
  memory_key    TEXT NOT NULL,          -- clave semántica: "preferred_table", "no_show_count", etc.
  memory_value  TEXT NOT NULL,          -- valor legible: "terraza siempre", "2 no-shows en 3 meses"
  memory_data   JSONB DEFAULT '{}',    -- datos estructurados para decisiones programáticas

  -- Confianza y peso
  confidence    REAL NOT NULL DEFAULT 0.5 CHECK (confidence BETWEEN 0 AND 1),
  weight        REAL NOT NULL DEFAULT 1.0,  -- peso para priorización (más alto = más importante)
  source        TEXT NOT NULL DEFAULT 'system' CHECK (source IN (
    'system',      -- detectado automáticamente
    'agent',       -- reportado por el agente durante interacción
    'owner',       -- puesto manualmente por el dueño del negocio
    'post_call',   -- extraído del análisis post-llamada
    'pattern'      -- detectado por análisis de patrones
  )),

  -- Temporalidad
  valid_from    TIMESTAMPTZ DEFAULT NOW(),
  valid_until   TIMESTAMPTZ,           -- NULL = no expira
  last_used_at  TIMESTAMPTZ,           -- última vez que se usó en una interacción
  reinforced_count INT DEFAULT 1,      -- veces que se ha confirmado

  -- Estado
  active        BOOLEAN DEFAULT TRUE,
  reviewed      BOOLEAN DEFAULT FALSE,  -- si el dueño lo ha revisado

  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_cm_tenant_customer ON customer_memory(tenant_id, customer_id) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_cm_type ON customer_memory(tenant_id, customer_id, memory_type) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_cm_key ON customer_memory(tenant_id, customer_id, memory_key) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_cm_confidence ON customer_memory(confidence DESC) WHERE active = TRUE;

-- ─────────────────────────────────────────────────────────────
-- 2. CUSTOMER EVENTS — Timeline de eventos del cliente
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Tipo de evento
  event_type    TEXT NOT NULL CHECK (event_type IN (
    'call',            -- llamada telefónica
    'whatsapp',        -- mensaje WhatsApp
    'sms',             -- SMS
    'email',           -- email
    'reservation',     -- reserva creada
    'reservation_confirmed', -- reserva confirmada
    'reservation_cancelled', -- reserva cancelada
    'reservation_modified',  -- reserva modificada
    'no_show',         -- no se presentó
    'late_arrival',    -- llegó tarde
    'early_arrival',   -- llegó temprano
    'visit',           -- visita completada
    'order',           -- pedido realizado
    'complaint',       -- queja
    'compliment',      -- elogio
    'callback_scheduled',   -- callback programado
    'callback_completed',   -- callback realizado
    'waitlist_added',  -- añadido a lista de espera
    'waitlist_resolved' -- lista de espera resuelta
  )),

  -- Datos del evento
  channel       TEXT,                   -- voice, whatsapp, sms, email, web
  summary       TEXT,                   -- resumen legible
  event_data    JSONB DEFAULT '{}',    -- datos estructurados
  sentiment     TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),

  -- Vinculación
  reservation_id UUID,
  call_id       UUID,
  conversation_id UUID,

  -- Metadata
  agent_name    TEXT,                   -- nombre del agente que atendió
  duration_seconds INT,

  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ce_tenant_customer ON customer_events(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_ce_type ON customer_events(tenant_id, customer_id, event_type);
CREATE INDEX IF NOT EXISTS idx_ce_created ON customer_events(tenant_id, customer_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 3. CUSTOMER ALERTS — Avisos internos para el negocio
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id   UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  alert_type    TEXT NOT NULL CHECK (alert_type IN (
    'no_show_risk',        -- riesgo de no presentarse
    'frequent_canceller',  -- cancela frecuentemente
    'late_pattern',        -- patrón de llegar tarde
    'vip_returning',       -- cliente VIP vuelve
    'complaint_history',   -- historial de quejas
    'high_value',          -- cliente de alto valor
    'at_risk',             -- cliente en riesgo de perderse
    'needs_followup',      -- necesita seguimiento
    'special_attention',   -- atención especial requerida
    'callback_needed'      -- necesita que le llamen
  )),

  severity      TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,

  -- Estado
  acknowledged  BOOLEAN DEFAULT FALSE,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,

  -- Auto-resolución
  auto_resolve  BOOLEAN DEFAULT FALSE,
  resolve_after TIMESTAMPTZ,

  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ca_tenant ON customer_alerts(tenant_id) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_ca_customer ON customer_alerts(tenant_id, customer_id) WHERE active = TRUE;

-- ─────────────────────────────────────────────────────────────
-- 4. SCHEDULED CALLBACKS — Callbacks programados
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scheduled_callbacks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id   UUID REFERENCES customers(id) ON DELETE SET NULL,

  -- Datos del callback
  phone         TEXT NOT NULL,
  reason        TEXT NOT NULL,            -- motivo del callback
  context       TEXT,                     -- contexto para el agente
  priority      TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Programación
  scheduled_for TIMESTAMPTZ NOT NULL,
  max_attempts  INT DEFAULT 3,
  attempt_count INT DEFAULT 0,
  last_attempt  TIMESTAMPTZ,

  -- Estado
  status        TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'in_progress', 'completed', 'failed', 'cancelled'
  )),
  result        TEXT,                     -- resultado del callback
  call_id       UUID,                     -- llamada resultante

  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sc_pending ON scheduled_callbacks(tenant_id, scheduled_for)
  WHERE status = 'pending';

-- ─────────────────────────────────────────────────────────────
-- 5. AMPLIAR TABLA CUSTOMERS con campos de inteligencia
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  -- Campos de memoria y scoring
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_score INT DEFAULT 50;
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS loyalty_tier TEXT DEFAULT 'normal';
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS no_show_count INT DEFAULT 0;
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS late_count INT DEFAULT 0;
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS cancel_count INT DEFAULT 0;
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS visit_count INT DEFAULT 0;
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS total_spend REAL DEFAULT 0;
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS avg_party_size REAL;
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_day TEXT;
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_time TEXT;
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'es';
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'none';
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ;
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS first_contact_at TIMESTAMPTZ;
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS lifetime_interactions INT DEFAULT 0;
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS sentiment_avg REAL DEFAULT 0.5;
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS needs_callback BOOLEAN DEFAULT FALSE;
  ALTER TABLE customers ADD COLUMN IF NOT EXISTS callback_reason TEXT;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 6. AMPLIAR TABLA TENANTS con config de memoria
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS retell_agent_id TEXT;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS retell_llm_id TEXT;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS memory_config JSONB DEFAULT '{
    "no_show_review": true,
    "late_pattern_threshold": 3,
    "vip_auto_detect": true,
    "callback_enabled": true,
    "suggestion_enabled": true,
    "alert_on_no_show": true,
    "alert_on_complaint": true,
    "strict_no_show_policy": false
  }'::jsonb;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 7. RLS POLICIES
-- ─────────────────────────────────────────────────────────────
ALTER TABLE customer_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_callbacks ENABLE ROW LEVEL SECURITY;

-- Policies para customer_memory
DROP POLICY IF EXISTS cm_tenant_isolation ON customer_memory;
CREATE POLICY cm_tenant_isolation ON customer_memory
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

-- Policies para customer_events
DROP POLICY IF EXISTS ce_tenant_isolation ON customer_events;
CREATE POLICY ce_tenant_isolation ON customer_events
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

-- Policies para customer_alerts
DROP POLICY IF EXISTS ca_tenant_isolation ON customer_alerts;
CREATE POLICY ca_tenant_isolation ON customer_alerts
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

-- Policies para scheduled_callbacks
DROP POLICY IF EXISTS sc_tenant_isolation ON scheduled_callbacks;
CREATE POLICY sc_tenant_isolation ON scheduled_callbacks
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));
