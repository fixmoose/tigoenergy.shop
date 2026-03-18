import { NextRequest, NextResponse } from 'next/server'
import { acceptQuoteAction } from '@/app/actions/quotes'

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    try {
        const { token } = await params
        const body = await req.json()

        const { type, address } = body

        if (!type || !['shipping', 'pickup'].includes(type)) {
            return NextResponse.json({ success: false, error: 'Invalid delivery type' }, { status: 400 })
        }

        if (type === 'shipping' && (!address?.street || !address?.city || !address?.postal_code)) {
            return NextResponse.json({ success: false, error: 'Address is required for shipping' }, { status: 400 })
        }

        const result = await acceptQuoteAction(token, {
            type,
            address: type === 'shipping' ? address : undefined,
        })

        if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 400 })
        }

        return NextResponse.json({ success: true, orderId: result.orderId, orderNumber: result.orderNumber })
    } catch (err: any) {
        console.error('Quote accept error:', err)
        return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 })
    }
}
