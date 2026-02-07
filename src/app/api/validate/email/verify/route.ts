import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
    try {
        const { email, code } = await request.json()

        if (!email || !code) {
            return NextResponse.json({ error: 'Email and code are required' }, { status: 400 })
        }

        const supabase = await createAdminClient()

        const { data, error } = await supabase
            .from('guest_verifications')
            .select('*')
            .eq('email', email)
            .eq('otp_code', code)
            .single()

        if (error || !data) {
            return NextResponse.json({ success: false, error: 'Invalid or expired code' }, { status: 400 })
        }

        // Check expiry
        if (new Date(data.expires_at) < new Date()) {
            return NextResponse.json({ success: false, error: 'Code has expired' }, { status: 400 })
        }

        // Mark as verified
        await supabase
            .from('guest_verifications')
            .update({ verified: true })
            .eq('email', email)

        return NextResponse.json({ success: true, message: 'Email verified successfully' })

    } catch (error) {
        console.error('Email verification error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
