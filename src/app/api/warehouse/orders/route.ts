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

    const { data: orders, error } = await supabase
        .from('orders')
        .select('id, order_number, customer_email, company_name, shipping_address, shipping_carrier, shipping_method, packing_slip_url, shipping_label_url, total, currency, warehouse_actions, pickup_payment_proof_required, created_at, order_items(id, product_name, quantity, sku)')
        .in('status', ['processing'])
        .order('created_at', { ascending: true })

    if (error) {
        return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    const allOrders = orders || []
    const pickup = allOrders.filter((o: any) => o.shipping_carrier === 'Personal Pick-up')
    const delivery = allOrders.filter((o: any) => o.shipping_carrier !== 'Personal Pick-up')

    return NextResponse.json({ pickup, delivery, driverName: driver.name })
}
