-- TIGO ENERGY EU - COMPLETE DATABASE SCHEMA
-- Full automation: orders, inventory, invoicing, intrastat, shipping

-- ============================================================================
-- PRODUCTS & CATALOG
-- ============================================================================

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT UNIQUE NOT NULL,
  
  -- Multi-language product info
  name_en TEXT NOT NULL,
  name_de TEXT,
  name_sl TEXT,
  name_fr TEXT,
  name_it TEXT,
  name_es TEXT,
  name_nl TEXT,
  name_pl TEXT,
  
  description_en TEXT,
  description_de TEXT,
  description_sl TEXT,
  description_fr TEXT,
  description_it TEXT,
  description_es TEXT,
  description_nl TEXT,
  description_pl TEXT,
  
  -- Product details
  category TEXT NOT NULL, -- 'optimizer', 'inverter', 'battery', 'accessory', 'monitoring'
  subcategory TEXT,
  
  -- Pricing
  cost_eur DECIMAL(10,2) NOT NULL, -- Your cost from Tigo
  price_eur DECIMAL(10,2) NOT NULL, -- Retail price
  b2b_price_eur DECIMAL(10,2), -- Optional B2B pricing
  currency TEXT DEFAULT 'EUR',
  
  -- Inventory
  stock_quantity INTEGER DEFAULT 0,
  reserved_quantity INTEGER DEFAULT 0, -- Items in unpaid orders
  low_stock_threshold INTEGER DEFAULT 10,
  
  -- Shipping
  weight_kg DECIMAL(6,2) NOT NULL, -- For shipping calculation
  dimensions_cm JSONB, -- {length, width, height}
  
  -- Intrastat/Customs
  cn_code TEXT, -- Commodity code (EU Combined Nomenclature)
  country_of_origin TEXT DEFAULT 'US', -- Tigo is USA
  
  -- Media
  images JSONB, -- ["url1", "url2", ...]
  datasheet_url TEXT,
  manual_url TEXT,
  
  -- Technical specs (for product pages)
  specifications JSONB,
  
  -- SEO
  slug TEXT UNIQUE,
  meta_title JSONB, -- {"en": "...", "de": "..."}
  meta_description JSONB,
  
  -- Status
  active BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_active ON products(active);

-- ============================================================================
-- INVENTORY MANAGEMENT
-- ============================================================================

CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  
  movement_type TEXT NOT NULL, -- 'in', 'out', 'adjustment', 'reserved', 'released'
  quantity INTEGER NOT NULL, -- Positive for IN, negative for OUT
  
  -- Reference (what caused this movement)
  reference_type TEXT, -- 'purchase', 'sale', 'adjustment', 'return'
  reference_id UUID, -- Order ID, purchase order ID, etc.
  
  -- Stock levels after this movement
  stock_after INTEGER NOT NULL,
  
  -- Details
  notes TEXT,
  cost_per_unit DECIMAL(10,2), -- For stock valuation
  
  created_by UUID, -- Admin user who made the change
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_product ON inventory_movements(product_id);
CREATE INDEX idx_inventory_reference ON inventory_movements(reference_type, reference_id);

-- ============================================================================
-- CUSTOMERS
-- ============================================================================

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  
  -- Company info (B2B)
  company_name TEXT,
  vat_id TEXT,
  vat_validated BOOLEAN DEFAULT false,
  vat_validated_at TIMESTAMPTZ,
  
  -- Personal info
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  
  -- Classification
  is_b2b BOOLEAN DEFAULT false,
  customer_type TEXT, -- 'contractor', 'installer', 'distributor', 'homeowner'
  
  -- Account
  account_status TEXT DEFAULT 'active', -- 'active', 'suspended', 'blocked'
  
  -- Addresses (array of address objects)
  addresses JSONB,
  default_shipping_address_id TEXT,
  default_billing_address_id TEXT,
  
  -- Marketing
  newsletter_subscribed BOOLEAN DEFAULT false,
  marketing_consent BOOLEAN DEFAULT false,
  
  -- Internal notes
  internal_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_vat ON customers(vat_id);

-- ============================================================================
-- NEWSLETTER SUBSCRIPTIONS
-- ============================================================================

CREATE TABLE newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  
  -- Subscription details
  status TEXT DEFAULT 'active', -- 'active', 'unsubscribed', 'bounced'
  source TEXT, -- 'checkout', 'footer', 'manual'
  market TEXT, -- 'de', 'si', 'fr', etc.
  language TEXT, -- Preferred language
  
  -- Segmentation (optional)
  customer_type TEXT, -- 'b2b', 'b2c'
  interests JSONB, -- ["solar", "batteries", "inverters"]
  
  -- Engagement tracking
  confirmed BOOLEAN DEFAULT false,
  confirmed_at TIMESTAMPTZ,
  last_email_sent_at TIMESTAMPTZ,
  email_opens_count INTEGER DEFAULT 0,
  email_clicks_count INTEGER DEFAULT 0,
  
  -- Unsubscribe
  unsubscribed_at TIMESTAMPTZ,
  unsubscribe_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_newsletter_email ON newsletter_subscribers(email);
