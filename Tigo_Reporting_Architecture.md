# E-Commerce Platform Reporting & Compliance Architecture
## For Initra Energija / Tigo Energy Distribution Platform

---

## Executive Overview

Your platform needs to track three distinct reporting systems:
1. **OSS (One Stop Shop)** - EU-wide VAT reporting (quarterly)
2. **Intrastat** - EU trade statistics (monthly, only for SI threshold exceeded)
3. **TROD + Packaging Fees** - Slovenia-only environmental fees (annual/monthly)

All reports should be generated from a single **Reporting** section in Admin, separate from Accounting.

---

## 1. DATABASE STRUCTURE & UUIDs

### Core Transaction Tracking

Every order must capture these fields at transaction level:

```
orders table:
├── order_uuid (UUID v4) - Primary key
├── customer_country (ISO 3166-1 alpha-2, e.g., 'SI', 'DE', 'AT')
├── delivery_country (ISO 3166-1 alpha-2) - WHERE GOODS ARE SENT
├── supplier_establishment_country ('SI' - your Initra location)
├── order_date (timestamp)
├── invoice_date (timestamp)
├── total_value_excl_vat (DECIMAL)
├── vat_amount (DECIMAL)
├── applied_vat_rate (DECIMAL - e.g., 0.22 for 22%)
├── order_status (enum: pending, dispatched, delivered, cancelled)
└── transaction_type (enum: 'domestic', 'intra_eu_distance_sale', 'intra_eu_service')

order_items table:
├── order_item_uuid (UUID v4)
├── order_uuid (FK)
├── product_uuid (UUID v4)
├── product_hs_code (string, e.g., '854420' for solar equipment)
├── product_weight_kg (DECIMAL) - CRITICAL for Intrastat
├── quantity (INTEGER)
├── unit_price_excl_vat (DECIMAL)
├── item_total_excl_vat (DECIMAL)
├── applies_trod_fee (BOOLEAN) - True only for electrical equipment sold to SI
├── applies_packaging_fee (BOOLEAN) - True only for packaged items sold to SI
└── packaging_weight_kg (DECIMAL) - Needed for waste packaging reporting

transactions_reporting_sync table:
├── sync_uuid (UUID v4)
├── order_item_uuid (FK)
├── reporting_period (enum: 'oss_q1_2025', 'intrastat_jan_2025', 'trod_2025', 'packaging_2025')
├── report_status (enum: 'pending', 'draft', 'submitted', 'approved')
├── date_synced (timestamp)
└── notes (TEXT)
```

### Key Design Decisions

- **Delivery Country = OSS/Intrastat reporting destination** (not customer country)
- **TROD & Packaging apply ONLY when:**
  - `delivery_country = 'SI'` (Slovenia)
  - AND `supplier_establishment_country = 'SI'`
  - AND product is electrical equipment / has packaging
- **HS Codes** must be accurate - this is your gateway to all regulatory reporting
- Each order item should have a unique UUID so it can be audited individually

---

## 2. REPORTING MODULE ARCHITECTURE

### Admin Navigation Structure

```
Admin Dashboard
└── Reporting
    ├── OSS (One Stop Shop VAT)
    │   ├── OSS Registration Status
    │   ├── Current Period (Q1 2025)
    │   ├── Generate OSS Return
    │   ├── OSS Submission History
    │   └── Export to FURS Portal (quarterly)
    │
    ├── Intrastat (EU Trade Statistics)
    │   ├── Threshold Monitor (€270k dispatches, €240k arrivals)
    │   ├── Current Month (Jan 2025)
    │   ├── Generate Intrastat Declaration
    │   ├── HS Code Management
    │   └── Export to SURS (Statistical Office) (monthly)
    │
    ├── TROD (Waste Electrical Equipment Fee)
    │   ├── 2025 Reporting Period
    │   ├── Tracked Items by Category
    │   ├── Generate TROD Report
    │   ├── E-TROD XML Export
    │   └── Submission to FURS (annual - December)
    │
    ├── Packaging Waste (Odpadna Embalaža)
    │   ├── 2025 Reporting Period
    │   ├── Packaging Materials by Type
    │   ├── Generate Packaging Report
    │   ├── E-TROD XML Export
    │   └── Submission to FURS (annual - December)
    │
    ├── Intrastat Reports (Read-Only Archive)
    │   ├── Monthly Submissions
    │   ├── Corrections/Amendments
    │   └── Audit Trail
    │
    └── Compliance Dashboard
        ├── Threshold Alerts (when approaching limits)
        ├── Submission Deadlines Calendar
        ├── Missing Data Audit
        └── Annual Checklist
```

