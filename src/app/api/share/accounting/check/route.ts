import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')

    if (!token) return NextResponse.json({ success: false, error: 'Token missing' }, { status: 400 })

    const supabase = await createClient()

    const { data, error } = await supabase
        .from('accounting_share_links')
        .select('*')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .single()

    if (error || !data) {
        return NextResponse.json({ success: false, error: 'invalid_link' }, { status: 404 })
    }

    return NextResponse.json({
        success: true,
        data: {
            year: data.year,
            month: data.month
        }
    })
}
