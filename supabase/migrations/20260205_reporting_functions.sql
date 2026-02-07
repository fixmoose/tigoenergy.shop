-- Phase 5: Reporting Functions Migration
-- Provides SQL functions for OSS, Intrastat, TROD, and Packaging Waste reporting

-- ============================================================================
-- EU COUNTRY REFERENCE
-- ============================================================================

-- Helper table for EU member states and VAT rates
CREATE TABLE IF NOT EXISTS eu_member_states (
  country_code TEXT PRIMARY KEY,
  country_name TEXT NOT NULL,
  standard_vat_rate DECIMAL(5,2) NOT NULL,
  is_eurozone BOOLEAN DEFAULT false,
  joined_eu DATE
);

INSERT INTO eu_member_states (country_code, country_name, standard_vat_rate, is_eurozone, joined_eu) VALUES
('AT', 'Austria', 20.00, true, '1995-01-01'),
('BE', 'Belgium', 21.00, true, '1958-01-01'),
('BG', 'Bulgaria', 20.00, false, '2007-01-01'),
('HR', 'Croatia', 25.00, true, '2013-07-01'),
('CY', 'Cyprus', 19.00, true, '2004-05-01'),
('CZ', 'Czechia', 21.00, false, '2004-05-01'),
('DK', 'Denmark', 25.00, false, '1973-01-01'),
('EE', 'Estonia', 22.00, true, '2004-05-01'),
('FI', 'Finland', 24.00, true, '1995-01-01'),
('FR', 'France', 20.00, true, '1958-01-01'),
('DE', 'Germany', 19.00, true, '1958-01-01'),
('GR', 'Greece', 24.00, true, '1981-01-01'),
('HU', 'Hungary', 27.00, false, '2004-05-01'),
('IE', 'Ireland', 23.00, true, '1973-01-01'),
('IT', 'Italy', 22.00, true, '1958-01-01'),
('LV', 'Latvia', 21.00, true, '2004-05-01'),
('LT', 'Lithuania', 21.00, true, '2004-05-01'),
('LU', 'Luxembourg', 17.00, true, '1958-01-01'),
('MT', 'Malta', 18.00, true, '2004-05-01'),
('NL', 'Netherlands', 21.00, true, '1958-01-01'),
('PL', 'Poland', 23.00, false, '2004-05-01'),
('PT', 'Portugal', 23.00, true, '1986-01-01'),
('RO', 'Romania', 19.00, false, '2007-01-01'),
('SK', 'Slovakia', 20.00, true, '2004-05-01'),
('SI', 'Slovenia', 22.00, true, '2004-05-01'),
('ES', 'Spain', 21.00, true, '1986-01-01'),
('SE', 'Sweden', 25.00, false, '1995-01-01')
ON CONFLICT (country_code) DO UPDATE SET
  standard_vat_rate = EXCLUDED.standard_vat_rate,
  is_eurozone = EXCLUDED.is_eurozone;

-- ============================================================================
-- OSS (ONE STOP SHOP) VAT REPORTING
-- ============================================================================

-- Generate OSS report for a specific quarter
-- Returns sales breakdown by EU member state for quarterly OSS filing
CREATE OR REPLACE FUNCTION generate_oss_report(
  p_year INTEGER,
  p_quarter INTEGER
)
RETURNS TABLE (
  member_state TEXT,
  member_state_name TEXT,
  vat_rate DECIMAL(5,2),
  taxable_amount DECIMAL(12,2),
  vat_amount DECIMAL(12,2),
  order_count BIGINT,
  currency TEXT
) AS $$
DECLARE
  quarter_start DATE;
  quarter_end DATE;
