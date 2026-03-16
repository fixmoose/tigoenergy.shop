import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
    const driverEmail = req.nextUrl.searchParams.get('email')
    if (!driverEmail) {
        return NextResponse.json({ error: 'Missing email' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    const { data: tokens, error } = await supabase
        .from('delivery_tokens')
        .select('*, orders(order_number, customer_email, company_name, shipping_address, total, currency, status)')
        .eq('driver_email', driverEmail)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })

    if (error) {
        return NextResponse.json({ error: 'Failed to fetch deliveries' }, { status: 500 })
    }

    return NextResponse.json({ deliveries: tokens || [] })
}
