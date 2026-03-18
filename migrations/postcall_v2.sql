-- ═══════════════════════════════════════════════════════════════════
-- RESERVO.AI — POST-CALL SYSTEM v2
-- Migración: action_required + fix transcript default + métricas
-- ═══════════════════════════════════════════════════════════════════

-- 1. Añadir action_required (qué hay que hacer después de la llamada)
ALTER TABLE calls ADD COLUMN IF NOT EXISTS action_required TEXT;

-- 2. Corregir el default de transcript (era '[]'::jsonb — incorrecto para TEXT)
ALTER TABLE calls ALTER COLUMN transcript DROP DEFAULT;
ALTER TABLE calls ALTER COLUMN transcript SET DEFAULT NULL;

-- 3. Índice para métricas del día por intent (reservas/pedidos detectados hoy)
CREATE INDEX IF NOT EXISTS idx_calls_intent_date
  ON calls (tenant_id, intent, started_at DESC)
  WHERE intent IS NOT NULL;

-- 4. Función get_daily_metrics: resumen del día para el panel
CREATE OR REPLACE FUNCTION get_daily_metrics(
  p_tenant_id UUID,
  p_date      DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT jsonb_build_object(
    'calls_today',       COUNT(*),
    'calls_completed',   COUNT(*) FILTER (WHERE status = 'completada'),
    'calls_active',      COUNT(*) FILTER (WHERE status = 'activa'),
    'calls_failed',      COUNT(*) FILTER (WHERE status IN ('fallida','error','no-answer')),
    'reservas_detected', COUNT(*) FILTER (WHERE intent = 'reserva'),
    'pedidos_detected',  COUNT(*) FILTER (WHERE intent = 'pedido'),
    'consultas',         COUNT(*) FILTER (WHERE intent = 'consulta'),
    'cancelaciones',     COUNT(*) FILTER (WHERE intent = 'cancelacion'),
    'with_summary',      COUNT(*) FILTER (WHERE summary IS NOT NULL AND summary != '' AND summary != 'Llamada breve' AND summary != 'Llamada procesada'),
    'avg_duration',      ROUND(AVG(duration_seconds) FILTER (WHERE duration_seconds > 0))
  )
  FROM calls
  WHERE tenant_id = p_tenant_id
    AND DATE(started_at) = p_date;
$$;

-- 5. complete_call_session v2: incluye action_required
CREATE OR REPLACE FUNCTION complete_call_session(
  p_call_sid       TEXT,    p_tenant_id      UUID,
  p_duration       INT      DEFAULT 0,
  p_status         TEXT     DEFAULT 'completada',
  p_transcript     TEXT     DEFAULT NULL,
  p_summary        TEXT     DEFAULT NULL,
  p_intent         TEXT     DEFAULT NULL,
  p_customer_name  TEXT     DEFAULT NULL,
  p_action         TEXT     DEFAULT NULL,
  p_source         TEXT     DEFAULT 'twilio',
  p_action_required TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_call_id UUID; v_already_counted BOOLEAN := FALSE; v_now TIMESTAMPTZ := now();
BEGIN
  SELECT id, counted_for_billing INTO v_call_id, v_already_counted
  FROM calls WHERE call_sid=p_call_sid AND tenant_id=p_tenant_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO calls (
      call_sid, tenant_id, status, session_state, source,
      duration_seconds, transcript, summary, intent,
      customer_name, action_suggested, action_required, ended_at, started_at
    ) VALUES (
      p_call_sid, p_tenant_id, 'completada', 'completada', p_source,
      p_duration, p_transcript, p_summary, p_intent,
      p_customer_name, p_action, p_action_required, v_now, v_now
    ) RETURNING id INTO v_call_id;
    RETURN jsonb_build_object('call_id', v_call_id, 'already_counted', false, 'created', true);
  END IF;

  UPDATE calls SET
    status              = 'completada',   session_state      = 'completada',
    duration_seconds    = COALESCE(NULLIF(p_duration,0), duration_seconds),
    call_duration_seconds = COALESCE(NULLIF(p_duration,0), call_duration_seconds),
    transcript          = COALESCE(NULLIF(p_transcript,''), transcript),
    summary             = COALESCE(NULLIF(p_summary,''),  summary),
    intent              = COALESCE(NULLIF(p_intent,''),   intent),
    customer_name       = COALESCE(NULLIF(p_customer_name,''), customer_name),
    action_suggested    = COALESCE(NULLIF(p_action,''),   action_suggested),
    action_required     = COALESCE(NULLIF(p_action_required,''), action_required),
    ended_at            = v_now
  WHERE id = v_call_id;

  RETURN jsonb_build_object('call_id', v_call_id, 'already_counted', v_already_counted, 'updated', true);
END;
$$;

COMMENT ON COLUMN calls.action_required IS 'Acción necesaria tras la llamada: qué debe hacer el negocio';
COMMENT ON FUNCTION get_daily_metrics IS 'Métricas del día para el panel: llamadas, reservas, pedidos, etc.';