CREATE INDEX idx_newsletter_status ON newsletter_subscribers(status);
CREATE INDEX idx_newsletter_market ON newsletter_subscribers(market);

-- Newsletter campaigns (for tracking)
CREATE TABLE newsletter_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  
  -- Targeting
  target_markets TEXT[], -- ['de', 'si'] or null for all
  target_languages TEXT[], -- ['de', 'en'] or null for all
  target_customer_types TEXT[], -- ['b2b'] or null for all
  
  -- Content
  html_content TEXT NOT NULL,
  preview_text TEXT,
  
  -- Status
  status TEXT DEFAULT 'draft', -- 'draft', 'scheduled', 'sent'
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  recipients_count INTEGER DEFAULT 0,
  opens_count INTEGER DEFAULT 0,
  clicks_count INTEGER DEFAULT 0,
  
  -- Created by
  created_by UUID,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaigns_status ON newsletter_campaigns(status);
CREATE INDEX idx_campaigns_sent ON newsletter_campaigns(sent_at DESC);

-- ============================================================================
-- ORDERS
-- ============================================================================

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL, -- Format: SI-2026-00001
  
  -- Customer
  customer_id UUID REFERENCES customers(id),
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  
  -- Company (B2B)
  company_name TEXT,
  vat_id TEXT,
  vat_validated BOOLEAN DEFAULT false,
  
  -- Addresses
  shipping_address JSONB NOT NULL,
  billing_address JSONB NOT NULL,
  
  -- Pricing
  subtotal DECIMAL(10,2) NOT NULL,
  shipping_cost DECIMAL(10,2) NOT NULL,
  vat_rate DECIMAL(5,2) NOT NULL,
  vat_amount DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  
  -- Order details
  market TEXT NOT NULL, -- 'de', 'si', 'fr', etc. (from domain)
  language TEXT NOT NULL, -- 'de', 'en', 'sl', etc.
  is_b2b BOOLEAN DEFAULT false,
  
  -- Status tracking
  status TEXT DEFAULT 'pending', -- pending, paid, processing, shipped, delivered, cancelled, refunded
  payment_status TEXT DEFAULT 'unpaid', -- unpaid, paid, partially_paid, refunded
  fulfillment_status TEXT DEFAULT 'unfulfilled', -- unfulfilled, fulfilled, partially_fulfilled
  
  -- Payment
  payment_method TEXT, -- 'wise', 'stripe', 'bank_transfer'
  payment_intent_id TEXT, -- Wise/Stripe transaction ID
  paid_at TIMESTAMPTZ,
  
  -- Shipping
  shipping_carrier TEXT DEFAULT 'GLS',
  shipping_method TEXT, -- 'standard', 'express'
  tracking_number TEXT,
  tracking_url TEXT,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  estimated_delivery TIMESTAMPTZ,
  
  -- Shipping label
  shipping_label_url TEXT, -- PDF stored in Supabase storage
  shipping_label_created_at TIMESTAMPTZ,
  
  -- Documents
  invoice_number TEXT UNIQUE, -- Format: SI-INV-2026-00001
  invoice_url TEXT, -- PDF stored in Supabase storage
  invoice_created_at TIMESTAMPTZ,
  
  packing_slip_url TEXT, -- PDF stored in Supabase storage
  
  -- Intrastat
  intrastat_reported BOOLEAN DEFAULT false,
  intrastat_report_date DATE,
  
  -- Weight for shipping
  total_weight_kg DECIMAL(8,2),
  
  -- Notes
  customer_notes TEXT,
  internal_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ
);

CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_market ON orders(market);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- ============================================================================
-- ORDER ITEMS
-- ============================================================================

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  
  -- For cost tracking
  unit_cost DECIMAL(10,2), -- Your cost
  
  -- Product details at time of order (in case product changes later)
  weight_kg DECIMAL(6,2),
  cn_code TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- ============================================================================
-- INVOICES (Generated automatically)
-- ============================================================================

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT UNIQUE NOT NULL, -- Format: SI-INV-2026-00001
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  
  -- Customer
  customer_id UUID REFERENCES customers(id),
  customer_email TEXT NOT NULL,
  
  -- Company (B2B)
  company_name TEXT,
  vat_id TEXT,
  
  -- Addresses
  billing_address JSONB NOT NULL,
  
  -- Amounts
  subtotal DECIMAL(10,2) NOT NULL,
  vat_rate DECIMAL(5,2) NOT NULL,
  vat_amount DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  
  -- Invoice details
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'unpaid', -- unpaid, paid, overdue, cancelled
  paid_at TIMESTAMPTZ,
  
  -- PDF
  pdf_url TEXT, -- Stored in Supabase storage
  
  -- Language
  language TEXT NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_order ON invoices(order_id);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_date ON invoices(invoice_date DESC);

-- ============================================================================
-- SHIPPING RATES (GLS)
-- ============================================================================

