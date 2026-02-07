import { NextRequest, NextResponse } from 'next/server'
import { getETRODReport, generateETRODCSV } from '@/lib/db/compliance'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const quarter = parseInt(searchParams.get('quarter') || Math.ceil((new Date().getMonth() + 1) / 3).toString())
    const periodType = (searchParams.get('period_type') as 'quarter' | 'half_year') || 'quarter'
    const format = searchParams.get('format') || 'json'

    if (quarter < 1 || (periodType === 'quarter' && quarter > 4) || (periodType === 'half_year' && quarter > 2)) {
      return NextResponse.json(
        { success: false, error: 'Invalid period selected' },
        { status: 400 }
      )
    }

    const report = await getETRODReport(year, quarter, periodType)

    if (format === 'csv') {
      const csv = generateETRODCSV(report)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="etrod-q${quarter}-${year}.csv"`,
        },
      })
    }

    return NextResponse.json({ success: true, data: report })
  } catch (error) {
    console.error('eTROD report error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to generate eTROD report' },
      { status: 500 }
    )
  }
}
