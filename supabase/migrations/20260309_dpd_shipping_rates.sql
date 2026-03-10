-- DPD Shipping Rates from Ponudba 2023/1877 (ADRIA POWER / Initraenergija d.o.o.)
-- Weight bands: the checkout query uses: min_weight_kg <= totalWeight <= max_weight_kg
-- Bands are slightly offset to avoid overlaps (e.g. 2.01 instead of 2)
-- All prices in EUR, before volume discounts (discounts applied separately if needed)
-- service_type: 'DPD Home' for B2C, 'DPD Business' for B2B (same rates, different parcel_type in API)

-- Clear existing DPD rates to avoid duplicates
DELETE FROM shipping_rates WHERE carrier = 'DPD';

-- =============================================
-- 1. SLOVENIJA (DPD Home / DPD Business)
-- =============================================
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('SI', 'DPD', 'DPD Standard',  4.63,  0,     2,    true),
('SI', 'DPD', 'DPD Standard',  5.79,  2.01,  5,    true),
('SI', 'DPD', 'DPD Standard',  7.06,  5.01,  10,   true),
('SI', 'DPD', 'DPD Standard',  8.22,  10.01, 15,   true),
('SI', 'DPD', 'DPD Standard',  9.49,  15.01, 20,   true),
('SI', 'DPD', 'DPD Standard', 11.11,  20.01, 25,   true),
('SI', 'DPD', 'DPD Standard', 12.14,  25.01, 31.5, true);

-- =============================================
-- 2. HRVAŠKA (Cona 1 — postal: 10000-10999, 33000-33412, 40000-49999, 53000-53262)
-- =============================================
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('HR', 'DPD', 'DPD Standard',  8.85,  0,     2,    true),
('HR', 'DPD', 'DPD Standard',  9.38,  2.01,  5,    true),
('HR', 'DPD', 'DPD Standard',  9.85,  5.01,  10,   true),
('HR', 'DPD', 'DPD Standard', 10.42,  10.01, 15,   true),
('HR', 'DPD', 'DPD Standard', 11.25,  15.01, 20,   true),
('HR', 'DPD', 'DPD Standard', 12.08,  20.01, 25,   true),
('HR', 'DPD', 'DPD Standard', 13.07,  25.01, 31.5, true);

-- =============================================
-- 3. EU — MEDNARODNA DOSTAVA
-- =============================================

-- Austria (AT) — 1 dan
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('AT', 'DPD', 'DPD Standard', 17.70, 0,     2,    true),
('AT', 'DPD', 'DPD Standard', 19.67, 2.01,  5,    true),
('AT', 'DPD', 'DPD Standard', 21.87, 5.01,  10,   true),
('AT', 'DPD', 'DPD Standard', 23.25, 10.01, 15,   true),
('AT', 'DPD', 'DPD Standard', 26.26, 15.01, 20,   true),
('AT', 'DPD', 'DPD Standard', 28.81, 20.01, 25,   true),
('AT', 'DPD', 'DPD Standard', 32.52, 25.01, 31.5, true);

-- Belgium (BE) — 3 dni
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('BE', 'DPD', 'DPD Standard', 21.64, 0,     2,    true),
('BE', 'DPD', 'DPD Standard', 22.91, 2.01,  5,    true),
('BE', 'DPD', 'DPD Standard', 24.18, 5.01,  10,   true),
('BE', 'DPD', 'DPD Standard', 26.73, 10.01, 15,   true),
('BE', 'DPD', 'DPD Standard', 27.88, 15.01, 20,   true),
('BE', 'DPD', 'DPD Standard', 29.74, 20.01, 25,   true),
('BE', 'DPD', 'DPD Standard', 30.66, 25.01, 31.5, true);