---

## 3. DATA FLOW & CALCULATION LOGIC

### OSS Calculation Flow (Quarterly)

**Timeline:** January-March, April-June, July-September, October-December

```
Order → Filter by:
  ✓ delivery_country IN (EU countries except SI if domestic)
  ✓ invoice_date within quarter
  ✓ order_status = 'delivered' OR 'dispatched'
  
→ Group by:
  - Member State of consumption (delivery_country)
  - VAT rate applied
  
→ Sum:
  - Total value per country
  - VAT amount per rate
  
→ Generate Report:
  - "Sales to Germany (19% VAT): €50,000 → VAT €9,500"
  - "Sales to Austria (20% VAT): €30,000 → VAT €6,000"
  
→ Auto-calculate:
  - Total VAT payable to each country
  - VAT payment due dates (within 15 days of quarter-end + 5 days)
```

**Database Query Example (Pseudocode):**
```sql
SELECT 
  delivery_country,
  applied_vat_rate,
  SUM(total_value_excl_vat) as revenue,
  SUM(vat_amount) as vat_due,
  COUNT(*) as transaction_count
FROM orders
WHERE invoice_date BETWEEN '2025-01-01' AND '2025-03-31'
  AND order_status IN ('delivered', 'dispatched')
  AND delivery_country != 'SI'  -- Exclude domestic
GROUP BY delivery_country, applied_vat_rate
ORDER BY delivery_country
```

---

### Intrastat Calculation Flow (Monthly)

**Timeline:** Must monitor continuously. Report if/when you exceed €270k dispatches

```
Order Item → Filter by:
  ✓ invoice_date in month
  ✓ delivery_country IN (EU countries)
  ✓ delivery_country != 'SI' (no domestic Intrastat)
  
→ For EACH item, extract:
  - Partner Country (delivery_country)
  - HS Code (product_hs_code) - **CRITICAL**
  - Value (item_total_excl_vat) - **IN EUR**
  - Weight (product_weight_kg) - **IN KG**
  - Quantity (product units)
  - Commodity Description
  
→ Sum by:
  - Country × HS Code combination
  
→ Calculate Thresholds:
  - Monthly sum of all dispatches value
  - If ≥ €270,000 → MUST REPORT
  
→ Generate XML:
  - Monthly Intrastat declaration
  - Submit to SURS by 15th of following month
```

**Intrastat 2025 Thresholds for Slovenia:**
- **Arrivals:** €240,000 (you won't hit this - you're selling TO EU)
- **Dispatches:** €270,000 (you WILL report here - your sales to EU)
- **Statistical threshold:** €9m for detailed reporting

---

### TROD (Waste Electrical Equipment) Flow

**Timeline:** Annual reporting in December

**CRITICAL:** Only applies when ALL conditions met:
```
✓ delivery_country = 'SI'
✓ supplier_establishment_country = 'SI'
✓ product_category = electrical/electronic equipment
✓ Customer is distributor/retailer (B2B) or end consumer (B2C)
```

**TROD Categories (from FURS):**
- Category 1: Large household appliances
- Category 2: Small household appliances
- Category 3: IT & telecom equipment
- Category 4: Consumer equipment
- Category 5: Lighting equipment
- Category 6: Electrical & electronic tools
- **Category 7: Solar equipment & inverters** ← YOUR PRODUCTS

```
Order Item → Filter by:
  ✓ delivery_country = 'SI'
  ✓ product_type = electrical/solar equipment
  ✓ invoice_date in calendar year
  
→ Group by:
  - TROD Category (mostly Category 7 for you)
  
→ Sum:
  - Quantity of units by category
  - Total weight (kg) by category
  
→ Calculate Fee:
  - Different rates per category
  - Total TROD = SUM(quantity × rate_per_unit)
  
→ Generate E-TROD Report:
  - Submit via FURS eCarina portal
  - XML format (E-TROD schema)
  - Deadline: December 31, 2025
```

**Fee Structure Example (2025 rates - VERIFY WITH FURS):**
- Category 7 (solar): ~€0.50-€1.00 per unit (rate varies by regulation)
- Your accounting integrates this as a payable

---

### Packaging Waste (Odpadna Embalaža) Flow

**Timeline:** Annual reporting in December (or monthly if volume > 15,000 kg)

**CRITICAL:** Only applies when:
```
✓ delivery_country = 'SI'
✓ supplier_establishment_country = 'SI'
✓ packaging_weight_kg > 0 (has packaging)
✓ applies_packaging_fee = true
```

