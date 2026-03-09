import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await createAdminClient()

    const [
        { data: customer },
        { data: orders },
        { data: orderItems },
        { data: supportRequests },
        { data: newsletterSub },
    ] = await Promise.all([
        admin.from('customers').select('*').eq('id', user.id).single(),
        admin.from('orders').select('id, order_number, invoice_number, created_at, status, payment_status, total, currency, payment_method, shipping_address, billing_address, company_name, vat_id').eq('customer_id', user.id).order('created_at', { ascending: false }),
        admin.from('order_items').select('order_id, product_name, sku, quantity, unit_price, vat_rate').in('order_id', []),  // filled below
        admin.from('support_requests').select('id, type, subject, message, status, created_at').eq('customer_id', user.id),
        admin.from('newsletter_subscribers').select('email, status, source, confirmed_at, unsubscribed_at').eq('email', user.email!).maybeSingle(),
    ])

    // Fetch order items for all orders
    const orderIds = (orders ?? []).map(o => o.id)
    const { data: items } = orderIds.length > 0
        ? await admin.from('order_items').select('order_id, product_name, sku, quantity, unit_price, vat_rate').in('order_id', orderIds)
        : { data: [] }

    const itemsByOrder: Record<string, any[]> = {}
    for (const item of items ?? []) {
        if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = []
        itemsByOrder[item.order_id].push(item)
    }

    const exportData = {
        export_date: new Date().toISOString(),
        gdpr_note: 'This is your personal data export as required by GDPR Article 15 (Right of Access) and Article 20 (Right to Data Portability). You may contact us at privacy@tigoenergy.com with any questions.',

        profile: {
            id: user.id,
            email: user.email,
            email_confirmed_at: user.email_confirmed_at,
            created_at: user.created_at,
            last_sign_in_at: user.last_sign_in_at,
            first_name: customer?.first_name,
            last_name: customer?.last_name,
            phone: customer?.phone,
            company_name: customer?.company_name,
            vat_id: customer?.vat_id,
            customer_type: customer?.customer_type,
            account_status: customer?.account_status,
            newsletter_subscribed: customer?.newsletter_subscribed,
            marketing_consent: customer?.marketing_consent,
            preferred_language: customer?.preferred_language,
            addresses: customer?.addresses ?? [],
        },

        orders: (orders ?? []).map(o => ({
            ...o,
            items: itemsByOrder[o.id] ?? [],
        })),

        support_requests: supportRequests ?? [],

        newsletter: newsletterSub ?? { email: user.email, status: 'not subscribed' },
    }

    const filename = `tigo-energy-data-export-${user.id.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`

    return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Cache-Control': 'no-store',
        },
    })
}