BEGIN
  -- Calculate quarter date range
  quarter_start := make_date(p_year, (p_quarter - 1) * 3 + 1, 1);
  quarter_end := (quarter_start + INTERVAL '3 months' - INTERVAL '1 day')::DATE;

  RETURN QUERY
  SELECT
    o.delivery_country AS member_state,
    ems.country_name AS member_state_name,
    ems.standard_vat_rate AS vat_rate,
    SUM(o.subtotal) AS taxable_amount,
    SUM(o.subtotal * ems.standard_vat_rate / 100) AS vat_amount,
    COUNT(*)::BIGINT AS order_count,
    'EUR'::TEXT AS currency
  FROM orders o
  JOIN eu_member_states ems ON ems.country_code = o.delivery_country
  WHERE o.transaction_type = 'intra_eu_distance_sale'
    AND o.payment_status = 'paid'
    AND o.placed_at >= quarter_start
    AND o.placed_at < quarter_end + INTERVAL '1 day'
    AND o.delivery_country != 'SI'  -- Exclude domestic (Slovenia)
  GROUP BY o.delivery_country, ems.country_name, ems.standard_vat_rate
  ORDER BY taxable_amount DESC;
END;
$$ LANGUAGE plpgsql;

-- Get OSS summary for a quarter (totals only)
CREATE OR REPLACE FUNCTION get_oss_summary(
  p_year INTEGER,
  p_quarter INTEGER
)
RETURNS TABLE (
  total_taxable_amount DECIMAL(12,2),
  total_vat_amount DECIMAL(12,2),
  total_orders BIGINT,
  countries_sold_to INTEGER,
  submission_deadline DATE
) AS $$
DECLARE
  quarter_end DATE;
  deadline_days INTEGER;
BEGIN
  quarter_end := make_date(p_year, p_quarter * 3, 1) + INTERVAL '1 month' - INTERVAL '1 day';

  SELECT (value->>'submission_deadline_days_after_quarter')::INTEGER INTO deadline_days
  FROM system_settings WHERE key = 'oss_config';

  RETURN QUERY
  SELECT
    COALESCE(SUM(r.taxable_amount), 0)::DECIMAL(12,2),
    COALESCE(SUM(r.vat_amount), 0)::DECIMAL(12,2),
    COALESCE(SUM(r.order_count), 0)::BIGINT,
    COUNT(DISTINCT r.member_state)::INTEGER,
    (quarter_end + (COALESCE(deadline_days, 20) || ' days')::INTERVAL)::DATE
  FROM generate_oss_report(p_year, p_quarter) r;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INTRASTAT REPORTING
-- ============================================================================

-- Generate Intrastat dispatches report for a specific month
-- Returns data grouped by CN code and destination country
CREATE OR REPLACE FUNCTION generate_intrastat_report(
  p_year INTEGER,
  p_month INTEGER
)
RETURNS TABLE (
  cn_code TEXT,
  destination_country TEXT,
  country_name TEXT,
  statistical_value_eur DECIMAL(12,2),
  net_mass_kg DECIMAL(10,2),
  supplementary_units INTEGER,
  nature_of_transaction TEXT,
  mode_of_transport TEXT,
  order_count BIGINT
) AS $$
DECLARE
  month_start DATE;
  month_end DATE;
