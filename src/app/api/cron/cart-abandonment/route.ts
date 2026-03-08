import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail, renderTemplate } from '@/lib/email'

export async function GET(req: NextRequest) {
    // Protect the cron endpoint
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createAdminClient()

    // Find carts last updated between 2h and 24h ago with items
    // The 24h upper bound prevents re-sending on repeat runs
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: carts, error } = await supabase
        .from('carts')
        .select('*, customers:user_id(email, first_name, last_name, marketing_consent, preferred_language)')
        .not('user_id', 'is', null)
        .not('items', 'eq', '[]')
        .lte('updated_at', twoHoursAgo)
        .gte('updated_at', twentyFourHoursAgo)

    if (error) {
        console.error('Cart abandonment cron error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let sent = 0
    let skipped = 0

    for (const cart of carts ?? []) {
        const customer = cart.customers as any
        if (!customer?.email || !customer?.marketing_consent) {
            skipped++
            continue
        }

        const items = (cart.items ?? []) as any[]
        if (items.length === 0) { skipped++; continue }

        const cartItemsHtml = items.map((item: any) =>
            `<li>${item.product_name || item.name || item.sku} x${item.quantity}</li>`
        ).join('')

        const locale = customer.preferred_language || 'en'
        const firstName = customer.first_name || ''

        try {
            const html = await renderTemplate('cart-abandonment', {
                name: firstName,
                cart_items: cartItemsHtml,
            }, locale)

            await sendEmail({
                to: customer.email,
                subject: `${firstName ? `${firstName}, your` : 'Your'} cart is waiting`,
                html,
            })
            sent++
        } catch (err) {
            console.error(`Failed to send cart abandonment email to ${customer.email}:`, err)
        }
    }

    return NextResponse.json({ success: true, sent, skipped })
}
