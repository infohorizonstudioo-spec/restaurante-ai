-- ═══════════════════════════════════════════════════════════════════════════
-- RESERVO.AI — BILLING SYSTEM v2
-- Mejoras: process_billable_call actualiza extra_calls en tiempo real,
--          get_plan_usage para dashboard, reset atómico completo
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. process_billable_call v2: actualiza extra_calls en tiempo real
--    Garantías: FOR UPDATE en tenant + calls → 0 race conditions en concurrencia
CREATE OR REPLACE FUNCTION process_billable_call(
  p_tenant_id       UUID,
  p_call_sid        TEXT,
  p_duration_seconds INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tenant  RECORD;
  v_counted BOOLEAN := FALSE;
  v_is_trial BOOLEAN;
  v_new_used  INTEGER;
  v_included  INTEGER;
  v_new_extra INTEGER;
BEGIN
  -- 1. Duración mínima 15s — llamadas muy breves no son cobrables
  IF p_duration_seconds < 15 THEN
    UPDATE calls SET is_billable=false, billing_error='too_short'
    WHERE call_sid=p_call_sid AND tenant_id=p_tenant_id;
    RETURN jsonb_build_object('counted',false,'reason','too_short');
  END IF;

  -- 2. Deduplicación atómica: SELECT FOR UPDATE en la fila de la llamada
  --    Twilio puede reintentar el webhook → solo la primera vez cuenta
  UPDATE calls SET counted_for_billing=true, is_billable=true
  WHERE call_sid=p_call_sid AND tenant_id=p_tenant_id
    AND (counted_for_billing IS NULL OR counted_for_billing=false);

  IF NOT FOUND THEN
    -- Ya fue contada (webhook duplicado)
    RETURN jsonb_build_object('counted',false,'reason','duplicate');
  END IF;

  -- 3. Lock atómico del tenant → evita race condition con 5 llamadas simultáneas
  SELECT * INTO v_tenant FROM tenants WHERE id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('counted',false,'reason','tenant_not_found');
  END IF;

  v_is_trial := v_tenant.plan IN ('trial','free');

  -- 4. Incrementar contador según tipo de plan
  IF v_is_trial THEN
    UPDATE tenants SET
      free_calls_used = COALESCE(free_calls_used, 0) + 1,
      call_count      = COALESCE(call_count, 0) + 1
    WHERE id = p_tenant_id;

    -- Llamadas trial nunca generan extras
    RETURN jsonb_build_object(
      'counted', true, 'type', 'trial',
      'used', COALESCE(v_tenant.free_calls_used,0) + 1,
      'included', COALESCE(v_tenant.free_calls_limit,10),
      'extra', 0
    );
  ELSE
    -- Plan de pago: calcular si esta llamada es incluida o extra
    v_new_used  := COALESCE(v_tenant.plan_calls_used, 0) + 1;
    v_included  := COALESCE(v_tenant.plan_calls_included, 0);
    v_new_extra := GREATEST(0, v_new_used - v_included);

    UPDATE tenants SET
      plan_calls_used = v_new_used,
      extra_calls     = v_new_extra,
      call_count      = COALESCE(call_count, 0) + 1
    WHERE id = p_tenant_id;

    -- Guardar billing_cycle_id en la llamada para trazabilidad
    UPDATE calls SET
      billing_cycle_id   = COALESCE(v_tenant.billing_cycle_start::text, ''),
      call_duration_seconds = p_duration_seconds
    WHERE call_sid = p_call_sid AND tenant_id = p_tenant_id;

    RETURN jsonb_build_object(
      'counted',   true,
      'type',      CASE WHEN v_new_used <= v_included THEN 'included' ELSE 'extra' END,
      'used',      v_new_used,
      'included',  v_included,
      'extra',     v_new_extra,
      'extra_cost', v_new_extra * COALESCE(v_tenant.plan_extra_rate, 0)
    );
  END IF;
END;
$$;

-- 2. get_plan_usage: snapshot completo del consumo para el dashboard
--    Incluye breakdown incluidas/extras/estimado, sin cálculo en frontend
CREATE OR REPLACE FUNCTION get_plan_usage(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE
  v_tenant RECORD;
  v_used      INTEGER;
  v_included  INTEGER;
  v_extra     INTEGER;
  v_rate      NUMERIC;
BEGIN
  SELECT * INTO v_tenant FROM tenants WHERE id=p_tenant_id;
  IF NOT FOUND THEN RETURN '{}'::JSONB; END IF;

  -- Datos según tipo de plan
  IF v_tenant.plan IN ('trial','free') THEN
    v_used     := COALESCE(v_tenant.free_calls_used, 0);
    v_included := COALESCE(v_tenant.free_calls_limit, 10);
    v_extra    := 0;
    v_rate     := 0;
  ELSE
    v_used     := COALESCE(v_tenant.plan_calls_used, 0);
    v_included := COALESCE(v_tenant.plan_calls_included, 0);
    v_extra    := GREATEST(0, v_used - v_included);
    v_rate     := COALESCE(v_tenant.plan_extra_rate, 0);
  END IF;

  RETURN jsonb_build_object(
    -- Estado del plan
    'plan',                v_tenant.plan,
    'is_trial',            v_tenant.plan IN ('trial','free'),
    'subscription_status', COALESCE(v_tenant.subscription_status, 'inactive'),
    'next_plan',           v_tenant.next_plan,
    -- Contadores
    'used_calls',          v_used,
    'included_calls',      v_included,
    'extra_calls',         v_extra,
    'remaining_calls',     GREATEST(0, v_included - v_used),
    'used_pct',            CASE WHEN v_included > 0 THEN ROUND((v_used::NUMERIC/v_included)*100, 1) ELSE 0 END,
    -- Costes
    'extra_call_rate',     v_rate,
    'extra_cost_eur',      ROUND(v_extra * v_rate, 2),
    'plan_base_price',     CASE v_tenant.plan WHEN 'starter' THEN 99 WHEN 'pro' THEN 299 WHEN 'business' THEN 499 ELSE 0 END,
    'estimated_total_eur', ROUND((CASE v_tenant.plan WHEN 'starter' THEN 99 WHEN 'pro' THEN 299 WHEN 'business' THEN 499 ELSE 0 END + v_extra * v_rate) * 1.21, 2),
    -- Ciclo
    'cycle_start',         v_tenant.billing_cycle_start,
    'cycle_end',           v_tenant.billing_cycle_end,
    'days_remaining',      CASE WHEN v_tenant.billing_cycle_end IS NOT NULL THEN GREATEST(0, (v_tenant.billing_cycle_end::date - CURRENT_DATE)::int) ELSE NULL END,
    -- Stripe
    'stripe_customer_id',      v_tenant.stripe_customer_id,
    'stripe_subscription_id',  v_tenant.stripe_subscription_id
  );
END;
$$;

-- 3. reset_billing_cycle v2: archiva histórico + resetea contadores + inicia nuevo ciclo
CREATE OR REPLACE FUNCTION reset_billing_cycle(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tenant RECORD;
  v_history_id UUID;
  v_extra_cost NUMERIC;
  v_base_price NUMERIC;
  v_total NUMERIC;
BEGIN
  -- Lock del tenant
  SELECT * INTO v_tenant FROM tenants WHERE id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'tenant_not_found'); END IF;

  -- Calcular coste final del ciclo que termina
  v_extra_cost := COALESCE(v_tenant.extra_calls, 0) * COALESCE(v_tenant.plan_extra_rate, 0);
  v_base_price := CASE v_tenant.plan WHEN 'starter' THEN 99 WHEN 'pro' THEN 299 WHEN 'business' THEN 499 ELSE 0 END;
  v_total      := v_base_price + v_extra_cost;

  -- Archivar ciclo en billing_history
  INSERT INTO billing_history (
    tenant_id, cycle_start, cycle_end, plan,
    included_calls, used_calls, extra_calls,
    extra_cost, base_amount, total_amount, status
  ) VALUES (
    p_tenant_id,
    COALESCE(v_tenant.billing_cycle_start, NOW() - INTERVAL '1 month'),
    NOW(),
    v_tenant.plan,
    COALESCE(v_tenant.plan_calls_included, 0),
    COALESCE(v_tenant.plan_calls_used, 0),
    COALESCE(v_tenant.extra_calls, 0),
    v_extra_cost,
    v_base_price,
    v_total,
    'pending'
  ) RETURNING id INTO v_history_id;

  -- Aplicar cambio de plan si hay next_plan programado
  IF v_tenant.next_plan IS NOT NULL THEN
    UPDATE tenants SET
      plan = v_tenant.next_plan,
      plan_calls_included = CASE v_tenant.next_plan
        WHEN 'starter' THEN 50 WHEN 'pro' THEN 200 WHEN 'business' THEN 600 ELSE 50 END,
      plan_extra_rate = CASE v_tenant.next_plan
        WHEN 'starter' THEN 0.90 WHEN 'pro' THEN 0.70 WHEN 'business' THEN 0.50 ELSE 0.90 END,
      next_plan = NULL,
      plan_calls_used = 0, extra_calls = 0,
      billing_cycle_start = NOW(),
      billing_cycle_end   = NOW() + INTERVAL '1 month'
    WHERE id = p_tenant_id;
  ELSE
    -- Resetear contadores del mismo plan
    UPDATE tenants SET
      plan_calls_used = 0, extra_calls = 0,
      billing_cycle_start = NOW(),
      billing_cycle_end   = NOW() + INTERVAL '1 month'
    WHERE id = p_tenant_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'history_id', v_history_id,
    'archived_used', v_tenant.plan_calls_used,
    'archived_extra', v_tenant.extra_calls,
    'archived_cost', v_total,
    'new_plan', COALESCE(v_tenant.next_plan, v_tenant.plan)
  );
END;
$$;

COMMENT ON FUNCTION process_billable_call IS 'Conteo atómico por llamada: incluida o extra. FOR UPDATE en calls+tenants.';
COMMENT ON FUNCTION get_plan_usage IS 'Snapshot completo de consumo: usado/incluido/extra/coste. Para dashboard.';
COMMENT ON FUNCTION reset_billing_cycle IS 'Archiva ciclo en billing_history y resetea contadores. Seguro para múltiples tenants.';
