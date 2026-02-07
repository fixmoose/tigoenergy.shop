import { NextRequest, NextResponse } from 'next/server'
import { getComplianceDashboard, getReportingCalendar } from '@/lib/db/compliance'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const view = searchParams.get('view') || 'summary'
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined

    if (view === 'calendar') {
      const calendar = await getReportingCalendar(year)
      return NextResponse.json({ success: true, data: calendar })
    }

    const dashboard = await getComplianceDashboard()
    return NextResponse.json({ success: true, data: dashboard })
  } catch (error) {
    console.error('Dashboard error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load dashboard' },
      { status: 500 }
    )
  }
}