**Packaging Material Categories:**
- Cardboard/Kraft (kg)
- Plastic film (kg)
- Foam/polystyrene (kg)
- Metal/aluminum (kg)
- Glass (kg)
- Wood (kg)

```
Order Item → Filter by:
  ✓ delivery_country = 'SI'
  ✓ applies_packaging_fee = true
  ✓ invoice_date in calendar year
  
→ Group by:
  - packaging_material_type
  - packaging_subcategory (e.g., secondary, tertiary)
  
→ Sum:
  - Total weight (kg) per material type
  
→ Calculate Fee:
  - Different rates per material
  - Usually: €0.10-€0.20 per kg depending on material
  
→ Considerations:
  - If SI sales > 15,000 kg annually → FURS reporting mandatory
  - Fee = cost for waste handling & recycling
  
→ Generate Report:
  - Via FURS eCarina + E-TROD system
  - XML export to accounting
  - Deadline: December 31, 2025
```

---

## 4. PRODUCT SETUP REQUIREMENTS

For each product in your catalog, you MUST store:

```
products table additions:
├── hs_code (string, 8 digits) - MANDATORY
│   └── Example: "854420" = Solar cells/modules
├── product_category (enum)
│   └── 'solar_equipment' | 'inverter' | 'battery' | 'cable' | 'misc'
├── is_electrical_equipment (BOOLEAN) - Determines TROD applicability
├── weight_per_unit_kg (DECIMAL) - Used for Intrastat
├── default_packaging_type (enum)
│   └── 'cardboard' | 'plastic' | 'foam' | 'wood' | 'none'
├── packaging_weight_per_unit_kg (DECIMAL)
└── trod_category_code (ENUM)
    └── '1' | '2' | '3' | '4' | '5' | '6' | '7'
```

**Why this matters:**
- HS Code determines what's reportable in Intrastat
- TROD category = fee calculation
- Packaging type = material tracking for waste reporting

---

## 5. REPORTING UI/UX DESIGN

### OSS Report Generator (Quarterly)

```
┌─ OSS Q1 2025 Report ─────────────────────────────────┐
│                                                       │
│ Period: 01/01/2025 - 31/03/2025                     │
│ Status: [Draft] [Ready to Submit] [Submitted ✓]     │
│                                                       │
│ Summary by Destination Country:                      │
│ ┌────────────────┬──────────┬──────────┬──────────┐  │
│ │ Country        │ Revenue  │ VAT Rate │ VAT Due  │  │
│ ├────────────────┼──────────┼──────────┼──────────┤  │
│ │ Germany (DE)   │ €50,000  │ 19%      │ €9,500   │  │
│ │ Austria (AT)   │ €30,000  │ 20%      │ €6,000   │  │
│ │ France (FR)    │ €45,000  │ 20%      │ €9,000   │  │
│ │ TOTAL          │ €125,000 │ -        │ €24,500  │  │
│ └────────────────┴──────────┴──────────┴──────────┘  │
│                                                       │
│ [Download PDF] [Export CSV] [Submit to FURS] [Audit] │
└─────────────────────────────────────────────────────┘
```

**Drill-Down Capability:**
- Click "Germany (DE)" → See all transactions to DE
- Filter by product type, customer, date range
- Validate calculations
- Audit trail of changes

---

### Intrastat Declaration Generator (Monthly)

```
┌─ Intrastat January 2025 ──────────────────────────┐
│                                                   │
│ Threshold Status: €89,450 / €270,000 (33%)       │
│ ⚠️  Alert: Set to exceed threshold by March      │
│                                                   │
│ Dispatches by Country & HS Code:                 │
│ ┌────────────────┬─────────┬────────┬──────────┐ │
│ │ HS Code │ Desc │ Country │ Value  │ Weight   │ │
│ ├─────────┼──────┼─────────┼────────┼──────────┤ │
│ │ 854420  │ Solar│ Germany │ €25k   │ 500 kg   │ │
│ │ 854420  │ Solar│ Austria │ €18k   │ 360 kg   │ │
│ │ 850300  │ Invrtr│ Germany │ €15k   │ 240 kg   │ │
│ │ TOTAL   │      │         │ €89,450│ 1,100 kg │ │
│ └────────────────┴─────────┴────────┴──────────┘ │
│                                                   │
│ [Export XML] [Preview] [Validate] [Submit to SURS]│
└───────────────────────────────────────────────────┘
```

**Validation Checks:**
- HS codes present for all items
- Weight provided for all items
- Currency is EUR
- No duplicate transactions
- Missing data highlighted in red

---

