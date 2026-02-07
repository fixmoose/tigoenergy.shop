-- ============================================================================
-- PRICING SCHEMAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS pricing_schemas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pricing_schema_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schema_id UUID NOT NULL REFERENCES pricing_schemas(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('category_discount', 'product_fixed_price', 'global_discount')),
  category TEXT,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  discount_percentage DECIMAL(5,2),
  fixed_price_eur DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_rules_schema ON pricing_schema_rules(schema_id);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_product ON pricing_schema_rules(product_id);

CREATE TABLE IF NOT EXISTS customer_pricing_schemas (
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  schema_id UUID NOT NULL REFERENCES pricing_schemas(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (customer_id, schema_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_pricing_customer ON customer_pricing_schemas(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_pricing_schema ON customer_pricing_schemas(schema_id);

-- Auto-update timestamps
CREATE TRIGGER update_pricing_schemas_updated_at BEFORE UPDATE ON pricing_schemas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_rules_updated_at BEFORE UPDATE ON pricing_schema_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS policies
ALTER TABLE pricing_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_schema_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_pricing_schemas ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (used by server-side code)
CREATE POLICY "Service role full access on pricing_schemas" ON pricing_schemas
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on pricing_schema_rules" ON pricing_schema_rules
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on customer_pricing_schemas" ON customer_pricing_schemas
  FOR ALL USING (true) WITH CHECK (true);
