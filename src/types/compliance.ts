// Compliance & Reporting Types for OSS, Intrastat, TROD, and Packaging

// ============================================================================
// OSS (One Stop Shop) VAT Types
// ============================================================================

export interface OSSReportRow {
  member_state: string
  member_state_name: string
  vat_rate: number
  taxable_amount: number
  vat_amount: number
  order_count: number
  currency: string
}

export interface OSSSummary {
  total_taxable_amount: number
  total_vat_amount: number
  total_orders: number
  countries_sold_to: number
  submission_deadline: string
}

export interface OSSReportData {
  year: number
  quarter: number
  rows: OSSReportRow[]
  summary: OSSSummary
}

// ============================================================================
// Intrastat Types
// ============================================================================

export interface IntrastatReportRow {
  cn_code: string
  destination_country: string
  country_name: string
  statistical_value_eur: number
  net_mass_kg: number
  supplementary_units: number
  nature_of_transaction: string
  mode_of_transport: string
  order_count: number
}

export interface IntrastatSummary {
  monthly_value_eur: number
  monthly_weight_kg: number
  monthly_shipments: number
  ytd_dispatches_eur: number
  threshold_eur: number
  threshold_exceeded: boolean
  submission_deadline: string
}

export interface IntrastatReportData {
  year: number
  month: number
  rows: IntrastatReportRow[]
  summary: IntrastatSummary
}

// ============================================================================
// eTROD (WEEE & Packaging) Types
// ============================================================================

export interface ETRODReportRow {
  etrod_category: string
  category_description: string
  units_sold: number
  total_weight_kg: number
  fee_rate_per_kg: number
  total_fee_eur: number
  order_count: number
}

export interface ETRODSummary {
  total_units: number
  total_weight_kg: number
  total_fee_eur: number
  categories_count: number
  reporting_authority: string
}

export interface ETRODReportData {
  year: number
  quarter: number
  period_type?: 'quarter' | 'half_year'
  rows: ETRODReportRow[]
  summary: ETRODSummary
}

// ============================================================================
// Packaging Waste Types
// ============================================================================

export interface PackagingReportRow {
  material_type: string
  total_weight_kg: number
  fee_rate_per_kg: number
  total_fee_eur: number
  order_count: number
  percentage_of_total: number
}

export interface PackagingSummary {
  total_weight_kg: number
  total_fee_eur: number
  threshold_kg: number
  threshold_exceeded: boolean
  material_types_count: number
}

export interface PackagingReportData {
  year: number
  month?: number | null
  quarter?: number | null
  country: string
  rows: PackagingReportRow[]
  summary: PackagingSummary
}

// ============================================================================
// Threshold Monitoring Types
// ============================================================================

export type ThresholdStatus = 'OK' | 'WARNING' | 'EXCEEDED' | 'REGISTERED'

export interface ThresholdCheck {
  report_type: string
  metric: string
  current_value: number
  threshold_value: number
  percentage_of_threshold: number
  status: ThresholdStatus
  action_required: string
}

// ============================================================================
// Reporting Calendar Types
// ============================================================================

export type ReportingPeriodStatus = 'PAST' | 'CURRENT' | 'FUTURE'

export interface ReportingCalendarEntry {
  report_type: string
  period_name: string
  period_start: string
  period_end: string
  submission_deadline: string | null
  status: ReportingPeriodStatus
}

// ============================================================================
// Compliance Dashboard Types
// ============================================================================

export interface ComplianceDashboardItem {
  report_type: string
  period: string
  amount: number
  count: number
  deadline: string | null
}

// ============================================================================
// EU Member States Reference
// ============================================================================

export interface EUMemberState {
  country_code: string
  country_name: string
  standard_vat_rate: number
  is_eurozone: boolean
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface ETRODConfig {
  enabled: boolean
  reporting_authority: string
  category_rates: Record<string, number>
  default_category_for_solar: string
}

export interface PackagingConfig {
  enabled: boolean
  reporting_threshold_kg: number
  material_rates: Record<string, number>
}

export interface IntrastatConfig {
  enabled: boolean
  threshold_dispatches_eur: number
  threshold_arrivals_eur: number
  statistical_threshold_eur: number
  submission_deadline_day: number
  authority: string
}

export interface OSSConfig {
  enabled: boolean
  member_state_of_identification: string
  scheme: string
  submission_deadline_days_after_quarter: number
  authority: string
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ReportingAPIResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// ============================================================================
// Export Format Types
// ============================================================================

export type ExportFormat = 'json' | 'csv' | 'xml'

export interface ExportOptions {
  format: ExportFormat
  includeHeaders?: boolean
  filename?: string
}
