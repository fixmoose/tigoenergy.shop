
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const { phone } = await request.json()

        // Basic validation
        if (!phone || phone.length < 8) {
            return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
        }

        // SIMULATE SMS
        const code = Math.floor(100000 + Math.random() * 900000).toString()
        console.log(`[MOCK SMS] Sending code ${code} to ${phone}`)

        return NextResponse.json({
            success: true,
            message: 'Code sent to phone',
            debug_code: code
        })
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
