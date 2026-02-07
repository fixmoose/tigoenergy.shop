import { NextRequest, NextResponse } from 'next/server'
import { getOSSReport, generateOSSXML } from '@/lib/db/compliance'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const quarter = parseInt(searchParams.get('quarter') || Math.ceil((new Date().getMonth() + 1) / 3).toString())
    const format = searchParams.get('format') || 'json'

    if (quarter < 1 || quarter > 4) {
      return NextResponse.json(
        { success: false, error: 'Quarter must be between 1 and 4' },
        { status: 400 }
      )
    }

    const report = await getOSSReport(year, quarter)

    if (format === 'xml') {
      const xml = generateOSSXML(report)
      return new NextResponse(xml, {
        headers: {
          'Content-Type': 'application/xml',
          'Content-Disposition': `attachment; filename="oss-q${quarter}-${year}.xml"`,
        },
      })
    }

    return NextResponse.json({ success: true, data: report })
  } catch (error) {
    console.error('OSS report error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to generate OSS report' },
      { status: 500 }
    )
  }
}
