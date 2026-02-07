-- Phase 5: Reporting Logic Functions
-- Implements aggregation logic for OSS, Intrastat, TROD, and Packaging Waste

-- ============================================================================
-- OSS (One Stop Shop) Reporting Logic
-- ============================================================================

-- Function to generate detailed OSS report
CREATE OR REPLACE FUNCTION generate_oss_report(p_year INTEGER, p_quarter INTEGER)
RETURNS TABLE (
  member_state TEXT,
  vat_rate DECIMAL(5,2),
  taxable_amount DECIMAL(12,2),
  vat_amount DECIMAL(12,2),
  order_count BIGINT
) AS $$
DECLARE
  start_date DATE;
  end_date DATE;
BEGIN
  -- Calculate dates for the quarter
  start_date := make_date(p_year, ((p_quarter - 1) * 3) + 1, 1);
  end_date := (start_date + interval '3 months' - interval '1 day')::date;

  RETURN QUERY
  SELECT
    o.delivery_country AS member_state,
    o.vat_rate,
    SUM(o.subtotal) AS taxable_amount,
    SUM(o.vat_amount) AS vat_amount,
    COUNT(o.id) AS order_count
  FROM
    orders o
  WHERE
    o.transaction_type = 'intra_eu_distance_sale'
    AND o.created_at >= start_date
    AND o.created_at <= end_date + interval '1 day' -- Include full last day
    AND o.status NOT IN ('cancelled', 'refunded')
  GROUP BY
    o.delivery_country,
    o.vat_rate
  ORDER BY
    o.delivery_country,
    o.vat_rate;
END;
$$ LANGUAGE plpgsql;

-- Function to get OSS summary metrics
CREATE OR REPLACE FUNCTION get_oss_summary(p_year INTEGER, p_quarter INTEGER)
RETURNS TABLE (
  total_taxable_amount DECIMAL(12,2),
  total_vat_amount DECIMAL(12,2),
  total_orders BIGINT,
  countries_sold_to BIGINT,
  submission_deadline DATE
) AS $$
DECLARE
  start_date DATE;
  end_date DATE;
  deadline DATE;
BEGIN
  start_date := make_date(p_year, ((p_quarter - 1) * 3) + 1, 1);
  end_date := (start_date + interval '3 months' - interval '1 day')::date;
  
  -- Deadline is end of month following the quarter
  deadline := (end_date + interval '1 month')::date;
  -- Set to last day of that month
  deadline := (date_trunc('month', deadline) + interval '1 month' - interval '1 day')::date;

  RETURN QUERY
  WITH agg AS (
    SELECT
      SUM(o.subtotal) AS total_tax,
      SUM(o.vat_amount) AS total_vat,
      COUNT(o.id) AS total_ord,
      COUNT(DISTINCT o.delivery_country) AS country_cnt
    FROM
      orders o
    WHERE
      o.transaction_type = 'intra_eu_distance_sale'
      AND o.created_at >= start_date
      AND o.created_at <= end_date + interval '1 day'
      AND o.status NOT IN ('cancelled', 'refunded')
  )
  SELECT
    COALESCE(agg.total_tax, 0),
    COALESCE(agg.total_vat, 0),
    COALESCE(agg.total_ord, 0),
    COALESCE(agg.country_cnt, 0),
    deadline
  FROM agg;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INTRASTAT Reporting Logic
-- ============================================================================

-- Function to generate detailed Intrastat report
CREATE OR REPLACE FUNCTION generate_intrastat_report(p_year INTEGER, p_month INTEGER)
RETURNS TABLE (
  cn_code TEXT,
  destination_country TEXT,
  country_name TEXT,
  statistical_value_eur DECIMAL(12,2),
  net_mass_kg DECIMAL(12,2),
  supplementary_units INTEGER,
  nature_of_transaction TEXT,
  mode_of_transport TEXT
) AS $$
DECLARE
  start_date DATE;
  end_date DATE;
