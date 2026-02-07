import { NextResponse } from 'next/server'
import { checkReportingThresholds } from '@/lib/db/compliance'

export async function GET() {
  try {
    const thresholds = await checkReportingThresholds()

    return NextResponse.json({ success: true, data: thresholds })
  } catch (error) {
    console.error('Thresholds check error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to check thresholds' },
      { status: 500 }
    )
  }
}
