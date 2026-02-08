import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
    try {
        const supabase = await createAdminClient()

        // Check if admin
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.user_metadata?.role !== 'admin') {
            // Master Admin check
            if (user?.email !== 'dejan@haywilson.com') {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            }
        }

        const body = await req.json()
        const { customer_email, order_number, status, total, market, transaction_type } = body

        const { data, error } = await supabase
            .from('orders')
            .insert({
                customer_email,
                order_number: order_number || `MAN-${Date.now()}`,
                status: status || 'pending',
                total,
                market,
                transaction_type: transaction_type || 'domestic',
                created_at: new Date().toISOString(),
                payment_status: 'pending',
                language: 'en', // default
                subtotal: total, // simplified
                vat_amount: 0,
                vat_rate: 0,
                shipping_cost: 0
            })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, order: data })
    } catch (err: any) {
        console.error('API Error:', err)
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
