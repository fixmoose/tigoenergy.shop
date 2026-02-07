import { createClient } from '@/lib/supabase/server'
import type {
  OSSReportRow,
  OSSSummary,
  OSSReportData,
  IntrastatReportRow,
  IntrastatSummary,
  IntrastatReportData,
  ETRODReportRow,
  ETRODSummary,
  ETRODReportData,
  PackagingReportRow,
  PackagingSummary,
  PackagingReportData,
  ThresholdCheck,
  ReportingCalendarEntry,
  ComplianceDashboardItem,
  EUMemberState,
} from '@/types/compliance'

// ============================================================================
// OSS (One Stop Shop) VAT Reporting
// ============================================================================

export async function getOSSReport(year: number, quarter: number): Promise<OSSReportData> {
  const supabase = await createClient()

  // Call the PostgreSQL function for detailed report
  const { data: rows, error: rowsError } = await supabase.rpc('generate_oss_report', {
    p_year: year,
    p_quarter: quarter,
  })

  if (rowsError) {
    console.error('Error fetching OSS report:', rowsError)
    throw new Error(`Failed to generate OSS report: ${rowsError.message}`)
  }

  // Call the summary function
  const { data: summaryData, error: summaryError } = await supabase.rpc('get_oss_summary', {
    p_year: year,
    p_quarter: quarter,
  })

  if (summaryError) {
    console.error('Error fetching OSS summary:', summaryError)
    throw new Error(`Failed to get OSS summary: ${summaryError.message}`)
  }

  const summary = summaryData?.[0] || {
    total_taxable_amount: 0,
    total_vat_amount: 0,
    total_orders: 0,
    countries_sold_to: 0,
    submission_deadline: null,
  }

  return {
    year,
    quarter,
    rows: (rows || []) as OSSReportRow[],
    summary: summary as OSSSummary,
  }
}

// ============================================================================
// Intrastat Reporting
// ============================================================================

export async function getIntrastatReport(year: number, month: number): Promise<IntrastatReportData> {
  const supabase = await createClient()

  // Call the PostgreSQL function for detailed report
  const { data: rows, error: rowsError } = await supabase.rpc('generate_intrastat_report', {
    p_year: year,
    p_month: month,
  })

  if (rowsError) {
    console.error('Error fetching Intrastat report:', rowsError)
    throw new Error(`Failed to generate Intrastat report: ${rowsError.message}`)
  }

  // Call the summary function
  const { data: summaryData, error: summaryError } = await supabase.rpc('get_intrastat_summary', {
    p_year: year,
    p_month: month,
  })

  if (summaryError) {
    console.error('Error fetching Intrastat summary:', summaryError)
    throw new Error(`Failed to get Intrastat summary: ${summaryError.message}`)
  }

  const summary = summaryData?.[0] || {
    monthly_value_eur: 0,
    monthly_weight_kg: 0,
    monthly_shipments: 0,
    ytd_dispatches_eur: 0,
    threshold_eur: 270000,
    threshold_exceeded: false,
    submission_deadline: null,
  }

  return {
    year,
    month,
    rows: (rows || []) as IntrastatReportRow[],
    summary: summary as IntrastatSummary,
  }
}

export async function saveIntrastatReport(year: number, month: number): Promise<number> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('save_intrastat_report', {
    p_year: year,
    p_month: month,
  })

  if (error) {
    console.error('Error saving Intrastat report:', error)
    throw new Error(`Failed to save Intrastat report: ${error.message}`)
  }

  return data as number
}

// ============================================================================
// eTROD (WEEE) Reporting
// ============================================================================

export async function getETRODReport(year: number, quarter: number, periodType: 'quarter' | 'half_year' = 'quarter'): Promise<ETRODReportData> {
  const supabase = await createClient()

  // Call the PostgreSQL function for detailed report
  const { data: rows, error: rowsError } = await supabase.rpc('generate_trod_report', {
    p_year: year,
    p_quarter: quarter,
    p_period_type: periodType
  })

  if (rowsError) {
    console.error('Error fetching eTROD report:', rowsError)
    throw new Error(`Failed to generate eTROD report: ${rowsError.message}`)
  }

  // Call the summary function
  const { data: summaryData, error: summaryError } = await supabase.rpc('get_trod_summary', {
    p_year: year,
    p_quarter: quarter,
    p_period_type: periodType
  })

  if (summaryError) {
    console.error('Error fetching eTROD summary:', summaryError)
    throw new Error(`Failed to get eTROD summary: ${summaryError.message}`)
  }

  const summary = summaryData?.[0] || {
    total_units: 0,
    total_weight_kg: 0,
    total_fee_eur: 0,
    categories_count: 0,
    reporting_authority: 'FURS',
  }

  return {
    year,
    quarter,
    period_type: periodType,
    rows: (rows || []) as ETRODReportRow[],
    summary: summary as ETRODSummary,
  }
}

// ============================================================================
// Packaging Waste Reporting
// ============================================================================

