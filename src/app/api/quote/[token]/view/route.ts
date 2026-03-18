import { NextRequest, NextResponse } from 'next/server'
import { getQuoteByTokenAction } from '@/app/actions/quotes'

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params
    const result = await getQuoteByTokenAction(token)
    if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: result.data })
}
