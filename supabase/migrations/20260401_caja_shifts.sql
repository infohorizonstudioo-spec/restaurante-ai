-- Caja shifts: persistir turnos de caja en DB (no localStorage)
CREATE TABLE IF NOT EXISTS caja_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  opened_by TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  initial_cash NUMERIC DEFAULT 0,
  total_sales NUMERIC DEFAULT 0,
  total_cash NUMERIC DEFAULT 0,
  total_card NUMERIC DEFAULT 0,
  total_other NUMERIC DEFAULT 0,
  orders_count INT DEFAULT 0,
  counted_cash NUMERIC,
  difference NUMERIC,
  notes TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caja_shifts_tenant ON caja_shifts(tenant_id, opened_at DESC);

ALTER TABLE caja_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS caja_tenant ON caja_shifts;
CREATE POLICY caja_tenant ON caja_shifts
  USING (tenant_id IN (SELECT profiles.tenant_id FROM profiles WHERE profiles.id = auth.uid()));

DROP POLICY IF EXISTS caja_service ON caja_shifts;
CREATE POLICY caja_service ON caja_shifts
  FOR ALL TO service_role USING (true);