export async function getPackagingReport(
  year: number,
  month: number | null = null,
  quarter: number | null = null,
  country: string = 'SI'
): Promise<PackagingReportData> {
  const supabase = await createClient()

  // Call the PostgreSQL function for detailed report
  const { data: rows, error: rowsError } = await supabase.rpc('generate_packaging_report', {
    p_year: year,
    p_month: month,
    p_quarter: quarter,
    p_country: country
  })

  if (rowsError) {
    console.error('Error fetching Packaging report:', rowsError)
    throw new Error(`Failed to generate Packaging report: ${rowsError.message}`)
  }

  // Call the summary function
  const { data: summaryData, error: summaryError } = await supabase.rpc('get_packaging_summary', {
    p_year: year,
    p_month: month,
    p_quarter: quarter,
    p_country: country
  })

  if (summaryError) {
    console.error('Error fetching Packaging summary:', summaryError)
    throw new Error(`Failed to get Packaging summary: ${summaryError.message}`)
  }

  const summary = summaryData?.[0] || {
    total_weight_kg: 0,
    total_fee_eur: 0,
    threshold_kg: 15000,
    threshold_exceeded: false,
    material_types_count: 0,
  }

  return {
    year,
    month,
    quarter,
    country,
    rows: (rows || []) as PackagingReportRow[],
    summary: summary as PackagingSummary,
  }
}

// ============================================================================
// Threshold Monitoring
// ============================================================================

export async function checkReportingThresholds(): Promise<ThresholdCheck[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('check_reporting_thresholds')

  if (error) {
    console.error('Error checking thresholds:', error)
    throw new Error(`Failed to check reporting thresholds: ${error.message}`)
  }

  return (data || []) as ThresholdCheck[]
}

// ============================================================================
// Reporting Calendar
// ============================================================================

export async function getReportingCalendar(year?: number): Promise<ReportingCalendarEntry[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_reporting_calendar', {
    p_year: year || null,
  })

  if (error) {
    console.error('Error fetching reporting calendar:', error)
    throw new Error(`Failed to get reporting calendar: ${error.message}`)
  }

  return (data || []) as ReportingCalendarEntry[]
}

// ============================================================================
// Compliance Dashboard
// ============================================================================

export async function getComplianceDashboard(): Promise<ComplianceDashboardItem[]> {
  const supabase = await createClient()

  const { data, error } = await supabase.from('compliance_dashboard').select('*')

  if (error) {
    console.error('Error fetching compliance dashboard:', error)
    throw new Error(`Failed to get compliance dashboard: ${error.message}`)
  }

  return (data || []) as ComplianceDashboardItem[]
}

// ============================================================================
// EU Member States Reference
// ============================================================================

export async function getEUMemberStates(): Promise<EUMemberState[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('eu_member_states')
    .select('country_code, country_name, standard_vat_rate, is_eurozone')
    .order('country_name')

  if (error) {
    console.error('Error fetching EU member states:', error)
    throw new Error(`Failed to get EU member states: ${error.message}`)
  }

  return (data || []) as EUMemberState[]
}

// ============================================================================
// Export Helpers
// ============================================================================

export function generateOSSXML(report: OSSReportData): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<OSSReturn xmlns="urn:eu:taxud:oss:v1">',
    `  <Period>`,
    `    <Year>${report.year}</Year>`,
    `    <Quarter>Q${report.quarter}</Quarter>`,
    `  </Period>`,
    `  <MemberStateOfIdentification>SI</MemberStateOfIdentification>`,
    `  <Supplies>`,
  ]

  for (const row of report.rows) {
    lines.push(`    <Supply>`)
    lines.push(`      <MemberStateOfConsumption>${row.member_state}</MemberStateOfConsumption>`)
    lines.push(`      <VATRate>${row.vat_rate.toFixed(2)}</VATRate>`)
    lines.push(`      <TaxableAmount>${row.taxable_amount.toFixed(2)}</TaxableAmount>`)
    lines.push(`      <VATAmount>${row.vat_amount.toFixed(2)}</VATAmount>`)
    lines.push(`    </Supply>`)
  }

  lines.push(`  </Supplies>`)
  lines.push(`  <TotalVATAmount>${report.summary.total_vat_amount.toFixed(2)}</TotalVATAmount>`)
  lines.push(`</OSSReturn>`)

  return lines.join('\n')
}

export function generateIntrastatCSV(report: IntrastatReportData): string {
  const headers = [
    'CN Code',
    'Destination',
    'Country Name',
    'Value (EUR)',
    'Mass (kg)',
    'Units',
    'Transaction',
    'Transport',
  ]

  const rows = report.rows.map((row) =>
    [
      row.cn_code,
      row.destination_country,
      row.country_name,
      row.statistical_value_eur.toFixed(2),
      row.net_mass_kg.toFixed(2),
      row.supplementary_units,
      row.nature_of_transaction,
      row.mode_of_transport,
    ].join(',')
  )

  return [headers.join(','), ...rows].join('\n')
}

export function generateETRODCSV(report: ETRODReportData): string {
  const headers = [
    'Category Code',
    'Category Description',
    'Units Sold',
    'Weight (kg)',
    'Fee Rate (EUR/kg)',
    'Total Fee (EUR)',
  ]

  const rows = report.rows.map((row) =>
    [
      row.etrod_category,
      `"${row.category_description}"`,
      row.units_sold,
      row.total_weight_kg.toFixed(2),
      row.fee_rate_per_kg.toFixed(2),
      row.total_fee_eur.toFixed(2),
    ].join(',')
  )

  return [headers.join(','), ...rows].join('\n')
}

export function generatePackagingCSV(report: PackagingReportData): string {
  const headers = [
    'Material Type',
    'Weight (kg)',
    'Fee Rate (EUR/kg)',
    'Total Fee (EUR)',
    '% of Total',
  ]

  const rows = report.rows.map((row) =>
    [
      row.material_type,
      row.total_weight_kg.toFixed(2),
      row.fee_rate_per_kg.toFixed(3),
      row.total_fee_eur.toFixed(2),
      row.percentage_of_total.toFixed(1),
    ].join(',')
  )

  return [headers.join(','), ...rows].join('\n')
}
