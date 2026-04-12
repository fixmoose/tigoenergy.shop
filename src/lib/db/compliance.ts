import { createClient, createAdminClient } from '@/lib/supabase/server'
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

// Country name → ISO 2-letter code mapping for country_of_origin normalization
const COUNTRY_NAME_TO_ISO: Record<string, string> = {
  'Thailand': 'TH', 'China': 'CN', 'Netherlands': 'NL', 'Germany': 'DE',
  'United States': 'US', 'USA': 'US', 'Taiwan': 'TW', 'Japan': 'JP',
  'South Korea': 'KR', 'Korea': 'KR', 'India': 'IN', 'Vietnam': 'VN',
  'Malaysia': 'MY', 'Indonesia': 'ID', 'Italy': 'IT', 'France': 'FR',
  'Spain': 'ES', 'Czech Republic': 'CZ', 'Czechia': 'CZ', 'Poland': 'PL',
  'Austria': 'AT', 'Belgium': 'BE', 'Croatia': 'HR', 'Slovenia': 'SI',
  'Hungary': 'HU', 'Romania': 'RO', 'Bulgaria': 'BG', 'Slovakia': 'SK',
  'Portugal': 'PT', 'Sweden': 'SE', 'Denmark': 'DK', 'Finland': 'FI',
  'Ireland': 'IE', 'Greece': 'GR', 'Estonia': 'EE', 'Latvia': 'LV',
  'Lithuania': 'LT', 'Luxembourg': 'LU', 'Malta': 'MT', 'Cyprus': 'CY',
}

function normalizeCountryCode(code: string | null | undefined): string {
  if (!code) return 'US'
  if (code.length === 2) return code.toUpperCase()
  return COUNTRY_NAME_TO_ISO[code] || code.substring(0, 2).toUpperCase()
}

// EU member states (excluding SI for dispatch filtering)
const EU_COUNTRIES = new Set([
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU',
  'IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','ES','SE'
])

// Fallback CN8 / weight / origin per internal product code for goods_receipts items
// that do not store these fields inline. Used when aggregating arrivals for Intrastat.
// 'SKIP' cn_code marks service lines (transport, install) that are never in Intrastat.
const GR_PRODUCT_MAP: Record<string, { cn_code: string; weight_kg: number; country_of_origin: string }> = {
  '119700263': { cn_code: '90308900', weight_kg: 0.56, country_of_origin: 'CN' }, // Tigo TS4-A-O
  '119700909': { cn_code: '90308900', weight_kg: 0.59, country_of_origin: 'CN' }, // Tigo TS4-A-2F MC4
  '119700891': { cn_code: '90308900', weight_kg: 0.59, country_of_origin: 'CN' }, // Tigo TS4-A-2F EVO2
  '119700898': { cn_code: '90308900', weight_kg: 0.56, country_of_origin: 'TH' }, // Tigo TS4-A-O EVO2
  '119700901': { cn_code: '90308900', weight_kg: 0.65, country_of_origin: 'TH' }, // Tigo TS4-X-O
  '119700264': { cn_code: '90308900', weight_kg: 0.56, country_of_origin: 'CN' }, // Tigo TS4-A-F
  '119700265': { cn_code: '84719000', weight_kg: 0.43, country_of_origin: 'CN' }, // Tigo CCA Kit
  '119700268': { cn_code: '84719000', weight_kg: 0.21, country_of_origin: 'CN' }, // Tigo TAP
  '119700892': { cn_code: '85414300', weight_kg: 21.1, country_of_origin: 'VN' }, // Trina TSM-450NEG9R.28
  '119700924': { cn_code: '85414300', weight_kg: 32.2, country_of_origin: 'VN' }, // DAS-DH132NE-615
  '119700925': { cn_code: '85044060', weight_kg: 15.0, country_of_origin: 'CN' }, // SolaX Battery Parallel BOX
  '119700535': { cn_code: '76109090', weight_kg: 25.0, country_of_origin: 'DE' }, // Renusol mounting
  '119700931': { cn_code: '85414300', weight_kg: 28.5, country_of_origin: 'VN' }, // DAH 580W
  // Services — never in Intrastat
  '119700279': { cn_code: 'SKIP', weight_kg: 0, country_of_origin: '' },            // Prevoz - AP
  '119700582': { cn_code: 'SKIP', weight_kg: 0, country_of_origin: '' },            // Prevoz - AP
}