-- Bulgaria (BG) — 3 dni
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('BG', 'DPD', 'DPD Standard', 46.39, 0,     2,    true),
('BG', 'DPD', 'DPD Standard', 47.67, 2.01,  5,    true),
('BG', 'DPD', 'DPD Standard', 50.22, 5.01,  10,   true),
('BG', 'DPD', 'DPD Standard', 52.52, 10.01, 15,   true),
('BG', 'DPD', 'DPD Standard', 53.80, 15.01, 20,   true),
('BG', 'DPD', 'DPD Standard', 55.30, 20.01, 25,   true),
('BG', 'DPD', 'DPD Standard', 56.82, 25.01, 31.5, true);

-- Czech Republic (CZ) — 2 dni
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('CZ', 'DPD', 'DPD Standard', 13.79, 0,     2,    true),
('CZ', 'DPD', 'DPD Standard', 14.21, 2.01,  5,    true),
('CZ', 'DPD', 'DPD Standard', 14.81, 5.01,  10,   true),
('CZ', 'DPD', 'DPD Standard', 17.01, 10.01, 15,   true),
('CZ', 'DPD', 'DPD Standard', 19.41, 15.01, 20,   true),
('CZ', 'DPD', 'DPD Standard', 21.40, 20.01, 25,   true),
('CZ', 'DPD', 'DPD Standard', 22.72, 25.01, 31.5, true);

-- Denmark (DK) — 3 dni
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('DK', 'DPD', 'DPD Standard', 23.48, 0,     2,    true),
('DK', 'DPD', 'DPD Standard', 26.26, 2.01,  5,    true),
('DK', 'DPD', 'DPD Standard', 27.88, 5.01,  10,   true),
('DK', 'DPD', 'DPD Standard', 31.01, 10.01, 15,   true),
('DK', 'DPD', 'DPD Standard', 32.16, 15.01, 20,   true),
('DK', 'DPD', 'DPD Standard', 33.55, 20.01, 25,   true),
('DK', 'DPD', 'DPD Standard', 34.60, 25.01, 31.5, true);

-- Estonia (EE) — 4 dni
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('EE', 'DPD', 'DPD Standard', 40.04, 0,     2,    true),
('EE', 'DPD', 'DPD Standard', 41.19, 2.01,  5,    true),
('EE', 'DPD', 'DPD Standard', 42.58, 5.01,  10,   true),
('EE', 'DPD', 'DPD Standard', 45.59, 10.01, 15,   true),
('EE', 'DPD', 'DPD Standard', 48.48, 15.01, 20,   true),
('EE', 'DPD', 'DPD Standard', 51.49, 20.01, 25,   true),
('EE', 'DPD', 'DPD Standard', 54.15, 25.01, 31.5, true);

-- Finland (FI) — 5 dni
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('FI', 'DPD', 'DPD Standard', 37.14, 0,     2,    true),
('FI', 'DPD', 'DPD Standard', 39.45, 2.01,  5,    true),
('FI', 'DPD', 'DPD Standard', 45.36, 5.01,  10,   true),
('FI', 'DPD', 'DPD Standard', 51.15, 10.01, 15,   true),
('FI', 'DPD', 'DPD Standard', 56.93, 15.01, 20,   true),
('FI', 'DPD', 'DPD Standard', 62.36, 20.01, 25,   true),
('FI', 'DPD', 'DPD Standard', 68.50, 25.01, 31.5, true);

-- France (FR) — 3 dni
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('FR', 'DPD', 'DPD Standard', 32.86, 0,     2,    true),
('FR', 'DPD', 'DPD Standard', 34.82, 2.01,  5,    true),
('FR', 'DPD', 'DPD Standard', 37.95, 5.01,  10,   true),
('FR', 'DPD', 'DPD Standard', 38.65, 10.01, 15,   true),
('FR', 'DPD', 'DPD Standard', 39.69, 15.01, 20,   true),
('FR', 'DPD', 'DPD Standard', 40.95, 20.01, 25,   true),
('FR', 'DPD', 'DPD Standard', 41.77, 25.01, 31.5, true);

