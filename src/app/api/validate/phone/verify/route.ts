import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
    try {
        const { phone, code } = await request.json()

        if (!phone || !code) {
            return NextResponse.json({ error: 'Phone and code are required' }, { status: 400 })
        }

        const supabase = await createAdminClient()

        const { data, error } = await supabase
            .from('phone_verifications')
            .select('*')
            .eq('phone', phone)
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
            .from('phone_verifications')
            .update({ verified: true })
            .eq('phone', phone)

        return NextResponse.json({ success: true, message: 'Phone verified successfully' })

    } catch (error) {
        console.error('Phone verification error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