BEGIN
  month_start := make_date(p_year, p_month, 1);
  month_end := (month_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  RETURN QUERY
  SELECT
    oi.cn_code,
    o.delivery_country AS destination_country,
    ems.country_name,
    SUM(oi.total_price)::DECIMAL(12,2) AS statistical_value_eur,
    SUM(oi.weight_kg * oi.quantity)::DECIMAL(10,2) AS net_mass_kg,
    SUM(oi.quantity)::INTEGER AS supplementary_units,
    '11'::TEXT AS nature_of_transaction,  -- Outright purchase/sale
    '3'::TEXT AS mode_of_transport,       -- Road transport
    COUNT(DISTINCT o.id)::BIGINT AS order_count
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  LEFT JOIN eu_member_states ems ON ems.country_code = o.delivery_country
  WHERE o.transaction_type = 'intra_eu_distance_sale'
    AND o.payment_status = 'paid'
    AND o.shipped_at >= month_start
    AND o.shipped_at < month_end + INTERVAL '1 day'
    AND o.delivery_country != 'SI'
    AND oi.cn_code IS NOT NULL
  GROUP BY oi.cn_code, o.delivery_country, ems.country_name
  ORDER BY statistical_value_eur DESC;
END;
$$ LANGUAGE plpgsql;

-- Get Intrastat summary with threshold check
CREATE OR REPLACE FUNCTION get_intrastat_summary(
  p_year INTEGER,
  p_month INTEGER
)
RETURNS TABLE (
  monthly_value_eur DECIMAL(12,2),
  monthly_weight_kg DECIMAL(10,2),
  monthly_shipments BIGINT,
  ytd_dispatches_eur DECIMAL(12,2),
  threshold_eur DECIMAL(12,2),
  threshold_exceeded BOOLEAN,
  submission_deadline DATE
) AS $$
DECLARE
  config_threshold DECIMAL(12,2);
  config_deadline_day INTEGER;
  year_start DATE;
  month_end DATE;
BEGIN
  year_start := make_date(p_year, 1, 1);
  month_end := make_date(p_year, p_month, 1) + INTERVAL '1 month' - INTERVAL '1 day';

  SELECT
    (value->>'threshold_dispatches_eur')::DECIMAL(12,2),
    (value->>'submission_deadline_day')::INTEGER
  INTO config_threshold, config_deadline_day
  FROM system_settings WHERE key = 'intrastat_config';

  RETURN QUERY
  WITH monthly_stats AS (
    SELECT
      COALESCE(SUM(r.statistical_value_eur), 0) AS monthly_val,
      COALESCE(SUM(r.net_mass_kg), 0) AS monthly_wt,
      COALESCE(SUM(r.order_count), 0) AS monthly_cnt
    FROM generate_intrastat_report(p_year, p_month) r
  ),
  ytd_stats AS (
    SELECT COALESCE(SUM(oi.total_price), 0) AS ytd_val
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.transaction_type = 'intra_eu_distance_sale'
      AND o.payment_status = 'paid'
      AND o.shipped_at >= year_start
      AND o.shipped_at <= month_end
      AND o.delivery_country != 'SI'
  )
  SELECT
    ms.monthly_val::DECIMAL(12,2),
    ms.monthly_wt::DECIMAL(10,2),
    ms.monthly_cnt::BIGINT,
    ys.ytd_val::DECIMAL(12,2),
    config_threshold,
    (ys.ytd_val >= config_threshold) AS threshold_exceeded,
    make_date(
      CASE WHEN p_month = 12 THEN p_year + 1 ELSE p_year END,
      CASE WHEN p_month = 12 THEN 1 ELSE p_month + 1 END,
      LEAST(config_deadline_day, 28)
    ) AS submission_deadline
  FROM monthly_stats ms, ytd_stats ys;
END;
$$ LANGUAGE plpgsql;

-- Populate intrastat_reports table for a month (for historical tracking)
CREATE OR REPLACE FUNCTION save_intrastat_report(
  p_year INTEGER,
  p_month INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  rows_inserted INTEGER := 0;
BEGIN
  INSERT INTO intrastat_reports (
    year, month, destination_country, cn_code,
    total_value_eur, total_weight_kg, transaction_count,
    nature_of_transaction, mode_of_transport, order_ids
  )
  SELECT
    p_year,
    p_month,
    r.destination_country,
    r.cn_code,
    r.statistical_value_eur,
    r.net_mass_kg,
    r.order_count::INTEGER,
    r.nature_of_transaction,
    r.mode_of_transport,
    (
      SELECT jsonb_agg(DISTINCT o.id)
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      WHERE o.transaction_type = 'intra_eu_distance_sale'
        AND o.payment_status = 'paid'
        AND o.shipped_at >= make_date(p_year, p_month, 1)
        AND o.shipped_at < make_date(p_year, p_month, 1) + INTERVAL '1 month'
        AND o.delivery_country = r.destination_country
        AND oi.cn_code = r.cn_code
    )
  FROM generate_intrastat_report(p_year, p_month) r
  ON CONFLICT (year, month, destination_country, cn_code)
  DO UPDATE SET
    total_value_eur = EXCLUDED.total_value_eur,
    total_weight_kg = EXCLUDED.total_weight_kg,
    transaction_count = EXCLUDED.transaction_count,
    order_ids = EXCLUDED.order_ids;

  GET DIAGNOSTICS rows_inserted = ROW_COUNT;
  RETURN rows_inserted;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TROD (WEEE) REPORTING
-- ============================================================================

-- Generate TROD report for a specific quarter
-- Returns quantities and fees by WEEE category
CREATE OR REPLACE FUNCTION generate_trod_report(
  p_year INTEGER,
  p_quarter INTEGER
)
RETURNS TABLE (
  trod_category TEXT,
  category_description TEXT,
  units_sold INTEGER,
  total_weight_kg DECIMAL(10,2),
  fee_rate_per_kg DECIMAL(6,2),
  total_fee_eur DECIMAL(10,2),
  order_count BIGINT
) AS $$
DECLARE
  quarter_start DATE;
  quarter_end DATE;
  category_rates JSONB;
BEGIN
  quarter_start := make_date(p_year, (p_quarter - 1) * 3 + 1, 1);
  quarter_end := (quarter_start + INTERVAL '3 months' - INTERVAL '1 day')::DATE;

  SELECT value->'category_rates' INTO category_rates
  FROM system_settings WHERE key = 'trod_config';

  RETURN QUERY
  SELECT
    oi.trod_category_code AS trod_category,
    CASE oi.trod_category_code
      WHEN '1' THEN 'Large Household Appliances'
      WHEN '2' THEN 'Small Household Appliances'
      WHEN '3' THEN 'IT and Telecommunications'
      WHEN '4' THEN 'Consumer Equipment'
      WHEN '5' THEN 'Lighting Equipment'
      WHEN '6' THEN 'Electrical and Electronic Tools'
      WHEN '7' THEN 'Photovoltaic Panels'
      ELSE 'Unknown'
    END AS category_description,
    SUM(oi.quantity)::INTEGER AS units_sold,
    SUM(oi.weight_kg * oi.quantity)::DECIMAL(10,2) AS total_weight_kg,
    (category_rates->>oi.trod_category_code)::DECIMAL(6,2) AS fee_rate_per_kg,
    (SUM(oi.weight_kg * oi.quantity) * (category_rates->>oi.trod_category_code)::DECIMAL)::DECIMAL(10,2) AS total_fee_eur,
    COUNT(DISTINCT o.id)::BIGINT AS order_count
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE oi.applies_trod_fee = true
    AND o.payment_status = 'paid'
    AND o.placed_at >= quarter_start
    AND o.placed_at < quarter_end + INTERVAL '1 day'
  GROUP BY oi.trod_category_code
  ORDER BY total_fee_eur DESC;
END;
$$ LANGUAGE plpgsql;

-- Get TROD summary for a quarter
CREATE OR REPLACE FUNCTION get_trod_summary(
  p_year INTEGER,
  p_quarter INTEGER
)
RETURNS TABLE (
  total_units INTEGER,
  total_weight_kg DECIMAL(10,2),
  total_fee_eur DECIMAL(10,2),
  categories_count INTEGER,
  reporting_authority TEXT
) AS $$
DECLARE
  authority TEXT;
BEGIN
  SELECT value->>'reporting_authority' INTO authority
  FROM system_settings WHERE key = 'trod_config';

  RETURN QUERY
  SELECT
    COALESCE(SUM(r.units_sold), 0)::INTEGER,
    COALESCE(SUM(r.total_weight_kg), 0)::DECIMAL(10,2),
    COALESCE(SUM(r.total_fee_eur), 0)::DECIMAL(10,2),
    COUNT(DISTINCT r.trod_category)::INTEGER,
    COALESCE(authority, 'FURS')::TEXT
  FROM generate_trod_report(p_year, p_quarter) r;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PACKAGING WASTE REPORTING
-- ============================================================================

-- Generate packaging waste report for a specific year
-- Returns weight totals by material type
CREATE OR REPLACE FUNCTION generate_packaging_report(
  p_year INTEGER
)
RETURNS TABLE (
  material_type TEXT,
  total_weight_kg DECIMAL(10,2),
  fee_rate_per_kg DECIMAL(6,3),
  total_fee_eur DECIMAL(10,2),
  order_count BIGINT,
  percentage_of_total DECIMAL(5,2)
) AS $$
DECLARE
  year_start DATE;
  year_end DATE;
  material_rates JSONB;
  grand_total DECIMAL(10,2);
BEGIN
  year_start := make_date(p_year, 1, 1);
  year_end := make_date(p_year, 12, 31);

  SELECT value->'material_rates' INTO material_rates
  FROM system_settings WHERE key = 'packaging_waste_config';

  -- Calculate grand total first
  SELECT COALESCE(SUM(oi.packaging_weight_kg), 0) INTO grand_total
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE oi.applies_packaging_fee = true
    AND o.payment_status = 'paid'
    AND o.placed_at >= year_start
    AND o.placed_at <= year_end;

  RETURN QUERY
  SELECT
    oi.packaging_type AS material_type,
    SUM(oi.packaging_weight_kg)::DECIMAL(10,2) AS total_weight_kg,
    (material_rates->>oi.packaging_type)::DECIMAL(6,3) AS fee_rate_per_kg,
    (SUM(oi.packaging_weight_kg) * (material_rates->>oi.packaging_type)::DECIMAL)::DECIMAL(10,2) AS total_fee_eur,
    COUNT(DISTINCT o.id)::BIGINT AS order_count,
    CASE WHEN grand_total > 0
      THEN (SUM(oi.packaging_weight_kg) / grand_total * 100)::DECIMAL(5,2)
      ELSE 0
    END AS percentage_of_total
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  WHERE oi.applies_packaging_fee = true
    AND oi.packaging_type IS NOT NULL
    AND o.payment_status = 'paid'
    AND o.placed_at >= year_start
    AND o.placed_at <= year_end
  GROUP BY oi.packaging_type
  ORDER BY total_weight_kg DESC;
END;
$$ LANGUAGE plpgsql;

-- Get packaging summary with threshold check
CREATE OR REPLACE FUNCTION get_packaging_summary(
  p_year INTEGER
)
RETURNS TABLE (
  total_weight_kg DECIMAL(10,2),
  total_fee_eur DECIMAL(10,2),
  threshold_kg DECIMAL(10,2),
  threshold_exceeded BOOLEAN,
  material_types_count INTEGER
) AS $$
DECLARE
  config_threshold DECIMAL(10,2);
BEGIN
  SELECT (value->>'reporting_threshold_kg')::DECIMAL(10,2) INTO config_threshold
  FROM system_settings WHERE key = 'packaging_waste_config';

  RETURN QUERY
  SELECT
    COALESCE(SUM(r.total_weight_kg), 0)::DECIMAL(10,2),
    COALESCE(SUM(r.total_fee_eur), 0)::DECIMAL(10,2),
    config_threshold,
    (COALESCE(SUM(r.total_weight_kg), 0) >= config_threshold) AS threshold_exceeded,
    COUNT(DISTINCT r.material_type)::INTEGER
  FROM generate_packaging_report(p_year) r;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- THRESHOLD MONITORING
-- ============================================================================

-- Check all compliance thresholds and return warnings
CREATE OR REPLACE FUNCTION check_reporting_thresholds()
RETURNS TABLE (
  report_type TEXT,
  metric TEXT,
  current_value DECIMAL(12,2),
  threshold_value DECIMAL(12,2),
  percentage_of_threshold DECIMAL(5,2),
  status TEXT,
  action_required TEXT
) AS $$
DECLARE
  current_year INTEGER;
  current_quarter INTEGER;
  current_month INTEGER;
  intrastat_threshold DECIMAL(12,2);
  packaging_threshold DECIMAL(10,2);
BEGIN
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  current_quarter := EXTRACT(QUARTER FROM CURRENT_DATE)::INTEGER;
  current_month := EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER;

  -- Get thresholds from config
  SELECT (value->>'threshold_dispatches_eur')::DECIMAL(12,2) INTO intrastat_threshold
  FROM system_settings WHERE key = 'intrastat_config';

  SELECT (value->>'reporting_threshold_kg')::DECIMAL(10,2) INTO packaging_threshold
  FROM system_settings WHERE key = 'packaging_waste_config';

  -- Intrastat YTD check
  RETURN QUERY
  WITH ytd_intrastat AS (
    SELECT COALESCE(SUM(oi.total_price), 0) AS ytd_val
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.transaction_type = 'intra_eu_distance_sale'
      AND o.payment_status = 'paid'
      AND o.shipped_at >= make_date(current_year, 1, 1)
      AND o.delivery_country != 'SI'
  )
  SELECT
    'Intrastat'::TEXT,
    'YTD Dispatches (EUR)'::TEXT,
    ytd_val::DECIMAL(12,2),
    intrastat_threshold,
    (ytd_val / NULLIF(intrastat_threshold, 0) * 100)::DECIMAL(5,2),
    CASE
      WHEN ytd_val >= intrastat_threshold THEN 'EXCEEDED'
      WHEN ytd_val >= intrastat_threshold * 0.8 THEN 'WARNING'
      ELSE 'OK'
    END,
    CASE
      WHEN ytd_val >= intrastat_threshold THEN 'Monthly Intrastat reporting required'
      WHEN ytd_val >= intrastat_threshold * 0.8 THEN 'Approaching threshold - prepare for reporting'
      ELSE 'No action required'
    END
  FROM ytd_intrastat;

  -- Packaging YTD check
  RETURN QUERY
  WITH ytd_packaging AS (
    SELECT COALESCE(SUM(oi.packaging_weight_kg), 0) AS ytd_wt
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE oi.applies_packaging_fee = true
      AND o.payment_status = 'paid'
      AND o.placed_at >= make_date(current_year, 1, 1)
  )
  SELECT
    'Packaging Waste'::TEXT,
    'YTD Weight (kg)'::TEXT,
    ytd_wt::DECIMAL(12,2),
    packaging_threshold::DECIMAL(12,2),
    (ytd_wt / NULLIF(packaging_threshold, 0) * 100)::DECIMAL(5,2),
    CASE
      WHEN ytd_wt >= packaging_threshold THEN 'EXCEEDED'
      WHEN ytd_wt >= packaging_threshold * 0.8 THEN 'WARNING'
      ELSE 'OK'
    END,
    CASE
      WHEN ytd_wt >= packaging_threshold THEN 'Annual packaging waste reporting required'
      WHEN ytd_wt >= packaging_threshold * 0.8 THEN 'Approaching threshold - track closely'
      ELSE 'No action required'
    END
  FROM ytd_packaging;

  -- OSS quarterly sales check (€10,000 threshold for registration)
  RETURN QUERY
  WITH ytd_oss AS (
    SELECT COALESCE(SUM(o.subtotal), 0) AS ytd_val
    FROM orders o
    WHERE o.transaction_type = 'intra_eu_distance_sale'
      AND o.payment_status = 'paid'
      AND o.placed_at >= make_date(current_year, 1, 1)
      AND o.delivery_country != 'SI'
  )
  SELECT
    'OSS VAT'::TEXT,
    'YTD EU Distance Sales (EUR)'::TEXT,
    ytd_val::DECIMAL(12,2),
    10000.00::DECIMAL(12,2),  -- OSS threshold
    (ytd_val / 10000.0 * 100)::DECIMAL(5,2),
    CASE
      WHEN ytd_val >= 10000 THEN 'REGISTERED'
      WHEN ytd_val >= 8000 THEN 'WARNING'
      ELSE 'OK'
    END,
    CASE
      WHEN ytd_val >= 10000 THEN 'OSS quarterly reporting required'
      WHEN ytd_val >= 8000 THEN 'Approaching OSS threshold'
      ELSE 'Below OSS threshold - domestic VAT rules apply'
    END
  FROM ytd_oss;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DASHBOARD / REPORTING VIEWS
-- ============================================================================

-- Compliance dashboard summary view
CREATE OR REPLACE VIEW compliance_dashboard AS
SELECT
  'OSS' AS report_type,
  'Q' || EXTRACT(QUARTER FROM CURRENT_DATE)::TEXT || ' ' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT AS period,
  s.total_taxable_amount AS amount,
  s.total_orders AS count,
  s.submission_deadline AS deadline
FROM get_oss_summary(
  EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  EXTRACT(QUARTER FROM CURRENT_DATE)::INTEGER
) s

UNION ALL

SELECT
  'Intrastat' AS report_type,
  TO_CHAR(CURRENT_DATE, 'Mon YYYY') AS period,
  i.monthly_value_eur AS amount,
  i.monthly_shipments AS count,
  i.submission_deadline AS deadline
FROM get_intrastat_summary(
  EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
) i

UNION ALL

SELECT
  'TROD' AS report_type,
  'Q' || EXTRACT(QUARTER FROM CURRENT_DATE)::TEXT || ' ' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT AS period,
  t.total_fee_eur AS amount,
  t.total_units AS count,
  NULL::DATE AS deadline
FROM get_trod_summary(
  EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  EXTRACT(QUARTER FROM CURRENT_DATE)::INTEGER
) t

UNION ALL

SELECT
  'Packaging' AS report_type,
  EXTRACT(YEAR FROM CURRENT_DATE)::TEXT AS period,
  p.total_fee_eur AS amount,
  p.total_weight_kg::BIGINT AS count,
  NULL::DATE AS deadline
FROM get_packaging_summary(
  EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
) p;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get reporting calendar for current year
CREATE OR REPLACE FUNCTION get_reporting_calendar(p_year INTEGER DEFAULT NULL)
RETURNS TABLE (
  report_type TEXT,
  period_name TEXT,
  period_start DATE,
  period_end DATE,
  submission_deadline DATE,
  status TEXT
) AS $$
DECLARE
  v_year INTEGER;
  oss_deadline_days INTEGER;
  intrastat_deadline_day INTEGER;
BEGIN
  v_year := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER);

  SELECT (value->>'submission_deadline_days_after_quarter')::INTEGER INTO oss_deadline_days
  FROM system_settings WHERE key = 'oss_config';

  SELECT (value->>'submission_deadline_day')::INTEGER INTO intrastat_deadline_day
  FROM system_settings WHERE key = 'intrastat_config';

  -- OSS quarters
  FOR i IN 1..4 LOOP
    RETURN QUERY SELECT
      'OSS'::TEXT,
      'Q' || i::TEXT || ' ' || v_year::TEXT,
      make_date(v_year, (i-1)*3 + 1, 1),
      (make_date(v_year, i*3, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE,
      (make_date(v_year, i*3, 1) + INTERVAL '1 month' - INTERVAL '1 day' + (oss_deadline_days || ' days')::INTERVAL)::DATE,
      CASE
        WHEN make_date(v_year, i*3, 1) + INTERVAL '1 month' - INTERVAL '1 day' < CURRENT_DATE THEN 'PAST'
        WHEN make_date(v_year, (i-1)*3 + 1, 1) <= CURRENT_DATE THEN 'CURRENT'
        ELSE 'FUTURE'
      END;
  END LOOP;

  -- Intrastat months
  FOR i IN 1..12 LOOP
    RETURN QUERY SELECT
      'Intrastat'::TEXT,
      TO_CHAR(make_date(v_year, i, 1), 'Mon YYYY'),
      make_date(v_year, i, 1),
      (make_date(v_year, i, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE,
      make_date(
        CASE WHEN i = 12 THEN v_year + 1 ELSE v_year END,
        CASE WHEN i = 12 THEN 1 ELSE i + 1 END,
        LEAST(intrastat_deadline_day, 28)
      ),
      CASE
        WHEN make_date(v_year, i, 1) + INTERVAL '1 month' - INTERVAL '1 day' < CURRENT_DATE THEN 'PAST'
        WHEN make_date(v_year, i, 1) <= CURRENT_DATE THEN 'CURRENT'
        ELSE 'FUTURE'
      END;
  END LOOP;

  -- TROD quarters
  FOR i IN 1..4 LOOP
    RETURN QUERY SELECT
      'TROD'::TEXT,
      'Q' || i::TEXT || ' ' || v_year::TEXT,
      make_date(v_year, (i-1)*3 + 1, 1),
      (make_date(v_year, i*3, 1) + INTERVAL '1 month' - INTERVAL '1 day')::DATE,
      NULL::DATE,  -- TROD deadlines vary
      CASE
        WHEN make_date(v_year, i*3, 1) + INTERVAL '1 month' - INTERVAL '1 day' < CURRENT_DATE THEN 'PAST'
        WHEN make_date(v_year, (i-1)*3 + 1, 1) <= CURRENT_DATE THEN 'CURRENT'
        ELSE 'FUTURE'
      END;
  END LOOP;

  -- Packaging annual
  RETURN QUERY SELECT
    'Packaging'::TEXT,
    v_year::TEXT,
    make_date(v_year, 1, 1),
    make_date(v_year, 12, 31),
    make_date(v_year + 1, 3, 31),  -- Typically due by end of Q1 next year
    CASE
      WHEN v_year < EXTRACT(YEAR FROM CURRENT_DATE) THEN 'PAST'
      WHEN v_year = EXTRACT(YEAR FROM CURRENT_DATE) THEN 'CURRENT'
      ELSE 'FUTURE'
    END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANTS (adjust based on your role setup)
-- ============================================================================

-- Grant execute on all reporting functions to authenticated users
-- Uncomment and adjust roles as needed:
-- GRANT EXECUTE ON FUNCTION generate_oss_report(INTEGER, INTEGER) TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_oss_summary(INTEGER, INTEGER) TO authenticated;
-- GRANT EXECUTE ON FUNCTION generate_intrastat_report(INTEGER, INTEGER) TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_intrastat_summary(INTEGER, INTEGER) TO authenticated;
-- GRANT EXECUTE ON FUNCTION save_intrastat_report(INTEGER, INTEGER) TO authenticated;
-- GRANT EXECUTE ON FUNCTION generate_trod_report(INTEGER, INTEGER) TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_trod_summary(INTEGER, INTEGER) TO authenticated;
-- GRANT EXECUTE ON FUNCTION generate_packaging_report(INTEGER) TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_packaging_summary(INTEGER) TO authenticated;
-- GRANT EXECUTE ON FUNCTION check_reporting_thresholds() TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_reporting_calendar(INTEGER) TO authenticated;
-- GRANT SELECT ON compliance_dashboard TO authenticated;
-- GRANT SELECT ON eu_member_states TO authenticated;