-- Greece (GR) — 3 dni
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('GR', 'DPD', 'DPD Standard', 58.78, 0,     2,    true),
('GR', 'DPD', 'DPD Standard', 60.05, 2.01,  5,    true),
('GR', 'DPD', 'DPD Standard', 62.60, 5.01,  10,   true),
('GR', 'DPD', 'DPD Standard', 64.91, 10.01, 15,   true),
('GR', 'DPD', 'DPD Standard', 66.18, 15.01, 20,   true),
('GR', 'DPD', 'DPD Standard', 67.69, 20.01, 25,   true),
('GR', 'DPD', 'DPD Standard', 69.19, 25.01, 31.5, true);

-- Ireland (IE) — 4 dni
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('IE', 'DPD', 'DPD Standard', 48.25, 0,     2,    true),
('IE', 'DPD', 'DPD Standard', 50.79, 2.01,  5,    true),
('IE', 'DPD', 'DPD Standard', 53.11, 5.01,  10,   true),
('IE', 'DPD', 'DPD Standard', 56.46, 10.01, 15,   true),
('IE', 'DPD', 'DPD Standard', 61.67, 15.01, 20,   true),
('IE', 'DPD', 'DPD Standard', 65.02, 20.01, 25,   true),
('IE', 'DPD', 'DPD Standard', 69.31, 25.01, 31.5, true);

-- Italy (IT) — 2 dni
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('IT', 'DPD', 'DPD Standard', 22.21, 0,     2,    true),
('IT', 'DPD', 'DPD Standard', 23.37, 2.01,  5,    true),
('IT', 'DPD', 'DPD Standard', 26.03, 5.01,  10,   true),
('IT', 'DPD', 'DPD Standard', 26.85, 10.01, 15,   true),
('IT', 'DPD', 'DPD Standard', 28.58, 15.01, 20,   true),
('IT', 'DPD', 'DPD Standard', 30.31, 20.01, 25,   true),
('IT', 'DPD', 'DPD Standard', 33.44, 25.01, 31.5, true);

-- Latvia (LV) — 4 dni
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('LV', 'DPD', 'DPD Standard', 39.92, 0,     2,    true),
('LV', 'DPD', 'DPD Standard', 40.04, 2.01,  5,    true),
('LV', 'DPD', 'DPD Standard', 42.58, 5.01,  10,   true),
('LV', 'DPD', 'DPD Standard', 45.59, 10.01, 15,   true),
('LV', 'DPD', 'DPD Standard', 48.48, 15.01, 20,   true),
('LV', 'DPD', 'DPD Standard', 51.49, 20.01, 25,   true),
('LV', 'DPD', 'DPD Standard', 54.15, 25.01, 31.5, true);

-- Lithuania (LT) — 4 dni
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('LT', 'DPD', 'DPD Standard', 38.30, 0,     2,    true),
('LT', 'DPD', 'DPD Standard', 38.88, 2.01,  5,    true),
('LT', 'DPD', 'DPD Standard', 40.95, 5.01,  10,   true),
('LT', 'DPD', 'DPD Standard', 43.97, 10.01, 15,   true),
('LT', 'DPD', 'DPD Standard', 46.98, 15.01, 20,   true),
('LT', 'DPD', 'DPD Standard', 49.87, 20.01, 25,   true),
('LT', 'DPD', 'DPD Standard', 52.52, 25.01, 31.5, true);

-- Luxembourg (LU) — 2 dni
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('LU', 'DPD', 'DPD Standard', 22.21, 0,     2,    true),
('LU', 'DPD', 'DPD Standard', 23.37, 2.01,  5,    true),
('LU', 'DPD', 'DPD Standard', 25.10, 5.01,  10,   true),
('LU', 'DPD', 'DPD Standard', 27.65, 10.01, 15,   true),
('LU', 'DPD', 'DPD Standard', 30.31, 15.01, 20,   true),
('LU', 'DPD', 'DPD Standard', 32.16, 20.01, 25,   true),
('LU', 'DPD', 'DPD Standard', 33.67, 25.01, 31.5, true);

