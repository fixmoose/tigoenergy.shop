import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
    const { token, email } = await req.json()

    if (!token || !email) return NextResponse.json({ success: false, error: 'Data missing' }, { status: 400 })

    const supabase = await createClient()

    const { data, error } = await supabase
        .from('accounting_share_links')
        .select('*')
        .eq('token', token)
        .eq('allowed_email', email.toLowerCase().trim())
        .gt('expires_at', new Date().toISOString())
        .single()

    if (error || !data) {
        return NextResponse.json({ success: false, error: 'Authorization failed. Check your email or contact the administrator.' }, { status: 403 })
    }

    return NextResponse.json({ success: true })
}
