import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'
import { renderToStream } from '@react-pdf/renderer'
import { InvoiceDocument } from '../../../../../components/orders/InvoiceDocument'
import React from 'react'

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createClient()

    // 1. Fetch Order
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single()

    if (orderError || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // 2. Security Check (Only owner or admin)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch customer record to check terms_agreed_at and ownership
    const { data: customer } = await supabase
        .from('customers')
        .select('id, terms_agreed_at, email')
        .eq('email', order.customer_email)
        .single()

    // Basic ownership check (if not admin, email must match)
    // Note: For a real app, you'd check roles here too.
    if (order.customer_email !== user.email) {
        // Check if they are admin (simplified check)
        const isAdmin = user.email?.endsWith('@tigoenergy.com') || user.user_metadata?.role === 'admin'
        if (!isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
    }

    // 3. Fetch Items
    const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', id)

    if (itemsError || !items) {
        return NextResponse.json({ error: 'Order items not found' }, { status: 404 })
    }

    try {
        // 4. Render PDF to stream
        // We pass terms_agreed_at from the customer record
        const stream = (await renderToStream(
            <InvoiceDocument
                order={order as any}
                items={items as any}
                termsAgreedAt={customer?.terms_agreed_at}
                language={order.language || 'en'}
            />
        )) as any

        // 5. Return stream as response
        return new NextResponse(stream as any, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=Invoice_${order.order_number}.pdf`,
            },
        })
    } catch (err) {
        console.error('PDF Generation Error:', err)
        return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
    }
}
