-- Performance indexes for scale (50+ mesas, 500+ products, 200+ orders/day)

-- Orders: most queried table
CREATE INDEX IF NOT EXISTS idx_order_events_tenant_status ON order_events(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_order_events_tenant_created ON order_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_events_tenant_date ON order_events(tenant_id, created_at) WHERE status IN ('confirmed', 'preparing', 'ready', 'delivered');

-- Reservations: queried by date constantly
CREATE INDEX IF NOT EXISTS idx_reservations_tenant_date ON reservations(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_reservations_tenant_status ON reservations(tenant_id, status);

-- Menu items: loaded on every TPV page load
CREATE INDEX IF NOT EXISTS idx_menu_items_tenant_active ON menu_items(tenant_id) WHERE active = true;

-- Customers: searched by phone and name
CREATE INDEX IF NOT EXISTS idx_customers_tenant_phone ON customers(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_name ON customers(tenant_id, name);

-- Calls: filtered by date
CREATE INDEX IF NOT EXISTS idx_calls_tenant_created ON calls(tenant_id, created_at DESC);

-- Notifications: filtered by read status
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_unread ON notifications(tenant_id) WHERE read = false;

-- Tables: loaded for TPV and floor plan
CREATE INDEX IF NOT EXISTS idx_tables_tenant ON tables(tenant_id);