CREATE TABLE shipping_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Destination
  country_code TEXT NOT NULL, -- ISO 2-letter code
  zone TEXT, -- 'domestic', 'eu', 'international'
  
  -- Weight brackets
  min_weight_kg DECIMAL(5,2) DEFAULT 0,
  max_weight_kg DECIMAL(5,2),
  
  -- Pricing
  rate_eur DECIMAL(10,2) NOT NULL,
  
  -- Carrier
  carrier TEXT DEFAULT 'GLS',
  service_type TEXT, -- 'standard', 'express'
  
  -- Status
  active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shipping_rates_country ON shipping_rates(country_code);

-- ============================================================================
-- INTRASTAT REPORTING
-- ============================================================================

-- This table stores monthly aggregated data for Intrastat reporting
CREATE TABLE intrastat_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Report period
  year INTEGER NOT NULL,
  month INTEGER NOT NULL, -- 1-12
  
  -- Destination
  destination_country TEXT NOT NULL, -- ISO 2-letter
  
  -- Product classification
  cn_code TEXT NOT NULL, -- Commodity code
  
  -- Aggregated data
  total_value_eur DECIMAL(12,2) NOT NULL,
  total_weight_kg DECIMAL(10,2) NOT NULL,
  transaction_count INTEGER NOT NULL,
  
  -- Intrastat codes
  nature_of_transaction TEXT DEFAULT '11', -- 11 = Outright purchase/sale
  mode_of_transport TEXT DEFAULT '3', -- 3 = Road transport
  
  -- Status
  reported BOOLEAN DEFAULT false,
  reported_at TIMESTAMPTZ,
  
  -- Orders included in this report
  order_ids JSONB, -- Array of order IDs
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(year, month, destination_country, cn_code)
);

CREATE INDEX idx_intrastat_period ON intrastat_reports(year, month);
CREATE INDEX idx_intrastat_country ON intrastat_reports(destination_country);

-- ============================================================================
-- WAREHOUSE TASKS (For warehouse workers)
-- ============================================================================

CREATE TABLE warehouse_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  
  task_type TEXT NOT NULL, -- 'pick', 'pack', 'ship'
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed
  
  -- Assigned to
  assigned_to UUID, -- User ID of warehouse worker
  
  -- Task details
  priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
  
  -- Completion
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_warehouse_tasks_order ON warehouse_tasks(order_id);
CREATE INDEX idx_warehouse_tasks_status ON warehouse_tasks(status);

-- ============================================================================
-- ADMIN USERS (For multi-user access)
-- ============================================================================

CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  
  -- Name
  first_name TEXT,
  last_name TEXT,
  
  -- Role
  role TEXT NOT NULL, -- 'admin', 'warehouse', 'sales', 'readonly'
  
  -- Permissions
  permissions JSONB, -- {"can_edit_products": true, "can_process_orders": true, etc.}
  
  -- Status
  active BOOLEAN DEFAULT true,
  
  -- Linked to Supabase Auth
  auth_user_id UUID UNIQUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- AUDIT LOG (Track all important actions)
-- ============================================================================

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Who
  user_id UUID,
  user_email TEXT,
  
  -- What
  action TEXT NOT NULL, -- 'order_created', 'payment_received', 'order_shipped', etc.
  entity_type TEXT NOT NULL, -- 'order', 'product', 'customer', etc.
  entity_id UUID,
  
  -- Details
  changes JSONB, -- Before/after values
  metadata JSONB, -- Additional context
  
  -- When
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- ============================================================================
-- SYSTEM SETTINGS
-- ============================================================================

CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pre-populate some settings
INSERT INTO system_settings (key, value, description) VALUES
('company_info', '{
  "name": "Initra Energija d.o.o.",
  "address": "Podsmreka 59A",
  "city": "Dobrova",
  "postal_code": "1356",
  "country": "Slovenia",
  "vat_id": "SI62518313",
  "registration_number": "9624007000",
  "email": "info@adriapower.si",
  "phone": "+386 XX XXX XXX",
  "website": "https://adriapower.si"
}'::jsonb, 'Company information for invoices'),

('order_number_prefix', '{
  "si": "SI",
  "de": "DE",
  "fr": "FR",
  "it": "IT"
}'::jsonb, 'Order number prefixes by market'),

('invoice_number_format', '{"prefix": "INV", "year": true, "padding": 5}'::jsonb, 'Invoice numbering format'),

('email_settings', '{
  "from_name": "Tigo Energy EU",
  "from_email": "orders@tigoenergy.si",
  "reply_to": "support@tigoenergy.si"
}'::jsonb, 'Email sending configuration'),

('vat_rates', '{
  "SI": 22,
  "DE": 19,
  "FR": 20,
  "IT": 22,
  "ES": 21,
  "NL": 21,
  "BE": 21,
  "AT": 20,
  "PL": 23,
  "CZ": 21,
  "SK": 20
}'::jsonb, 'VAT rates by country'),

('low_stock_alert_threshold', '10'::jsonb, 'Alert when stock falls below this level');

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-update product stock when inventory movement happens
CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET stock_quantity = stock_quantity + NEW.quantity
  WHERE id = NEW.product_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stock_on_movement AFTER INSERT ON inventory_movements
  FOR EACH ROW EXECUTE FUNCTION update_product_stock();
