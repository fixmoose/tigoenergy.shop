-- Phase 4: Reporting Data Foundation Migration
-- Adds compliance fields for OSS, Intrastat, TROD, and Packaging Waste reporting

-- ============================================================================
-- PRODUCTS: Add TROD and Packaging Compliance Fields
-- ============================================================================

-- TROD (Waste Electrical Equipment) Fields
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_electrical_equipment BOOLEAN DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS trod_category_code TEXT CHECK (trod_category_code IN ('1', '2', '3', '4', '5', '6', '7'));
COMMENT ON COLUMN products.trod_category_code IS 'TROD Category: 1=Large HH, 2=Small HH, 3=IT/Telecom, 4=Consumer, 5=Lighting, 6=Tools, 7=Solar/PV';

-- Packaging Fields (aligned with config: cardboard, plastic, foam, metal, glass, wood, none, mixed)
ALTER TABLE products ADD COLUMN IF NOT EXISTS default_packaging_type TEXT
  CHECK (default_packaging_type IN ('cardboard', 'plastic', 'foam', 'metal', 'glass', 'wood', 'none', 'mixed'));
ALTER TABLE products ADD COLUMN IF NOT EXISTS packaging_weight_per_unit_kg DECIMAL(6,3) DEFAULT 0;
COMMENT ON COLUMN products.default_packaging_type IS 'Primary packaging material for waste reporting';

-- HS Code validation (ensure 6-8 digits)
-- HS Code validation (ensure 6-8 digits)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_hs_code') THEN
    ALTER TABLE products ADD CONSTRAINT valid_hs_code CHECK (cn_code IS NULL OR cn_code ~ '^[0-9]{6,8}$');
  END IF;
END $$;

-- ============================================================================
-- ORDER_ITEMS: Add per-item compliance tracking
-- ============================================================================

-- TROD Fee applicability
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS applies_trod_fee BOOLEAN DEFAULT false;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS trod_category_code TEXT CHECK (trod_category_code IN ('1', '2', '3', '4', '5', '6', '7'));

-- Packaging Fee applicability (aligned with products constraint)
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS applies_packaging_fee BOOLEAN DEFAULT false;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS packaging_weight_kg DECIMAL(6,3) DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS packaging_type TEXT
  CHECK (packaging_type IN ('cardboard', 'plastic', 'foam', 'metal', 'glass', 'wood', 'none', 'mixed'));

-- ============================================================================
-- ORDERS: Add enhanced country tracking for OSS
-- ============================================================================

-- Ensure delivery country is tracked explicitly (for OSS)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_country TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS supplier_country TEXT DEFAULT 'SI';
COMMENT ON COLUMN orders.delivery_country IS 'ISO 2-letter code of final delivery destination (for OSS/Intrastat)';

-- Transaction type for reporting classification
ALTER TABLE orders ADD COLUMN IF NOT EXISTS transaction_type TEXT DEFAULT 'domestic'
  CHECK (transaction_type IN ('domestic', 'intra_eu_distance_sale', 'intra_eu_service', 'export'));

-- ============================================================================
-- COMPLIANCE CONFIGURATION: Store fee rates and thresholds
-- ============================================================================

-- Add reporting configuration to system_settings
INSERT INTO system_settings (key, value, description) VALUES
('trod_config', '{
  "enabled": true,
  "reporting_authority": "FURS",
  "category_rates": {
    "1": 0.60,
    "2": 0.50,
    "3": 0.80,
    "4": 0.40,
    "5": 1.20,
    "6": 0.75,
    "7": 0.85
  },
  "default_category_for_solar": "7"
}'::jsonb, 'TROD (Waste Electrical Equipment) fee configuration')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

INSERT INTO system_settings (key, value, description) VALUES
('packaging_waste_config', '{
  "enabled": true,
  "reporting_threshold_kg": 15000,
  "material_rates": {
    "cardboard": 0.15,
    "plastic": 0.18,
    "foam": 0.12,
    "metal": 0.20,
    "glass": 0.10,
    "wood": 0.12,
    "mixed": 0.15
  }
}'::jsonb, 'Packaging waste reporting configuration')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

INSERT INTO system_settings (key, value, description) VALUES
('intrastat_config', '{
  "enabled": true,
  "threshold_dispatches_eur": 270000,
  "threshold_arrivals_eur": 240000,
  "statistical_threshold_eur": 9000000,
  "submission_deadline_day": 15,
  "authority": "SURS"
}'::jsonb, 'Intrastat reporting thresholds and configuration')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

INSERT INTO system_settings (key, value, description) VALUES
('oss_config', '{
  "enabled": true,
  "member_state_of_identification": "SI",
  "scheme": "union_scheme",
  "submission_deadline_days_after_quarter": 20,
  "authority": "FURS"
}'::jsonb, 'OSS (One Stop Shop) VAT reporting configuration')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ============================================================================
-- BACKFILL: Set defaults for existing products
-- ============================================================================

-- Solar/electrical products are Category 7 (Solar/PV equipment)
-- Only update products in electrical categories, not accessories like cables/mounts
UPDATE products
SET
  is_electrical_equipment = true,
  trod_category_code = '7',
  default_packaging_type = 'cardboard'
WHERE (is_electrical_equipment IS NULL OR trod_category_code IS NULL)
  AND category IN ('optimizer', 'inverter', 'battery', 'monitoring', 'mlpe');

