import { NextRequest, NextResponse } from 'next/server'
import { getIntrastatReport, saveIntrastatReport, generateIntrastatCSV, generateIntrastatXML } from '@/lib/db/compliance'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString())
    const format = searchParams.get('format') || 'json'

    if (month < 1 || month > 12) {
      return NextResponse.json(
        { success: false, error: 'Month must be between 1 and 12' },
        { status: 400 }
      )
    }

    const report = await getIntrastatReport(year, month)

    if (format === 'csv') {
      const csv = generateIntrastatCSV(report)
      const monthName = new Date(year, month - 1).toLocaleString('en', { month: 'short' }).toLowerCase()
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="intrastat-${monthName}-${year}.csv"`,
        },
      })
    }

    if (format === 'xml') {
      const xml = await generateIntrastatXML(year, month)
      const monthPad = month.toString().padStart(2, '0')
      return new NextResponse(xml, {
        headers: {
          'Content-Type': 'application/xml',
          'Content-Disposition': `attachment; filename="INSTAT_${year}${monthPad}.xml"`,
        },
      })
    }

    return NextResponse.json({ success: true, data: report })
  } catch (error) {
    console.error('Intrastat report error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to generate Intrastat report' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { year, month } = body

    if (!year || !month) {
      return NextResponse.json(
        { success: false, error: 'Year and month are required' },
        { status: 400 }
      )
    }

    const rowsSaved = await saveIntrastatReport(year, month)

    return NextResponse.json({
      success: true,
      data: { rowsSaved },
      message: `Saved ${rowsSaved} Intrastat records for ${month}/${year}`,
    })
  } catch (error) {
    console.error('Intrastat save error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to save Intrastat report' },
      { status: 500 }
    )
  }
}
