-- Carta Digital: campos para destacados/especiales
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS featured_label TEXT;

-- Stripe Connect: cuenta conectada del restaurante para recibir pagos directos
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_connect_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_connect_enabled BOOLEAN DEFAULT false;

-- Business knowledge: unique constraint para upsert por categoría
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_knowledge_tenant_category
  ON business_knowledge(tenant_id, category);

-- Fix supply_orders status: add missing values used by UI (draft, ordered, shipped)
ALTER TABLE supply_orders DROP CONSTRAINT IF EXISTS supply_orders_status_check;
ALTER TABLE supply_orders ADD CONSTRAINT supply_orders_status_check
  CHECK (status IN ('draft', 'pending', 'ordered', 'called', 'confirmed', 'shipped', 'delivered', 'cancelled', 'partial'));