-- Non-electrical accessories should not have TROD fees
UPDATE products
SET is_electrical_equipment = false
WHERE category IN ('accessory', 'cable', 'mount', 'mounting', 'hardware')
  AND is_electrical_equipment IS NULL;

-- Set HS codes based on product category
UPDATE products
SET cn_code = '85414020'  -- Photovoltaic cells/modules (optimizers)
WHERE cn_code IS NULL AND category IN ('optimizer', 'mlpe');

UPDATE products
SET cn_code = '85044084'  -- Inverters
WHERE cn_code IS NULL AND category = 'inverter';

UPDATE products
SET cn_code = '85076000'  -- Lithium-ion batteries
WHERE cn_code IS NULL AND category = 'battery';

UPDATE products
SET cn_code = '90318080'  -- Monitoring/measuring instruments
WHERE cn_code IS NULL AND category = 'monitoring';

-- ============================================================================
-- BACKFILL: Set delivery_country from existing orders
-- ============================================================================

-- Extract country from shipping_address JSONB for existing orders
UPDATE orders
SET delivery_country = UPPER(COALESCE(
  shipping_address->>'country_code',
  shipping_address->>'country',
  shipping_address->>'countryCode'
))
WHERE delivery_country IS NULL
  AND shipping_address IS NOT NULL
  AND shipping_address != '{}'::jsonb;

-- Set transaction_type based on delivery country for existing orders
UPDATE orders
SET transaction_type = CASE
  WHEN delivery_country = 'SI' THEN 'domestic'
  WHEN delivery_country IN ('AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
                            'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
                            'PL', 'PT', 'RO', 'SK', 'ES', 'SE') THEN 'intra_eu_distance_sale'
  ELSE 'export'
END
WHERE transaction_type = 'domestic'
  AND delivery_country IS NOT NULL
  AND delivery_country != 'SI';

-- ============================================================================
-- TRIGGER: Auto-populate order_items compliance fields from product
-- ============================================================================

CREATE OR REPLACE FUNCTION populate_order_item_compliance()
RETURNS TRIGGER AS $$
DECLARE
  product_record RECORD;
BEGIN
  -- Fetch compliance data from product
  SELECT
    is_electrical_equipment,
    trod_category_code,
    default_packaging_type,
    packaging_weight_per_unit_kg
  INTO product_record
  FROM products
  WHERE id = NEW.product_id;

  -- Set TROD fields
  IF product_record.is_electrical_equipment = true THEN
    NEW.applies_trod_fee := true;
    NEW.trod_category_code := product_record.trod_category_code;
  ELSE
    NEW.applies_trod_fee := false;
  END IF;

  -- Set packaging fields
  IF product_record.packaging_weight_per_unit_kg > 0 THEN
    NEW.applies_packaging_fee := true;
    NEW.packaging_type := product_record.default_packaging_type;
    NEW.packaging_weight_kg := product_record.packaging_weight_per_unit_kg * COALESCE(NEW.quantity, 1);
  ELSE
    NEW.applies_packaging_fee := false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS order_item_compliance_trigger ON order_items;
CREATE TRIGGER order_item_compliance_trigger
  BEFORE INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION populate_order_item_compliance();

-- ============================================================================
-- TRIGGER: Auto-set delivery_country and transaction_type on order insert
-- ============================================================================

CREATE OR REPLACE FUNCTION populate_order_compliance()
RETURNS TRIGGER AS $$
DECLARE
  country_code TEXT;
  eu_countries TEXT[] := ARRAY['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
                               'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
                               'PL', 'PT', 'RO', 'SK', 'ES', 'SE'];
BEGIN
  -- Extract country from shipping address if not set
  IF NEW.delivery_country IS NULL AND NEW.shipping_address IS NOT NULL THEN
    country_code := UPPER(COALESCE(
      NEW.shipping_address->>'country_code',
      NEW.shipping_address->>'country',
      NEW.shipping_address->>'countryCode'
    ));
    NEW.delivery_country := country_code;
  END IF;

  -- Set transaction type based on delivery country
  IF NEW.delivery_country IS NOT NULL AND NEW.transaction_type = 'domestic' THEN
    IF NEW.delivery_country = 'SI' THEN
      NEW.transaction_type := 'domestic';
    ELSIF NEW.delivery_country = ANY(eu_countries) THEN
      NEW.transaction_type := 'intra_eu_distance_sale';
    ELSE
      NEW.transaction_type := 'export';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS order_compliance_trigger ON orders;
CREATE TRIGGER order_compliance_trigger
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION populate_order_compliance();

-- ============================================================================
-- INDEXES for reporting queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_products_trod_category ON products(trod_category_code) WHERE is_electrical_equipment = true;
CREATE INDEX IF NOT EXISTS idx_orders_delivery_country ON orders(delivery_country);
CREATE INDEX IF NOT EXISTS idx_orders_transaction_type ON orders(transaction_type);
CREATE INDEX IF NOT EXISTS idx_order_items_trod ON order_items(applies_trod_fee) WHERE applies_trod_fee = true;
CREATE INDEX IF NOT EXISTS idx_order_items_packaging ON order_items(applies_packaging_fee) WHERE applies_packaging_fee = true;
-- Note: 'placed_at' column does not exist in orders table (using created_at instead), skipping index.
