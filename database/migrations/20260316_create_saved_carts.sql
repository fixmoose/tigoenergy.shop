-- Migration: create saved_carts and saved_cart_items tables

CREATE TABLE IF NOT EXISTS saved_carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_carts_user_id ON saved_carts(user_id);

CREATE TABLE IF NOT EXISTS saved_cart_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  saved_cart_id UUID NOT NULL REFERENCES saved_carts(id) ON DELETE CASCADE,
  product_id UUID,
  quantity INTEGER NOT NULL DEFAULT 1,
  sku TEXT,
  name TEXT,
  unit_price NUMERIC(12,2),
  image_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_saved_cart_items_cart_id ON saved_cart_items(saved_cart_id);

-- RLS
ALTER TABLE saved_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_cart_items ENABLE ROW LEVEL SECURITY;

-- Users can only see/manage their own saved carts
CREATE POLICY "Users can select own saved carts"
  ON saved_carts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved carts"
  ON saved_carts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved carts"
  ON saved_carts FOR DELETE
  USING (auth.uid() = user_id);

-- Users can see/manage items in their own saved carts
CREATE POLICY "Users can select own saved cart items"
  ON saved_cart_items FOR SELECT
  USING (saved_cart_id IN (SELECT id FROM saved_carts WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own saved cart items"
  ON saved_cart_items FOR INSERT
  WITH CHECK (saved_cart_id IN (SELECT id FROM saved_carts WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own saved cart items"
  ON saved_cart_items FOR DELETE
  USING (saved_cart_id IN (SELECT id FROM saved_carts WHERE user_id = auth.uid()));