BEGIN
  start_date := make_date(p_year, p_month, 1);
  end_date := (start_date + interval '1 month' - interval '1 day')::date;

  RETURN QUERY
  SELECT
    oi.cn_code,
    o.delivery_country AS destination_country,
    'Country Name' AS country_name, -- Placeholder, would need a lookup table
    SUM(oi.total_price) AS statistical_value_eur,
    SUM(oi.weight_kg * oi.quantity) AS net_mass_kg,
    SUM(oi.quantity)::INTEGER AS supplementary_units,
    '11' AS nature_of_transaction, -- Standard sale
    '3' AS mode_of_transport -- Road
  FROM
    order_items oi
  JOIN
    orders o ON oi.order_id = o.id
  WHERE
    o.transaction_type = 'intra_eu_distance_sale'
    AND o.created_at >= start_date
    AND o.created_at <= end_date + interval '1 day'
    AND o.status NOT IN ('cancelled', 'refunded')
    AND oi.cn_code IS NOT NULL
  GROUP BY
    oi.cn_code,
    o.delivery_country
  ORDER BY
    o.delivery_country,
    oi.cn_code;
END;
$$ LANGUAGE plpgsql;

-- Function to get Intrastat summary
CREATE OR REPLACE FUNCTION get_intrastat_summary(p_year INTEGER, p_month INTEGER)
RETURNS TABLE (
  monthly_value_eur DECIMAL(12,2),
  monthly_weight_kg DECIMAL(12,2),
  monthly_shipments BIGINT,
  ytd_dispatches_eur DECIMAL(12,2),
  threshold_eur DECIMAL(12,2),
  threshold_exceeded BOOLEAN,
  submission_deadline DATE
) AS $$
DECLARE
  start_date DATE;
  end_date DATE;
  year_start DATE;
  val_threshold DECIMAL;
BEGIN
  start_date := make_date(p_year, p_month, 1);
  end_date := (start_date + interval '1 month' - interval '1 day')::date;
  year_start := make_date(p_year, 1, 1);
  
  -- Get threshold from config (default 270k)
  SELECT (value->>'threshold_dispatches_eur')::DECIMAL 
  INTO val_threshold 
  FROM system_settings 
  WHERE key = 'intrastat_config';
  
  IF val_threshold IS NULL THEN val_threshold := 270000; END IF;

  RETURN QUERY
  WITH monthly AS (
    SELECT
      SUM(o.subtotal) AS val,
      SUM(o.total_weight_kg) AS wgt,
      COUNT(o.id) AS cnt
    FROM orders o
    WHERE o.transaction_type = 'intra_eu_distance_sale'
      AND o.created_at >= start_date
      AND o.created_at <= end_date + interval '1 day'
  ),
  ytd AS (
    SELECT SUM(o.subtotal) AS val
    FROM orders o
    WHERE o.transaction_type = 'intra_eu_distance_sale'
      AND o.created_at >= year_start
      AND o.created_at <= end_date + interval '1 day'
  )
  SELECT
    COALESCE(monthly.val, 0),
    COALESCE(monthly.wgt, 0),
    COALESCE(monthly.cnt, 0),
    COALESCE(ytd.val, 0),
    val_threshold,
    (COALESCE(ytd.val, 0) >= val_threshold),
    (end_date + interval '15 days')::date -- 15th of following month
  FROM monthly, ytd;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TROD (Environmental) Reporting Logic
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_trod_report(p_year INTEGER, p_quarter INTEGER)
RETURNS TABLE (
  trod_category TEXT,
  category_description TEXT,
  units_sold BIGINT,
  total_weight_kg DECIMAL(12,2),
  fee_rate_per_kg DECIMAL(10,2),
  total_fee_eur DECIMAL(12,2)
) AS $$
DECLARE
  start_date DATE;
  end_date DATE;
BEGIN
  start_date := make_date(p_year, ((p_quarter - 1) * 3) + 1, 1);
  end_date := (start_date + interval '3 months' - interval '1 day')::date;

  RETURN QUERY
  SELECT
    oi.trod_category_code AS trod_category,
    CASE oi.trod_category_code
      WHEN '1' THEN 'Large Household Appliances'
      WHEN '2' THEN 'Small Household Appliances'
      WHEN '3' THEN 'IT & Telecom'
      WHEN '4' THEN 'Consumer Equipment'
      WHEN '5' THEN 'Lighting'
      WHEN '6' THEN 'Electrical Tools'
      WHEN '7' THEN 'Solar/PV Equipment'
      ELSE 'Unknown'
    END AS category_description,
    SUM(oi.quantity) AS units_sold,
    SUM(oi.weight_kg * oi.quantity) AS total_weight_kg,
    0.85 AS fee_rate_per_kg, -- Default rate, realistically should come from settings join
    (SUM(oi.weight_kg * oi.quantity) * 0.85) AS total_fee_eur
  FROM
    order_items oi
  JOIN
    orders o ON oi.order_id = o.id
  WHERE
    oi.applies_trod_fee = true
    AND o.transaction_type = 'domestic' -- TROD is usually domestic/import based
    AND o.created_at >= start_date
    AND o.created_at <= end_date + interval '1 day'
    AND o.status NOT IN ('cancelled', 'refunded')
  GROUP BY
    oi.trod_category_code;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_trod_summary(p_year INTEGER, p_quarter INTEGER)
