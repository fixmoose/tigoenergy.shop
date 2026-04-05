import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '../../../../../lib/supabase/server'
import { cookies } from 'next/headers'
import { generateInvoicePdf } from '../../../../../lib/invoice-pdf'

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    // Check if admin cookie or accountant token
    const cookieStore = await cookies()
    const isAdminCookie = cookieStore.get('tigo-admin')?.value === '1'
    const isAccountant = req.nextUrl.searchParams.get('accountant_key') === '123456'

    const supabase = (isAdminCookie || isAccountant) ? await createAdminClient() : await createClient()

    // 1. Fetch Order with Items
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', id)
        .single()

    if (orderError || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // 2. Security Check (Only owner, admin, or accountant)
    if (!isAdminCookie && !isAccountant) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        if (order.customer_email !== user.email) {
            const isAdmin = user.email?.endsWith('@tigoenergy.com') || user.user_metadata?.role === 'admin'
            if (!isAdmin) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }
        }
    }

    try {
        const pdfBuffer = await generateInvoicePdf(order, supabase)

        return new NextResponse(Buffer.from(pdfBuffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=Racun_${order.order_number}.pdf`,
                'Cache-Control': 'no-cache'
            },
        })
    } catch (err) {
        console.error('PDF Generation Error:', err)
        return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
    }
}
