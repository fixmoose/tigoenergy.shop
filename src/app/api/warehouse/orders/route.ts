import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

async function validateWarehouseEmail(supabase: any, email: string) {
    const { data: driver } = await supabase
        .from('drivers')
        .select('id, name, email')
        .eq('email', email)
        .eq('is_warehouse', true)
        .single()
    return driver
}

export async function GET(req: NextRequest) {
    const email = req.nextUrl.searchParams.get('email')
    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 })

    const supabase = await createAdminClient()
    const driver = await validateWarehouseEmail(supabase, email)
    if (!driver) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const selectFields = 'id, order_number, customer_email, company_name, shipping_address, shipping_carrier, shipping_method, packing_slip_url, shipping_label_url, total, currency, warehouse_actions, pickup_payment_proof_required, created_at, status, order_items(id, product_name, quantity, sku)'

    // Active orders (processing)
    const { data: orders, error } = await supabase
        .from('orders')
        .select(selectFields)
        .in('status', ['processing'])
        .order('created_at', { ascending: true })

    if (error) {
        return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    // Recently completed orders (shipped/delivered/completed) with pagination
    const completedDays = parseInt(req.nextUrl.searchParams.get('completed_days') || '30') || 30
    const completedOffset = parseInt(req.nextUrl.searchParams.get('completed_offset') || '0') || 0
    const completedLimit = parseInt(req.nextUrl.searchParams.get('completed_limit') || '20') || 20
    const cutoff = new Date(Date.now() - completedDays * 24 * 60 * 60 * 1000).toISOString()

    const { data: completedOrders, count: completedTotal } = await supabase
        .from('orders')
        .select(selectFields, { count: 'exact' })
        .in('status', ['shipped', 'delivered', 'completed'])
        .gte('updated_at', cutoff)
        .not('warehouse_actions', 'eq', '[]')
        .order('updated_at', { ascending: false })
        .range(completedOffset, completedOffset + completedLimit - 1)

    const allOrders = orders || []
    const pickup = allOrders.filter((o: any) => o.shipping_carrier === 'Personal Pick-up')
    const delivery = allOrders.filter((o: any) => o.shipping_carrier !== 'Personal Pick-up')

    return NextResponse.json({
        pickup,
        delivery,
        completed: completedOrders || [],
        completedTotal: completedTotal || 0,
        driverName: driver.name,
    })
}