-- Hungary (HU) — 2 dni
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('HU', 'DPD', 'DPD Standard', 11.77, 0,     2,    true),
('HU', 'DPD', 'DPD Standard', 12.03, 2.01,  5,    true),
('HU', 'DPD', 'DPD Standard', 12.82, 5.01,  10,   true),
('HU', 'DPD', 'DPD Standard', 15.22, 10.01, 15,   true),
('HU', 'DPD', 'DPD Standard', 15.99, 15.01, 20,   true),
('HU', 'DPD', 'DPD Standard', 16.57, 20.01, 25,   true),
('HU', 'DPD', 'DPD Standard', 17.48, 25.01, 31.5, true);

-- Germany (DE) — 2 dni
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('DE', 'DPD', 'DPD Standard', 19.90, 0,     2,    true),
('DE', 'DPD', 'DPD Standard', 21.06, 2.01,  5,    true),
('DE', 'DPD', 'DPD Standard', 23.71, 5.01,  10,   true),
('DE', 'DPD', 'DPD Standard', 26.85, 10.01, 15,   true),
('DE', 'DPD', 'DPD Standard', 28.58, 15.01, 20,   true),
('DE', 'DPD', 'DPD Standard', 29.58, 20.01, 25,   true),
('DE', 'DPD', 'DPD Standard', 33.44, 25.01, 31.5, true);

-- Netherlands (NL) — 3 dni
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('NL', 'DPD', 'DPD Standard', 21.06, 0,     2,    true),
('NL', 'DPD', 'DPD Standard', 22.57, 2.01,  5,    true),
('NL', 'DPD', 'DPD Standard', 24.30, 5.01,  10,   true),
('NL', 'DPD', 'DPD Standard', 26.49, 10.01, 15,   true),
('NL', 'DPD', 'DPD Standard', 28.35, 15.01, 20,   true),
('NL', 'DPD', 'DPD Standard', 29.51, 20.01, 25,   true),
('NL', 'DPD', 'DPD Standard', 30.20, 25.01, 31.5, true);

-- Poland (PL) — 3 dni
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('PL', 'DPD', 'DPD Standard', 17.34, 0,     2,    true),
('PL', 'DPD', 'DPD Standard', 17.84, 2.01,  5,    true),
('PL', 'DPD', 'DPD Standard', 18.40, 5.01,  10,   true),
('PL', 'DPD', 'DPD Standard', 20.36, 10.01, 15,   true),
('PL', 'DPD', 'DPD Standard', 21.29, 15.01, 20,   true),
('PL', 'DPD', 'DPD Standard', 23.05, 20.01, 25,   true),
('PL', 'DPD', 'DPD Standard', 24.65, 25.01, 31.5, true);

-- Portugal (PT) — 4 dni
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('PT', 'DPD', 'DPD Standard', 43.39, 0,     2,    true),
('PT', 'DPD', 'DPD Standard', 44.78, 2.01,  5,    true),
('PT', 'DPD', 'DPD Standard', 47.21, 5.01,  10,   true),
('PT', 'DPD', 'DPD Standard', 49.64, 10.01, 15,   true),
('PT', 'DPD', 'DPD Standard', 52.99, 15.01, 20,   true),
('PT', 'DPD', 'DPD Standard', 56.69, 20.01, 25,   true),
('PT', 'DPD', 'DPD Standard', 62.25, 25.01, 31.5, true);

-- Romania (RO) — 3 dni
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('RO', 'DPD', 'DPD Standard', 40.27, 0,     2,    true),
('RO', 'DPD', 'DPD Standard', 41.42, 2.01,  5,    true),
('RO', 'DPD', 'DPD Standard', 44.09, 5.01,  10,   true),
('RO', 'DPD', 'DPD Standard', 46.28, 10.01, 15,   true),
('RO', 'DPD', 'DPD Standard', 47.67, 15.01, 20,   true),
('RO', 'DPD', 'DPD Standard', 49.17, 20.01, 25,   true),
('RO', 'DPD', 'DPD Standard', 50.68, 25.01, 31.5, true);

