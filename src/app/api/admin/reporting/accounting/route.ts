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
        } else if (type === 'margin') {
            // Margin report: fetch orders with items + product cost data
            // We compute margin = sold price - purchase cost (no shipping)
            // Segmented: invoiced (actual), confirmed (processing+shipped+delivered), all non-cancelled

            const { data: orders, error } = await supabase
                .from('orders')
                .select('id, order_number, customer_email, company_name, created_at, status, payment_status, invoice_number, invoice_created_at, total, subtotal, vat_amount, shipping_cost, order_items(product_id, sku, product_name, quantity, unit_price, unit_cost, total_price)')
                .neq('status', 'cancelled')
                .gte('created_at', start)
                .lt('created_at', endDate)
                .order('created_at', { ascending: false })

            if (error) throw error

            // Fetch product cost data for items that don't have unit_cost on the order item
            const allProductIds = new Set<string>()
            for (const order of (orders || [])) {
                for (const item of (order.order_items || [])) {
                    if (item.product_id && !item.unit_cost) allProductIds.add(item.product_id)
                }
            }

            let productCosts: Record<string, number> = {}
            if (allProductIds.size > 0) {
                const { data: products } = await supabase
                    .from('products')
                    .select('id, cost_eur')
                    .in('id', Array.from(allProductIds))
                if (products) {
                    productCosts = Object.fromEntries(products.map((p: any) => [p.id, p.cost_eur || 0]))
                }
            }

            // Calculate margin per order
            const orderMargins = (orders || []).map((order: any) => {
                let totalRevenue = 0
                let totalCost = 0
                for (const item of (order.order_items || [])) {
                    const revenue = (item.unit_price || 0) * (item.quantity || 0)
                    const costPerUnit = item.unit_cost || (item.product_id ? (productCosts[item.product_id] || 0) : 0)
                    const cost = costPerUnit * (item.quantity || 0)
                    totalRevenue += revenue
                    totalCost += cost
                }
                const margin = totalRevenue - totalCost
                return {
                    id: order.id,
                    order_number: order.order_number,
                    customer_email: order.customer_email,
                    company_name: order.company_name,
                    created_at: order.created_at,
                    status: order.status,
                    payment_status: order.payment_status,
                    invoice_number: order.invoice_number,
                    invoice_created_at: order.invoice_created_at,
                    total: order.total,
                    subtotal: order.subtotal,
                    revenue: totalRevenue,
                    cost: totalCost,
                    margin,
                    margin_pct: totalRevenue > 0 ? (margin / totalRevenue) * 100 : 0,
                }
            })

            // Segment summaries
            const invoiced = orderMargins.filter((o: any) => o.invoice_number)
            const confirmed = orderMargins.filter((o: any) => ['processing', 'shipped', 'delivered', 'completed'].includes(o.status))
            const all = orderMargins

            const summarize = (arr: any[]) => ({
                count: arr.length,
                revenue: arr.reduce((s, o) => s + o.revenue, 0),
                cost: arr.reduce((s, o) => s + o.cost, 0),
                margin: arr.reduce((s, o) => s + o.margin, 0),
                margin_pct: arr.reduce((s, o) => s + o.revenue, 0) > 0
                    ? (arr.reduce((s, o) => s + o.margin, 0) / arr.reduce((s, o) => s + o.revenue, 0)) * 100
                    : 0,
            })

            resultData = {
                orders: orderMargins,
                summary: {
                    invoiced: summarize(invoiced),
                    confirmed: summarize(confirmed),
                    all: summarize(all),
                }
            }
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
