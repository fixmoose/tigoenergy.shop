-- ============================================================================
-- CUSTOMER CUSTOM PRICING (OVERRIDE PER ITEM)
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_custom_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  -- pricing_type: 'simple' (one price) or 'tiered' (quantity breaks)
  pricing_type TEXT NOT NULL CHECK (pricing_type IN ('simple', 'tiered')),
  
  -- For 'simple' pricing
  fixed_price_eur DECIMAL(10,2),
  
  -- For 'tiered' pricing: [{min_qty: 1, price: 100}, {min_qty: 10, price: 90}]
  tier_prices JSONB, 
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One override per customer per product
  UNIQUE(customer_id, product_id)
);

-- Index for fast lookup when calculating prices
CREATE INDEX IF NOT EXISTS idx_custom_pricing_customer_product ON customer_custom_pricing(customer_id, product_id);

-- RLS policies
ALTER TABLE customer_custom_pricing ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (used by server-side code)
CREATE POLICY "Service role full access on customer_custom_pricing" ON customer_custom_pricing
  FOR ALL USING (true) WITH CHECK (true);

-- Trigger for updated_at
-- This function already exists from previous migrations
DO $$
BEGIN
    CREATE TRIGGER update_customer_custom_pricing_updated_at 
    BEFORE UPDATE ON customer_custom_pricing
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