-- Slovakia (SK) — 2 dni
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('SK', 'DPD', 'DPD Standard', 13.79, 0,     2,    true),
('SK', 'DPD', 'DPD Standard', 14.21, 2.01,  5,    true),
('SK', 'DPD', 'DPD Standard', 14.81, 5.01,  10,   true),
('SK', 'DPD', 'DPD Standard', 17.01, 10.01, 15,   true),
('SK', 'DPD', 'DPD Standard', 19.41, 15.01, 20,   true),
('SK', 'DPD', 'DPD Standard', 21.40, 20.01, 25,   true),
('SK', 'DPD', 'DPD Standard', 22.72, 25.01, 31.5, true);

-- Spain (ES) — 4 dni
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('ES', 'DPD', 'DPD Standard', 37.92, 0,     2,    true),
('ES', 'DPD', 'DPD Standard', 39.58, 2.01,  5,    true),
('ES', 'DPD', 'DPD Standard', 43.39, 5.01,  10,   true),
('ES', 'DPD', 'DPD Standard', 45.36, 10.01, 15,   true),
('ES', 'DPD', 'DPD Standard', 48.48, 15.01, 20,   true),
('ES', 'DPD', 'DPD Standard', 51.02, 20.01, 25,   true),
('ES', 'DPD', 'DPD Standard', 53.11, 25.01, 31.5, true);

-- Sweden (SE) — 4 dni
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('SE', 'DPD', 'DPD Standard', 38.53, 0,     2,    true),
('SE', 'DPD', 'DPD Standard', 39.92, 2.01,  5,    true),
('SE', 'DPD', 'DPD Standard', 42.47, 5.01,  10,   true),
('SE', 'DPD', 'DPD Standard', 45.36, 10.01, 15,   true),
('SE', 'DPD', 'DPD Standard', 48.48, 15.01, 20,   true),
('SE', 'DPD', 'DPD Standard', 51.38, 20.01, 25,   true),
('SE', 'DPD', 'DPD Standard', 53.80, 25.01, 31.5, true);

-- =============================================
-- 4. NON-EU COUNTRIES (izvoz / export)
-- Note: customs brokerage fees apply separately
-- =============================================

-- Bosnia and Herzegovina (BA) — 5 dni, +30 EUR customs
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('BA', 'DPD', 'DPD Standard', 42.11, 0,     2,    true),
('BA', 'DPD', 'DPD Standard', 44.55, 2.01,  5,    true),
('BA', 'DPD', 'DPD Standard', 50.79, 5.01,  10,   true),
('BA', 'DPD', 'DPD Standard', 54.50, 10.01, 15,   true),
('BA', 'DPD', 'DPD Standard', 56.93, 15.01, 20,   true),
('BA', 'DPD', 'DPD Standard', 60.63, 20.01, 25,   true),
('BA', 'DPD', 'DPD Standard', 63.18, 25.01, 31.5, true);

-- Norway (NO) — 4-6 dni, +30 EUR customs
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('NO', 'DPD', 'DPD Standard', 38.53, 0,     2,    true),
('NO', 'DPD', 'DPD Standard', 39.92, 2.01,  5,    true),
('NO', 'DPD', 'DPD Standard', 42.58, 5.01,  10,   true),
('NO', 'DPD', 'DPD Standard', 45.36, 10.01, 15,   true),
('NO', 'DPD', 'DPD Standard', 48.48, 15.01, 20,   true),
('NO', 'DPD', 'DPD Standard', 51.38, 20.01, 25,   true),
('NO', 'DPD', 'DPD Standard', 53.80, 25.01, 31.5, true);

