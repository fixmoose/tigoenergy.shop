import { NextRequest, NextResponse } from 'next/server'
import { getPackagingReport, generatePackagingCSV } from '@/lib/db/compliance'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const format = searchParams.get('format') || 'json'

    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null
    const quarter = searchParams.get('quarter') ? parseInt(searchParams.get('quarter')!) : null
    const country = searchParams.get('country') || 'SI'

    const report = await getPackagingReport(year, month, quarter, country)

    if (format === 'csv') {
      const csv = generatePackagingCSV(report)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="packaging-${year}.csv"`,
        },
      })
    }

    return NextResponse.json({ success: true, data: report })
  } catch (error) {
    console.error('Packaging report error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to generate Packaging report' },
      { status: 500 }
    )
  }
}
