import { NextResponse } from 'next/server'
import { sendSMS } from '@/lib/sms'

export async function POST(request: Request) {
    try {
        const { phone } = await request.json()

        // Basic validation
        if (!phone || phone.length < 8) {
            return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
        }

        // 3. GENERATE & SEND SMS
        const code = Math.floor(100000 + Math.random() * 900000).toString()

        const smsResult = await sendSMS({
            to: phone,
            text: `Tigo Energy: Your verification code is ${code}`
        })

        if (!smsResult.success) {
            console.error('Failed to send production SMS:', smsResult.error)
        }

        return NextResponse.json({
            success: true,
            message: 'Code sent to phone',
            debug_code: process.env.NODE_ENV === 'development' ? code : undefined
        })
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
