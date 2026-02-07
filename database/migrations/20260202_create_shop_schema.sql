-- Migration: create core shop schema (products, customers, orders, order_items, carts)

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  name_en text NOT NULL,
  name_local text,
  description text,
  category text,
  slug text NOT NULL UNIQUE,
  cost_eur numeric(10,2),
  price_eur numeric(10,2) NOT NULL,
  weight_kg numeric(8,3),
  stock int DEFAULT 0,
  active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_category_idx ON products (category);
CREATE INDEX IF NOT EXISTS products_slug_idx ON products (slug);

-- Customers (profile records). Authentication still handled by Supabase Auth.
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  email text,
  full_name text,
  phone text,
  address jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS customers_user_id_idx ON customers (user_id);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  currency text NOT NULL DEFAULT 'EUR',
  subtotal numeric(10,2),
  shipping numeric(10,2),
  tax numeric(10,2),
  total numeric(10,2),
  billing jsonb DEFAULT '{}'::jsonb,
  shipping_address jsonb DEFAULT '{}'::jsonb,
  placed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_customer_idx ON orders (customer_id);

-- Order items
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders (id) ON DELETE CASCADE,
  product_id uuid REFERENCES products (id) ON DELETE SET NULL,
  sku text,
  name text,
  unit_price numeric(10,2),
  quantity int DEFAULT 1,
  total_price numeric(10,2),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);

-- Carts (guest + user carts)
-- Note: store user_id as a plain uuid to avoid FK issues with auth/customers schema
CREATE TABLE IF NOT EXISTS carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  items jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS carts_user_idx ON carts (user_id);

-- Keep updated_at in sync on modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER carts_updated_at BEFORE UPDATE ON carts FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Optional sample data (uncomment to insert)
-- INSERT INTO products (sku, name_en, slug, price_eur, category, stock) VALUES ('TS4-AO-700', 'TS4-AO', 'ts4-ao-700', 350.00, 'optimizer', 10);

COMMENT ON TABLE products IS 'Product catalog';
COMMENT ON TABLE customers IS 'Customer profile table (linked to auth.users)';
COMMENT ON TABLE orders IS 'Order header';
COMMENT ON TABLE order_items IS 'Line items for orders';
COMMENT ON TABLE carts IS 'Persistent cart storage (guest or user)';
