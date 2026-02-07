import { NextResponse } from 'next/server'
import { sendSMS } from '@/lib/sms'

export async function POST(request: Request) {
    try {
        const { phone } = await request.json()

        // Basic validation
        if (!phone || phone.length < 8) {
            return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
        }

        // 3. GENERATE CODE
        const code = Math.floor(100000 + Math.random() * 900000).toString()
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 mins

        // 4. STORE IN DATABASE
        const { createAdminClient } = await import('@/lib/supabase/server')
        const supabase = await createAdminClient()

        await supabase.from('phone_verifications').delete().eq('phone', phone)
        const { error: dbError } = await supabase.from('phone_verifications').insert({
            phone,
            otp_code: code,
            expires_at: expiresAt,
            verified: false
        })

        if (dbError) {
            console.error('Database error storing verification code:', dbError)
            return NextResponse.json({ error: 'Failed to generate verification code' }, { status: 500 })
        }

        // 5. SEND SMS
        const smsResult = await sendSMS({
            to: phone,
            text: `Tigo Energy: Your verification code is ${code}`
        })

        if (!smsResult.success) {
            console.error('Failed to send production SMS:', smsResult.error)
            if (process.env.NODE_ENV === 'production') {
                return NextResponse.json({ error: 'Failed to send verification SMS' }, { status: 503 })
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Code sent to phone'
        })
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
