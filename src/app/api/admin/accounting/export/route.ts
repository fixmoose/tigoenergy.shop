import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { buildMonthlyBundle } from '@/lib/monthly-bundle'

// Same monthly PDF bundle Sonja gets at /racunovodstvo, available to admin
// via cookie auth. Bundle covers both directions (issued + received) for the
// requested year+month.
export const maxDuration = 300

export async function GET(req: NextRequest) {
    const cookieStore = await cookies()
    if (cookieStore.get('tigo-admin')?.value !== '1') {
        return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const year = searchParams.get('year') || new Date().getFullYear().toString()
    const month = searchParams.get('month')
    if (!month) return NextResponse.json({ error: 'Month required' }, { status: 400 })

    const supabase = await createAdminClient()
    const { pdfBytes, filename } = await buildMonthlyBundle(supabase, year, month)

    return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
        }
    })
}
