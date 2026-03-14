-- ============================================================
-- RESTAURANTE AI — Tablas Supabase
-- ============================================================

-- Restaurantes (tenants)
CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone_number TEXT UNIQUE NOT NULL,  -- número Twilio asignado
  address TEXT,
  google_maps_url TEXT,
  menu JSONB DEFAULT '[]',            -- [{name, price, description}]
  greeting TEXT DEFAULT 'Hola, gracias por llamar. ¿Qué desea pedir?',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Pedidos
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id),
  call_sid TEXT,                      -- ID de la llamada Twilio
  customer_name TEXT,
  customer_phone TEXT,
  delivery_address TEXT,
  payment_method TEXT CHECK (payment_method IN ('efectivo', 'tarjeta')),
  items JSONB DEFAULT '[]',           -- [{name, qty, price}]
  notes TEXT,
  total NUMERIC(10,2),
  status TEXT DEFAULT 'nuevo' CHECK (status IN ('nuevo','confirmado','preparando','enviado','entregado','cancelado')),
  transcript JSONB DEFAULT '[]',      -- conversación completa
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Realtime para el panel
ALTER TABLE orders REPLICA IDENTITY FULL;

-- Seed de restaurante demo
INSERT INTO restaurants (name, phone_number, address, greeting, menu) VALUES (
  'Restaurante Demo',
  '+34000000000',
  'Calle Demo 1, Madrid',
  'Hola, bienvenido a Restaurante Demo. ¿En qué le puedo ayudar?',
  '[
    {"name":"Pizza Margarita","price":10.50,"description":"Tomate, mozzarella, albahaca"},
    {"name":"Pizza Pepperoni","price":12.00,"description":"Tomate, mozzarella, pepperoni"},
    {"name":"Pasta Carbonara","price":9.50,"description":"Pasta, huevo, panceta, parmesano"},
    {"name":"Ensalada César","price":7.50,"description":"Lechuga, pollo, parmesano, croutons"},
    {"name":"Tiramisú","price":4.50,"description":"Postre italiano clásico"},
    {"name":"Coca-Cola","price":2.00,"description":"330ml"},
    {"name":"Agua","price":1.50,"description":"500ml"}
  ]'::jsonb
) ON CONFLICT DO NOTHING;