### TROD Report Generator (Annual)

```
┌─ TROD Report 2025 ────────────────────────────┐
│                                               │
│ Reporting Period: 01/01/2025 - 31/12/2025    │
│ Status: [Draft] [Ready] [Submitted]           │
│                                               │
│ Sales to Slovenia by TROD Category:           │
│ ┌──────────────────────┬──────┬────────────┐ │
│ │ Category             │ Units│ Total Fee  │ │
│ ├──────────────────────┼──────┼────────────┤ │
│ │ Cat 7: Solar Equip.  │ 245  │ €122.50    │ │
│ │ Cat 3: Inverters     │ 156  │ €78.00     │ │
│ │ Cat 1: Batteries     │ 89   │ €44.50     │ │
│ │ TOTAL                │ 490  │ €245.00    │ │
│ └──────────────────────┴──────┴────────────┘ │
│                                               │
│ [Export E-TROD XML] [Review] [Submit to FURS]│
└───────────────────────────────────────────────┘
```

---

### Packaging Waste Report Generator (Annual)

```
┌─ Packaging Waste 2025 ────────────────────────┐
│                                               │
│ Total Packaging Weight: 18,500 kg             │
│ Status: Reportable (> 15,000 kg threshold)   │
│                                               │
│ Material Breakdown:                           │
│ ┌──────────────┬──────┬────────┬──────────┐  │
│ │ Material     │ Weight│ % Total│ Fee Rate │  │
│ ├──────────────┼──────┼────────┼──────────┤  │
│ │ Cardboard    │ 12kkg│ 64.9%  │ €0.15/kg │  │
│ │ Plastic      │ 4.2kg│ 22.7%  │ €0.18/kg │  │
│ │ Foam         │ 1.8kg│ 9.7%   │ €0.12/kg │  │
│ │ Other        │ 0.5kg│ 2.7%   │ €0.10/kg │  │
│ │ TOTAL        │18.5kg│ 100%   │ €3,185   │  │
│ └──────────────┴──────┴────────┴──────────┘  │
│                                               │
│ [Export E-TROD XML] [Submit to FURS]         │
└────────────────────────────────────────────────┘
```

---

## 6. AI PROMPT FOR YOUR AI DEVELOPMENT ASSISTANT

Use this prompt when building the reporting modules:

```
You are building a compliance reporting system for a multi-country 
solar equipment distributor (Initra Energija) operating in Slovenia 
and selling across 21+ EU markets.

SYSTEM REQUIREMENTS:

1. DATABASE SCHEMA
- Create tables: orders, order_items, transactions_reporting_sync
- Every order item needs UUID, HS code, weight, packaging details
- Track delivery_country (where goods go), not customer country
- TROD/Packaging fees ONLY apply when: delivery_country='SI' 
  AND supplier_country='SI' AND product_type=electrical

2. OSS REPORTING (Quarterly)
- Filter orders by invoice_date within quarter
- Group by delivery_country and VAT rate
- Sum revenue and VAT by country
- Generate CSV/XML export format compatible with FURS eCarina portal
- Include audit trail showing all orders included

3. INTRASTAT REPORTING (Monthly)
- Filter orders to delivery_country != 'SI' (no domestic reporting)
- Extract: HS code, value (€ excl VAT), weight (kg), quantity
- Sum by Country + HS Code combination
- Check monthly threshold: €270,000 dispatches
- Monitor cumulative annual to flag when €9m statistical threshold reached
- Generate XML compatible with SURS (Slovenian Statistical Office)
- Include "zero declaration" option for months with no transactions

4. TROD REPORTING (Annual, December)
- Filter: delivery_country='SI' AND is_electrical_equipment=true
- Group by TROD category (1-7, mostly category 7 for solar)
- Sum quantities by category
- Calculate fees (rates vary per category - to be configured)
- Generate E-TROD XML via FURS eCarina
- Include option for mid-year submissions if thresholds hit

5. PACKAGING WASTE REPORTING (Annual, December)
- Filter: delivery_country='SI' AND packaging_weight_kg > 0
- Group by packaging_material_type
- Sum weight in kg per material
- Threshold: If > 15,000 kg annually → MUST REPORT
- Generate E-TROD XML format
- Connect to waste management cost allocation

6. ADMIN INTERFACE
- Single "Reporting" section (not under Accounting)
- Separate tabs for OSS, Intrastat, TROD, Packaging
- Dashboard showing:
  * Current reporting period
  * Threshold progress (with % meters)
  * Upcoming deadlines (color-coded)
  * Missing data alerts
- Export functions: PDF, CSV, XML
- Submission audit log
- Allow manual corrections with timestamp trail

7. DATA VALIDATION
- Flag missing HS codes immediately
- Alert when VAT rate doesn't match delivery country
- Check for duplicate transactions
- Warn if product has no TROD/packaging configuration
- Validate HS codes against official Combined Nomenclature

8. EXPORT FORMATS
- CSV for accounting/audit
- XML for FURS eCarina (E-TROD schema)
- XML for SURS Intrastat
- PDF for archive/review
- JSON for API integration with your accountant

The system must handle corrections/amendments for previously 
submitted reports and maintain full audit trails. All calculations 
should be auditable to individual order level.
```

