-- ═══════════════════════════════════════════════════════════════════════════
-- RESERVO.AI — CONCURRENT CALLS SYSTEM
-- Migración: session_state + RPCs robustos de sesión
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Añadir session_state a calls
ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS session_state TEXT
    DEFAULT 'iniciando'
    CHECK (session_state IN (
      'iniciando','escuchando','procesando','respondiendo',
      'esperando_datos','finalizando','completada','error'
    ));

CREATE INDEX IF NOT EXISTS idx_calls_active
  ON calls (tenant_id, status, started_at DESC)
  WHERE status = 'activa';

CREATE INDEX IF NOT EXISTS idx_calls_session_state
  ON calls (tenant_id, session_state)
  WHERE session_state NOT IN ('completada','error');

-- 2. upsert_call_session: crea sesión aislada al INICIO de cada llamada
CREATE OR REPLACE FUNCTION upsert_call_session(
  p_call_sid        TEXT,
  p_tenant_id       UUID,
  p_caller_phone    TEXT DEFAULT '',
  p_agent_phone     TEXT DEFAULT '',
  p_conversation_id TEXT DEFAULT NULL,
  p_session_state   TEXT DEFAULT 'iniciando'
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_call_id UUID; v_now TIMESTAMPTZ := now();
BEGIN
  INSERT INTO calls (
    call_sid, tenant_id, caller_phone, from_number, to_number,
    status, session_state, source, direction, started_at, conversation_id
  ) VALUES (
    p_call_sid, p_tenant_id, p_caller_phone, p_caller_phone, p_agent_phone,
    'activa', p_session_state, 'twilio', 'inbound', v_now, p_conversation_id
  )
  ON CONFLICT (call_sid) DO UPDATE SET
    session_state   = EXCLUDED.session_state,
    tenant_id       = EXCLUDED.tenant_id,
    caller_phone    = COALESCE(EXCLUDED.caller_phone, calls.caller_phone),
    from_number     = COALESCE(EXCLUDED.from_number,  calls.from_number),
    conversation_id = COALESCE(EXCLUDED.conversation_id, calls.conversation_id),
    status          = CASE WHEN calls.status='completada' THEN calls.status ELSE 'activa' END
  RETURNING id INTO v_call_id;
  RETURN jsonb_build_object('call_id', v_call_id, 'call_sid', p_call_sid, 'ok', true);
END;
$$;

-- 3. update_call_session_state: actualiza estado mid-call sin race condition
CREATE OR REPLACE FUNCTION update_call_session_state(
  p_call_sid      TEXT,
  p_session_state TEXT,
  p_tenant_id     UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_updated INT;
BEGIN
  UPDATE calls SET
    session_state = p_session_state,
    status = CASE
      WHEN p_session_state IN ('completada','error') THEN p_session_state
      ELSE 'activa'
    END
  WHERE call_sid = p_call_sid
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
    AND status != 'completada';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN jsonb_build_object('updated', v_updated, 'call_sid', p_call_sid);
END;
$$;

-- 4. complete_call_session: cierre atómico con SELECT FOR UPDATE (reemplaza versión anterior)
CREATE OR REPLACE FUNCTION complete_call_session(
  p_call_sid      TEXT,   p_tenant_id     UUID,
  p_duration      INT     DEFAULT 0,
  p_status        TEXT    DEFAULT 'completada',
  p_transcript    TEXT    DEFAULT NULL,
  p_summary       TEXT    DEFAULT NULL,
  p_intent        TEXT    DEFAULT NULL,
  p_customer_name TEXT    DEFAULT NULL,
  p_action        TEXT    DEFAULT NULL,
  p_source        TEXT    DEFAULT 'twilio'
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
      customer_name, action_suggested, ended_at, started_at
    ) VALUES (
      p_call_sid, p_tenant_id, 'completada', 'completada', p_source,
      p_duration, p_transcript, p_summary, p_intent,
      p_customer_name, p_action, v_now, v_now
    ) RETURNING id INTO v_call_id;
    RETURN jsonb_build_object('call_id', v_call_id, 'already_counted', false, 'created', true);
  END IF;

  UPDATE calls SET
    status              = 'completada',   session_state   = 'completada',
    duration_seconds    = COALESCE(NULLIF(p_duration,0), duration_seconds),
    call_duration_seconds = COALESCE(NULLIF(p_duration,0), call_duration_seconds),
    transcript          = COALESCE(p_transcript,    transcript),
    summary             = COALESCE(p_summary,       summary),
    intent              = COALESCE(p_intent,        intent),
    customer_name       = COALESCE(p_customer_name, customer_name),
    action_suggested    = COALESCE(p_action,        action_suggested),
    ended_at            = v_now
  WHERE id = v_call_id;

  RETURN jsonb_build_object('call_id', v_call_id, 'already_counted', v_already_counted, 'updated', true);
END;
$$;

-- 5. get_active_calls: dashboard de llamadas en curso (todas las simultáneas)
CREATE OR REPLACE FUNCTION get_active_calls(p_tenant_id UUID)
RETURNS TABLE (
  id UUID, call_sid TEXT, caller_phone TEXT,
  session_state TEXT, started_at TIMESTAMPTZ, duration_sec INT
)
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT c.id, c.call_sid,
    COALESCE(c.caller_phone, c.from_number, '') AS caller_phone,
    c.session_state, c.started_at,
    EXTRACT(EPOCH FROM (now() - c.started_at))::INT AS duration_sec
  FROM calls c
  WHERE c.tenant_id = p_tenant_id AND c.status = 'activa'
  ORDER BY c.started_at DESC LIMIT 20;
$$;

-- Cleanup: marcar llamadas activas viejas (>2h) como error para no ensuciar el dashboard
-- Se puede correr como cron diario
CREATE OR REPLACE FUNCTION cleanup_stale_calls()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_count INT;
BEGIN
  UPDATE calls SET status='error', session_state='error', ended_at=now()
  WHERE status='activa' AND started_at < now() - INTERVAL '2 hours';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