type GoodsReceiptItem = {
  code?: string
  name?: string
  qty?: number
  unit?: string
  price?: number
  cn_code?: string
  weight_kg?: number
  country_of_origin?: string
}

type IntrastatDeclaration = {
  flowCode: 1 | 2
  declType: 'PRBL' | 'RACN'
  partnerCountry: string  // MSConsDestCode — destination (dispatches) or dispatching country (arrivals)
  partnerVat?: string     // partnerId — only for dispatches
  items: Array<{
    description: string
    cnCode: string
    countryOfOrigin: string
    netMass: number
    quantity: number
    invoicedAmount: number
  }>
}

/**
 * Generate INSTAT XML for Slovenian Intrastat reporting to SURS.
 * Emits both dispatches (flowCode=2, from orders) and arrivals (flowCode=1, from goods_receipts).
 */
export async function generateIntrastatXML(year: number, month: number): Promise<string> {
  const supabase = await createAdminClient()

  const periodStart = `${year}-${month.toString().padStart(2, '0')}-01`
  const nextMonth = month < 12 ? month + 1 : 1
  const nextYear = month < 12 ? year : year + 1
  const periodEnd = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`
  const referencePeriod = `${year}${month.toString().padStart(2, '0')}`

  const decls: IntrastatDeclaration[] = []

  // ==========================================================================
  // Dispatches (odprema, flowCode=2, RACN) — from orders table
  // Source: issued invoices to EU customers (delivery_country != SI, in EU set)
  // ==========================================================================
  const { data: orders, error: ordersErr } = await supabase
    .from('orders')
    .select('id,order_number,invoice_number,delivery_country,vat_id,subtotal,total,vat_amount,shipped_at,invoice_created_at')
    .not('invoice_number', 'is', null)
    .not('delivery_country', 'is', null)
    .neq('delivery_country', 'SI')
    .gte('invoice_created_at', periodStart)
    .lt('invoice_created_at', periodEnd)
    .order('invoice_created_at', { ascending: true })

  if (ordersErr) throw new Error(`Failed to fetch orders: ${ordersErr.message}`)

  const euOrders = (orders || []).filter(o => o.delivery_country && EU_COUNTRIES.has(o.delivery_country))

  if (euOrders.length > 0) {
    const orderIds = euOrders.map(o => o.id)
    const { data: allItems } = await supabase
      .from('order_items')
      .select('order_id,product_name,sku,quantity,unit_price,total_price,weight_kg,cn_code,product_id')
      .in('order_id', orderIds)

    const productIds = [...new Set((allItems || []).map(i => i.product_id).filter(Boolean))]
    let productMap: Record<string, { country_of_origin: string; cn_code: string; weight_kg: number }> = {}
    if (productIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('id,country_of_origin,cn_code,weight_kg')
        .in('id', productIds)
      for (const p of products || []) productMap[p.id] = p
    }

    const itemsByOrder: Record<string, NonNullable<typeof allItems>> = {}
    for (const item of allItems || []) {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = []
      itemsByOrder[item.order_id]!.push(item)
    }

    for (const order of euOrders) {
      const orderItems = itemsByOrder[order.id] || []
      if (orderItems.length === 0) continue

      const declItems: IntrastatDeclaration['items'] = []
      for (const item of orderItems) {
        const product = item.product_id ? productMap[item.product_id] : null
        const cnCode = (item.cn_code || product?.cn_code || '00000000').replace(/\D/g, '').padEnd(8, '0')
        const originCountry = normalizeCountryCode(product?.country_of_origin)
        const weightPerUnit = item.weight_kg || product?.weight_kg || 0
        const netMass = Number((weightPerUnit * item.quantity).toFixed(2))
        const invoicedAmount = Number(item.total_price || 0)
        declItems.push({
          description: item.product_name,
          cnCode,
          countryOfOrigin: originCountry,
          netMass,
          quantity: item.quantity,
          invoicedAmount,
        })
      }

      decls.push({
        flowCode: 2,
        declType: 'RACN',
        partnerCountry: order.delivery_country!,
        partnerVat: order.vat_id || undefined,
        items: declItems,
      })
    }
  }

  // ==========================================================================
  // Arrivals (prejem, flowCode=1, PRBL) — from goods_receipts table
  // Source: received goods from EU suppliers (supplier_country != SI, in EU set)
  // Services are skipped (items missing cn_code or weight, or cn_code='SKIP').
  // ==========================================================================
  const { data: receipts, error: receiptsErr } = await supabase
    .from('goods_receipts')
    .select('document_number,receipt_date,supplier_name,supplier_country,supplier_invoice_number,items,net_amount')
    .gte('receipt_date', periodStart)
    .lt('receipt_date', periodEnd)
    .not('supplier_country', 'is', null)
    .order('receipt_date', { ascending: true })

  if (receiptsErr) throw new Error(`Failed to fetch goods_receipts: ${receiptsErr.message}`)

  const euReceipts = (receipts || []).filter(r => r.supplier_country && EU_COUNTRIES.has(r.supplier_country))

  for (const receipt of euReceipts) {
    const rawItems: GoodsReceiptItem[] = typeof receipt.items === 'string'
      ? JSON.parse(receipt.items)
      : (receipt.items || [])

    const declItems: IntrastatDeclaration['items'] = []
    for (const item of rawItems) {
      const fallback = item.code ? GR_PRODUCT_MAP[item.code] : null
      const rawCn = (item.cn_code || fallback?.cn_code || '').toString()
      if (rawCn === 'SKIP' || !rawCn) continue  // service or unknown → skip
      const cnCode = rawCn.replace(/\D/g, '').padEnd(8, '0')
      if (cnCode === '00000000') continue

      const weightPerUnit = Number(item.weight_kg ?? fallback?.weight_kg ?? 0)
      if (weightPerUnit === 0) continue  // no weight → treat as non-goods / service

      const origin = normalizeCountryCode(item.country_of_origin || fallback?.country_of_origin)
      const qty = Number(item.qty || 0)
      const price = Number(item.price || 0)
      if (qty === 0) continue
      const netMass = Number((weightPerUnit * qty).toFixed(2))
      const invoicedAmount = Number((qty * price).toFixed(2))

      declItems.push({
        description: item.name || item.code || 'Goods',
        cnCode,
        countryOfOrigin: origin,
        netMass,
        quantity: qty,
        invoicedAmount,
      })
    }

    if (declItems.length === 0) continue  // receipt had only services
    decls.push({
      flowCode: 1,
      declType: 'PRBL',
      partnerCountry: receipt.supplier_country!,
      items: declItems,
    })
  }

  // ==========================================================================
  // Emit XML envelope
  // ==========================================================================
  if (decls.length === 0) {
    return generateEmptyInstatXML(referencePeriod)
  }

  const now = new Date()
  const dateStr = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')}`
  const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`
  const PSI = 'SI62518313'
  const PSI_DIGITS = '62518313'
  const YY = year.toString().slice(-2)

  const lines: string[] = []
  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push('<INSTAT xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://intrastat-surs.gov.si/xml/schema/INSTAT62-SI.xsd">')
  lines.push('    <Envelope>')
  lines.push(`        <envelopeId>${Math.floor(Math.random()*9000+1000)}_${dateStr.replace(/-/g,'')}_${timeStr.replace(/:/g,'')}</envelopeId>`)
  lines.push('        <DateTime>')
  lines.push(`            <date>${dateStr}</date>`)
  lines.push(`            <time>${timeStr}</time>`)
  lines.push('        </DateTime>')
  lines.push('        <Party partyType="PSI" partyRole="sender">')
  lines.push(`            <partyId>${PSI}    000</partyId>`)
  lines.push('            <partyName>INITRA ENERGIJA, PRODAJA IN STORITVE, D.O.O.</partyName>')
  lines.push('        </Party>')
  lines.push('        <Party partyType="CC" partyRole="receiver">')
  lines.push('            <partyId>SI47730811    000</partyId>')
  lines.push('            <partyName>Carinski urad Nova Gorica</partyName>')
  lines.push('        </Party>')

  // Per-type sequence counters so declarationIds stay meaningful (PRBL00001, RACN00001, ...)
  const seqByType: Record<'PRBL' | 'RACN', number> = { PRBL: 0, RACN: 0 }

  for (let di = 0; di < decls.length; di++) {
    const decl = decls[di]
    const isLast = di === decls.length - 1
    seqByType[decl.declType] += 1
    const declId = `${PSI_DIGITS}${YY}${decl.declType}${seqByType[decl.declType].toString().padStart(5, '0')}`

    lines.push('        <Declaration>')
    lines.push(`            <declarationId>${declId}</declarationId>`)
    lines.push(`            <referencePeriod>${referencePeriod}</referencePeriod>`)
    lines.push(`            <PSIId>${PSI}000</PSIId>`)
    lines.push('            <Function>')
    lines.push('                <functionCode>I</functionCode>')
    lines.push('            </Function>')
    lines.push(`            <flowCode>${decl.flowCode}</flowCode>`)
    lines.push('            <currencyCode>EUR</currencyCode>')
    lines.push(`            <firstLast>${isLast ? '1' : '0'}</firstLast>`)

    for (let ii = 0; ii < decl.items.length; ii++) {
      const item = decl.items[ii]
      lines.push('            <Item>')
      lines.push(`                <itemNumber>${ii + 1}</itemNumber>`)
      lines.push('                <CN8>')
      lines.push(`                    <CN8Code>${item.cnCode}</CN8Code>`)
      lines.push('                </CN8>')
      lines.push(`                <goodsDescription>${escapeXml(item.description)}</goodsDescription>`)
      lines.push(`                <MSConsDestCode>${decl.partnerCountry}</MSConsDestCode>`)
      lines.push(`                <countryOfOriginCode>${item.countryOfOrigin}</countryOfOriginCode>`)
      lines.push(`                <netMass>${item.netMass}</netMass>`)
      lines.push(`                <quantityInSU>${item.quantity}</quantityInSU>`)
      lines.push(`                <invoicedAmount>${item.invoicedAmount}</invoicedAmount>`)
      lines.push(`                <statisticalValue>${item.invoicedAmount}</statisticalValue>`)
      if (decl.partnerVat) {
        lines.push(`                <partnerId>${escapeXml(decl.partnerVat)}</partnerId>`)
      }
      lines.push('                <NatureOfTransaction>')
      lines.push('                    <natureOfTransactionACode>1</natureOfTransactionACode>')
      lines.push('                    <natureOfTransactionBCode>1</natureOfTransactionBCode>')
      lines.push('                </NatureOfTransaction>')
      lines.push('                <modeOfTransportCode>3</modeOfTransportCode>')
      lines.push('                <DeliveryTerms>')
      lines.push('                    <TODCode>DDP</TODCode>')
      lines.push('                    <locationCode>2</locationCode>')
      lines.push('                </DeliveryTerms>')
      lines.push('                <numberOfConsignments>1</numberOfConsignments>')
      lines.push('            </Item>')
    }

    lines.push(`            <totalNumberLines>${decl.items.length}</totalNumberLines>`)
    lines.push('        </Declaration>')
  }

  lines.push(`        <numberOfDeclarations>${decls.length}</numberOfDeclarations>`)
  lines.push('    </Envelope>')
  lines.push('</INSTAT>')

  return lines.join('\n')
}

function generateEmptyInstatXML(referencePeriod: string): string {
  const now = new Date()
  const dateStr = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')}`
  const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`
  return `<?xml version="1.0" encoding="UTF-8"?>
<INSTAT xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://intrastat-surs.gov.si/xml/schema/INSTAT62-SI.xsd">
    <Envelope>
        <envelopeId>${Math.floor(Math.random()*9000+1000)}_${dateStr.replace(/-/g,'')}_${timeStr.replace(/:/g,'')}</envelopeId>
        <DateTime>
            <date>${dateStr}</date>
            <time>${timeStr}</time>
        </DateTime>
        <Party partyType="PSI" partyRole="sender">
            <partyId>SI62518313    000</partyId>
            <partyName>INITRA ENERGIJA, PRODAJA IN STORITVE, D.O.O.</partyName>
        </Party>
        <Party partyType="CC" partyRole="receiver">
            <partyId>SI47730811    000</partyId>
            <partyName>Carinski urad Nova Gorica</partyName>
        </Party>
        <numberOfDeclarations>0</numberOfDeclarations>
    </Envelope>
</INSTAT>`
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
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