-- Serbia (RS) — 5 dni, +30 EUR customs
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('RS', 'DPD', 'DPD Standard', 42.11, 0,     2,    true),
('RS', 'DPD', 'DPD Standard', 45.82, 2.01,  5,    true),
('RS', 'DPD', 'DPD Standard', 51.95, 5.01,  10,   true),
('RS', 'DPD', 'DPD Standard', 58.19, 10.01, 15,   true),
('RS', 'DPD', 'DPD Standard', 60.63, 15.01, 31.5, true);

-- Switzerland (CH) — 3 dni, +33 EUR customs
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('CH', 'DPD', 'DPD Standard', 27.19, 0,     2,    true),
('CH', 'DPD', 'DPD Standard', 28.47, 2.01,  5,    true),
('CH', 'DPD', 'DPD Standard', 31.01, 5.01,  10,   true),
('CH', 'DPD', 'DPD Standard', 33.44, 10.01, 15,   true),
('CH', 'DPD', 'DPD Standard', 34.71, 15.01, 20,   true),
('CH', 'DPD', 'DPD Standard', 37.14, 20.01, 25,   true),
('CH', 'DPD', 'DPD Standard', 39.58, 25.01, 31.5, true);

-- United Kingdom (GB) — 4-5 dni, +15 EUR customs + EORI
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('GB', 'DPD', 'DPD Standard', 31.01, 0,     2,    true),
('GB', 'DPD', 'DPD Standard', 33.21, 2.01,  5,    true),
('GB', 'DPD', 'DPD Standard', 37.60, 5.01,  10,   true),
('GB', 'DPD', 'DPD Standard', 40.04, 10.01, 15,   true),
('GB', 'DPD', 'DPD Standard', 43.50, 15.01, 20,   true),
('GB', 'DPD', 'DPD Standard', 45.01, 20.01, 25,   true),
('GB', 'DPD', 'DPD Standard', 46.39, 25.01, 31.5, true);

-- Ukraine (UA) — 5-7 dni, +15 EUR transit declaration + customs
INSERT INTO shipping_rates (country_code, carrier, service_type, rate_eur, min_weight_kg, max_weight_kg, active) VALUES
('UA', 'DPD', 'DPD Standard', 36.44, 0,     2,    true),
('UA', 'DPD', 'DPD Standard', 38.53, 2.01,  5,    true),
('UA', 'DPD', 'DPD Standard', 40.95, 5.01,  10,   true),
('UA', 'DPD', 'DPD Standard', 42.70, 10.01, 15,   true),
('UA', 'DPD', 'DPD Standard', 44.55, 15.01, 20,   true),
('UA', 'DPD', 'DPD Standard', 48.83, 20.01, 25,   true),
('UA', 'DPD', 'DPD Standard', 51.72, 25.01, 31.5, true);

-- =============================================
-- NOTES:
-- 1. Fuel surcharge (dodatek na gorivo): min 6% applies on top of all rates
--    This should be factored in manually or via a surcharge multiplier
-- 2. Volume discounts (popust):
--    SI: ≤20 pkgs/month: 15%, 21-30: 20%, 31-50: 25%, >50: 30%
--    EU: ≤20 pkgs/month: 20%, >20: 30%
-- 3. Non-EU customs brokerage (DPD charges):
--    BA, SRB, NO: +30 EUR standard customs
--    CH: +33 EUR
--    VB (UK): +15 EUR + EORI required
--    UA: +15 EUR transit declaration
-- 4. Croatia Cona 2 (rural postal codes): use HR rates above + 7.50 EUR surcharge
--    Cona 2 postal codes: all except 10000-10999, 33000-33412, 40000-49999, 53000-53262
-- 5. Predict (1h delivery window notification): +0.20 EUR domestic, +1.50 EUR international
-- 6. Max parcel: 31.5 kg, max length 175cm, max girth 300cm
-- =============================================