---

## 7. IMPLEMENTATION ROADMAP

### Phase 1 (Month 1): Foundation
- [ ] Extend database schema with reporting fields
- [ ] Implement HS code management system
- [ ] Build product configuration (TROD categories, packaging types)
- [ ] Create basic transaction filtering logic

### Phase 2 (Month 2): Core Reporting
- [ ] OSS report generator
- [ ] Intrastat declaration builder
- [ ] Admin UI for reporting dashboard
- [ ] CSV/PDF export functionality

### Phase 3 (Month 3): Compliance Features
- [ ] TROD report generator
- [ ] Packaging waste tracker
- [ ] E-TROD XML export
- [ ] Threshold monitoring & alerts

### Phase 4 (Month 4): Polish & Integration
- [ ] Audit trails & corrections
- [ ] Accountant export formats
- [ ] Calendar of deadlines
- [ ] Testing with actual submissions

---

## 8. CRITICAL DEADLINES (2025)

```
Q1 (Jan-Mar):
  - 20 April: OSS return due for Q1
  
Monthly (ongoing):
  - 15th: Intrastat due for previous month (when threshold exceeded)
  
Q2 (Apr-Jun):
  - 20 July: OSS return due for Q2
  
Q3 (Jul-Sep):
  - 20 October: OSS return due for Q3
  
Q4 (Oct-Dec):
  - 20 January 2026: OSS return due for Q4
  - December 31: TROD report due (via FURS eCarina)
  - December 31: Packaging waste report due (via FURS eCarina)
```

---

## 9. CONFIGURATION SETTINGS

Store these in your `app_settings` or `config` table:

```json
{
  "oss": {
    "enabled": true,
    "member_state_of_identification": "SI",
    "registration_date": "2025-01-15",
    "oss_scheme": "union_scheme",
    "auto_submit": false
  },
  "intrastat": {
    "enabled": true,
    "threshold_dispatches_eur": 270000,
    "threshold_arrivals_eur": 240000,
    "statistical_threshold_eur": 9000000,
    "authority_email": "intrastat.fu@gov.si"
  },
  "trod": {
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
    }
  },
  "packaging_waste": {
    "enabled": true,
    "reporting_threshold_kg": 15000,
    "material_rates": {
      "cardboard": 0.15,
      "plastic": 0.18,
      "foam": 0.12,
      "metal": 0.20,
      "glass": 0.10,
      "wood": 0.12
    }
  }
}
```

---

## 10. ACCOUNTING INTEGRATION

From Reporting → Accounting flow:

```
OSS Q1 Report
  → Lines: VAT payable by country
  → Create GL entries: 
    - Debit: VAT Payable
    - Credit: Bank (when paid)

TROD Annual
  → Lines: TROD fees by category
  → Create GL entry:
    - Debit: Environmental Fees Expense
    - Credit: TROD Payable

Packaging Waste Annual
  → Lines: Packaging fees by material
  → Create GL entry:
    - Debit: Waste Management Expense
    - Credit: Packaging Payable

All items appear in monthly/annual 
accounting reports with full audit trail.
```

---

## NEXT STEPS FOR YOU

1. **Review product catalog:** Ensure every product has:
   - HS code (accurate to 8 digits)
   - TROD category (if electrical)
   - Weight data
   - Packaging type & weight

2. **Validate with accountant:** Confirm:
   - OSS registration strategy
   - TROD fee rates for your categories
   - Packaging material classifications

3. **Get FURS credentials:**
   - E-TROD username/password
   - Access to eCarina portal

4. **Test with pilot orders:** 
   - Process 5-10 test orders through your system
   - Generate sample reports
   - Validate calculations

5. **Build iteratively:**
   - Start with OSS (most critical)
   - Add Intrastat when you approach threshold
   - TROD/Packaging can follow (annual deadline gives you time)

---

**This architecture ensures you're audit-ready at all times and can generate 
any required report within hours.**
