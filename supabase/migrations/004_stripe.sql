ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_calls_included INTEGER DEFAULT 50;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_calls_used INTEGER DEFAULT 0;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_extra_rate DECIMAL(10,2) DEFAULT 0.90;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_period_start TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer ON tenants(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_stripe_sub ON tenants(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;