RETURNS TABLE (
  total_units BIGINT,
  total_weight_kg DECIMAL(12,2),
  total_fee_eur DECIMAL(12,2),
  categories_count BIGINT,
  reporting_authority TEXT
) AS $$
DECLARE
  start_date DATE;
  end_date DATE;
BEGIN
  start_date := make_date(p_year, ((p_quarter - 1) * 3) + 1, 1);
  end_date := (start_date + interval '3 months' - interval '1 day')::date;

  RETURN QUERY
  WITH agg AS (
    SELECT
      SUM(oi.quantity) AS units,
      SUM(oi.weight_kg * oi.quantity) AS wgt,
      COUNT(DISTINCT oi.trod_category_code) AS cats
    FROM
      order_items oi
    JOIN
      orders o ON oi.order_id = o.id
    WHERE
      oi.applies_trod_fee = true
      AND o.transaction_type = 'domestic'
      AND o.created_at >= start_date
      AND o.created_at <= end_date + interval '1 day'
  )
  SELECT
    COALESCE(agg.units, 0),
    COALESCE(agg.wgt, 0),
    (COALESCE(agg.wgt, 0) * 0.85), -- Using default rate again
    COALESCE(agg.cats, 0),
    'FURS'::TEXT
  FROM agg;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Packaging Waste Reporting Logic
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_packaging_report(p_year INTEGER)
RETURNS TABLE (
  material_type TEXT,
  total_weight_kg DECIMAL(12,2),
  fee_rate_per_kg DECIMAL(10,3),
  total_fee_eur DECIMAL(12,2),
  percentage_of_total DECIMAL(5,2)
) AS $$
DECLARE
  grand_total_weight DECIMAL;
BEGIN
  -- Calculate grand total first for percentage
  SELECT SUM(oi.packaging_weight_kg) INTO grand_total_weight
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  WHERE o.transaction_type = 'domestic'
    AND extract(year from o.created_at) = p_year;
    
  IF grand_total_weight IS NULL OR grand_total_weight = 0 THEN grand_total_weight := 1; END IF;

  RETURN QUERY
  SELECT
    oi.packaging_type AS material_type,
    SUM(oi.packaging_weight_kg) AS total_weight_kg,
    0.150 AS fee_rate_per_kg, -- Placeholder
    (SUM(oi.packaging_weight_kg) * 0.15) AS total_fee_eur,
    (SUM(oi.packaging_weight_kg) / grand_total_weight * 100) AS percentage_of_total
  FROM
    order_items oi
  JOIN
    orders o ON oi.order_id = o.id
  WHERE
    oi.applies_packaging_fee = true
    AND o.transaction_type = 'domestic'
    AND extract(year from o.created_at) = p_year
  GROUP BY
    oi.packaging_type;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_packaging_summary(p_year INTEGER)
RETURNS TABLE (
  total_weight_kg DECIMAL(12,2),
  total_fee_eur DECIMAL(12,2),
  threshold_kg DECIMAL(12,2),
  threshold_exceeded BOOLEAN,
  material_types_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(oi.packaging_weight_kg), 0) AS wgt,
    COALESCE(SUM(oi.packaging_weight_kg) * 0.15, 0) AS fee,
    15000.00 AS threshold,
    (COALESCE(SUM(oi.packaging_weight_kg), 0) > 15000),
    COUNT(DISTINCT oi.packaging_type)
  FROM
    order_items oi
  JOIN
    orders o ON oi.order_id = o.id
  WHERE
    oi.applies_packaging_fee = true
    AND o.transaction_type = 'domestic'
    AND extract(year from o.created_at) = p_year;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Utility Helper Functions
-- ============================================================================

