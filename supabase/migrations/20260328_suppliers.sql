-- ============================================================
-- RESERVO.AI — Suppliers & Supply Orders
-- Sistema de proveedores y pedidos automáticos
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. PROVEEDORES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  contact_name  TEXT,                   -- persona de contacto
  category      TEXT,                   -- tipo: bebidas, carnes, verduras, limpieza, etc.
  notes         TEXT,                   -- notas del negocio sobre este proveedor
  products      TEXT[],                 -- productos que suministra
  delivery_days TEXT[],                 -- días de entrega habituales
  min_order     REAL,                   -- pedido mínimo
  payment_terms TEXT,                   -- condiciones de pago
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON suppliers(tenant_id) WHERE active = TRUE;

-- ─────────────────────────────────────────────────────────────
-- 2. PEDIDOS A PROVEEDORES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supply_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id   UUID REFERENCES suppliers(id) ON DELETE SET NULL,

  -- Datos del pedido
  items         JSONB NOT NULL DEFAULT '[]',   -- [{name, quantity, unit, price}]
  total         REAL,
  notes         TEXT,

  -- Estado
  status        TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'called', 'confirmed', 'delivered', 'cancelled', 'partial'
  )),

  -- Llamada asociada
  call_id       TEXT,                   -- call_id de Retell
  call_summary  TEXT,                   -- resumen de la llamada al proveedor

  -- Entrega
  delivery_date TEXT,                   -- fecha estimada de entrega
  delivered_at  TIMESTAMPTZ,
  received_by   TEXT,                   -- quién recibió el pedido

  -- Metadata
  ordered_by    TEXT,                   -- quién hizo el pedido (usuario o sistema)
  priority      TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_so_tenant ON supply_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_so_status ON supply_orders(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_so_supplier ON supply_orders(supplier_id);

-- ─────────────────────────────────────────────────────────────
-- 3. STOCK / INVENTARIO (opcional, para negocios que lo usen)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  category      TEXT,
  unit          TEXT DEFAULT 'unidad',   -- unidad, kg, litro, caja, etc.
  current_stock REAL DEFAULT 0,
  min_stock     REAL DEFAULT 0,          -- stock mínimo → genera alerta
  max_stock     REAL,
  supplier_id   UUID REFERENCES suppliers(id),
  price_per_unit REAL,
  last_order_date TIMESTAMPTZ,
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_tenant ON inventory_items(tenant_id) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_inv_low_stock ON inventory_items(tenant_id, current_stock, min_stock) WHERE active = TRUE;

-- ─────────────────────────────────────────────────────────────
-- 4. RLS
-- ─────────────────────────────────────────────────────────────
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sup_tenant_isolation ON suppliers;
CREATE POLICY sup_tenant_isolation ON suppliers
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS so_tenant_isolation ON supply_orders;
CREATE POLICY so_tenant_isolation ON supply_orders
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS inv_tenant_isolation ON inventory_items;
CREATE POLICY inv_tenant_isolation ON inventory_items
  USING (tenant_id IN (SELECT id FROM tenants WHERE owner_id = auth.uid()));
