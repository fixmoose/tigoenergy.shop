import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient()

        // Auth Check
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || user.user_metadata?.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const year = searchParams.get('year') || new Date().getFullYear().toString()
        const month = searchParams.get('month') // optional month (1-12)
        const type = searchParams.get('type') || 'orders'

        let resultData: any = {}

        const start = month
            ? `${year}-${month.padStart(2, '0')}-01T00:00:00Z`
            : `${year}-01-01T00:00:00Z`

        const nextMonthYear = month && parseInt(month) === 12 ? parseInt(year) + 1 : parseInt(year)
        const nextMonth = month && parseInt(month) < 12 ? parseInt(month) + 1 : 1

        const endDate = month
            ? `${nextMonthYear}-${nextMonth.toString().padStart(2, '0')}-01T00:00:00Z`
            : `${parseInt(year) + 1}-01-01T00:00:00Z`

        if (type === 'orders' || type === 'invoices') {
            let query = supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false })

            if (type === 'invoices') {
                query = query.not('invoice_number', 'is', null)
            }

            query = query.gte('created_at', start).lt('created_at', endDate)
            const { data: orders, error } = await query
            if (error) throw error

            const totalRevenue = (orders || []).reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0)
            const totalInvoices = (orders || []).filter((o: any) => o.invoice_number).length
            const totalOutstanding = (orders || [])
                .filter((o: any) => o.payment_status !== 'paid' && o.status !== 'cancelled')
                .reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0)

            resultData = {
                orders,
                summary: { totalRevenue, totalInvoices, totalOutstanding }
            }
        } else if (type === 'returns') {
            const { data: records, error } = await supabase
                .from('order_returns')
                .select('*, orders(order_number, customer_email)')
                .gte('created_at', start)
                .lt('created_at', endDate)
                .order('created_at', { ascending: false })

            if (error) throw error
            resultData = { records }
        } else if (type === 'carts') {
            const { data: records, error } = await supabase
                .from('carts')
                .select('*, customers:user_id(email, first_name, last_name, addresses, marketing_consent)')
                .gte('updated_at', start)
                .lt('updated_at', endDate)
                .order('updated_at', { ascending: false })

            if (error) throw error
            resultData = { records }
        } else if (type === 'customers') {
            const { data: records, error } = await supabase
                .from('customers')
                .select('*, orders(count)') // This is a simplified fetch
                .order('created_at', { ascending: false })

            if (error) throw error
            resultData = { records }
        } else if (type === 'stock') {
            const { data: records, error } = await supabase
                .from('products')
                .select('*')
                .order('stock_level', { ascending: true })

            if (error) throw error
            resultData = { records }
        }

        return NextResponse.json({
            success: true,
            data: resultData
        })
    } catch (error: any) {
        console.error('Accounting API Error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to fetch accounting data' },
            { status: 500 }
        )
    }
}