-- Check all reporting thresholds
CREATE OR REPLACE FUNCTION check_reporting_thresholds()
RETURNS TABLE (
  report_type TEXT,
  threshold_name TEXT,
  current_value DECIMAL(12,2),
  threshold_value DECIMAL(12,2),
  currency TEXT,
  is_exceeded BOOLEAN,
  warning_level TEXT -- 'safe', 'approaching', 'exceeded'
) AS $$
DECLARE
  current_intrastat_sales DECIMAL;
  intrastat_limit DECIMAL := 270000;
  
  current_packaging_kg DECIMAL;
  packaging_limit DECIMAL := 15000;
  
  current_oss_sales DECIMAL;
  oss_limit DECIMAL := 10000; -- EU wide threshold for OSS registration (usually)
BEGIN
  -- Intrastat
  SELECT COALESCE(SUM(subtotal), 0) INTO current_intrastat_sales
  FROM orders WHERE transaction_type = 'intra_eu_distance_sale' 
  AND created_at >= date_trunc('year', NOW());

  RETURN QUERY SELECT 
    'intrastat'::text, 'Annual Dispatches', current_intrastat_sales, intrastat_limit, 'EUR',
    (current_intrastat_sales >= intrastat_limit),
    CASE 
      WHEN current_intrastat_sales >= intrastat_limit THEN 'exceeded'
      WHEN current_intrastat_sales >= (intrastat_limit * 0.8) THEN 'approaching'
      ELSE 'safe'
    END;

  -- Packaging
  SELECT COALESCE(SUM(packaging_weight_kg), 0) INTO current_packaging_kg
  FROM order_items oi JOIN orders o ON oi.order_id = o.id
  WHERE o.transaction_type = 'domestic' AND o.created_at >= date_trunc('year', NOW());

  RETURN QUERY SELECT 
    'packaging'::text, 'Annual Waste Mass', current_packaging_kg, packaging_limit, 'KG',
    (current_packaging_kg >= packaging_limit),
    CASE 
      WHEN current_packaging_kg >= packaging_limit THEN 'exceeded'
      WHEN current_packaging_kg >= (packaging_limit * 0.9) THEN 'approaching'
      ELSE 'safe'
    END;

  -- OSS (Approximate)
  SELECT COALESCE(SUM(subtotal), 0) INTO current_oss_sales
  FROM orders WHERE transaction_type = 'intra_eu_distance_sale' 
  AND created_at >= date_trunc('year', NOW());
  
  RETURN QUERY SELECT 
    'oss'::text, 'Cross-border Sales', current_oss_sales, oss_limit, 'EUR',
    (current_oss_sales >= oss_limit),
    CASE 
      WHEN current_oss_sales >= oss_limit THEN 'exceeded'
      ELSE 'safe' -- usually once exceeded you just register and stay registered
    END;
END;
$$ LANGUAGE plpgsql;

-- Get reporting calendar for dashboard
CREATE OR REPLACE FUNCTION get_reporting_calendar(p_year INTEGER DEFAULT NULL)
RETURNS TABLE (
  report_name TEXT,
  period TEXT,
  deadline DATE,
  status TEXT
) AS $$
DECLARE
  yr INTEGER;
BEGIN
  yr := COALESCE(p_year, extract(year from NOW())::INTEGER);
  
  -- Simple static generation of deadlines for the requested year
  RETURN QUERY
  -- Intrastat (Monthly, 15th of next month)
  SELECT 'Intrastat'::text, 'Jan'::text, make_date(yr, 2, 15), 'pending'::text
  UNION ALL SELECT 'Intrastat', 'Feb', make_date(yr, 3, 15), 'pending'
  UNION ALL SELECT 'Intrastat', 'Mar', make_date(yr, 4, 15), 'pending'
  -- ... simplified for brevity, usually generated dynamically
  UNION ALL 
  -- OSS (Quarterly, end of next month)
  SELECT 'OSS VAT', 'Q1', make_date(yr, 4, 30), 'pending'
  UNION ALL SELECT 'OSS VAT', 'Q2', make_date(yr, 7, 31), 'pending'
  UNION ALL SELECT 'OSS VAT', 'Q3', make_date(yr, 10, 31), 'pending'
  UNION ALL SELECT 'OSS VAT', 'Q4', make_date(yr + 1, 1, 31), 'pending'
  UNION ALL
  -- TROD (Half-yearly or Quarterly depending on volume, assume Quarterly 20th)
  SELECT 'TROD Env', 'Q1', make_date(yr, 4, 20), 'pending';
END;
$$ LANGUAGE plpgsql;
