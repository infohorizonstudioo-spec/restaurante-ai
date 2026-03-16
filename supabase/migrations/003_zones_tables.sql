-- Tabla de zonas del local
CREATE TABLE IF NOT EXISTS zones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Columnas adicionales en tables
ALTER TABLE tables ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES zones(id);
ALTER TABLE tables ADD COLUMN IF NOT EXISTS combinable BOOLEAN DEFAULT false;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS notes TEXT;

-- Columnas adicionales en reservations  
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS zone_id UUID;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS table_name TEXT;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS customer_phone TEXT;

-- RLS
ALTER TABLE zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "tenant_zones" ON zones USING (
  tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid())
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_zones_tenant ON zones(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tables_zone ON tables(zone_id);
CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(tenant_id, reservation_date);