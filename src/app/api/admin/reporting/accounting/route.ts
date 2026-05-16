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
            // Date semantics:
            //   - orders → by created_at (when the order was placed)
            //   - invoices → by invoice_created_at (when the invoice was
            //     actually issued) so an order placed in March but invoiced
            //     in April lands in the April report, not the March one.
            let query = supabase
                .from('orders')
                .select('*')

            if (type === 'invoices') {
                query = query
                    .not('invoice_number', 'is', null)
                    .gte('invoice_created_at', start)
                    .lt('invoice_created_at', endDate)
                    .order('invoice_created_at', { ascending: false })
            } else {
                query = query
                    .gte('created_at', start)
                    .lt('created_at', endDate)
                    .order('created_at', { ascending: false })
            }
            const { data: shopOrders, error } = await query
            if (error) throw error

            // Imported external invoices (manual_invoices) ARE income too —
            // include them in the invoices view, filtered by invoice_date.
            let manualInvoices: any[] = []
            if (type === 'invoices') {
                const startDate = start.slice(0, 10)
                const endDateOnly = endDate.slice(0, 10)
                const { data: mi } = await supabase
                    .from('manual_invoices')
                    .select('id, invoice_number, invoice_date, customer_name, company_name, vat_id, net_amount, vat_amount, total, currency, paid, paid_at, pdf_url, category, region')
                    .gte('invoice_date', startDate)
                    .lt('invoice_date', endDateOnly)
                    .order('invoice_date', { ascending: false })
                manualInvoices = (mi || []).map((m: any) => ({
                    id: m.id,
                    order_number: null,
                    invoice_number: m.invoice_number,
                    invoice_created_at: m.invoice_date,
                    created_at: m.invoice_date,
                    customer_email: null,
                    customer_name: m.customer_name,
                    company_name: m.company_name,
                    vat_id: m.vat_id,
                    subtotal: m.net_amount,
                    vat_amount: m.vat_amount,
                    total: m.total,
                    currency: m.currency || 'EUR',
                    payment_status: m.paid ? 'paid' : 'unpaid',
                    paid_at: m.paid_at,
                    status: 'completed',
                    invoice_url: m.pdf_url,
                    _source: 'manual_invoice' as const,
                    category: m.category,
                    region: m.region,
                }))
            }

            const orders = [...(shopOrders || []), ...manualInvoices].sort(
                (a, b) => new Date(b.invoice_created_at || b.created_at).getTime() - new Date(a.invoice_created_at || a.created_at).getTime()
            )

            const totalRevenue = orders.reduce((sum: number, o: any) => sum + (Number(o.total) || 0), 0)
            const totalInvoices = orders.filter((o: any) => o.invoice_number).length
            const totalOutstanding = orders
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
        } else if (type === 'ddv') {
            // DDV (VAT) report: VAT collected on invoiced orders — what you owe the government
            // Filter by invoice_created_at — DDV is owed in the month the
            // invoice is issued, not the month the order was placed.
            const { data: orders, error } = await supabase
                .from('orders')
                .select('id, order_number, customer_email, company_name, created_at, status, payment_status, invoice_number, invoice_created_at, total, subtotal, vat_amount, vat_rate, shipping_cost, shipping_address, amount_paid, payment_terms, payment_due_date')
                .not('invoice_number', 'is', null)
                .gte('invoice_created_at', start)
                .lt('invoice_created_at', endDate)
                .order('invoice_created_at', { ascending: false })

            if (error) throw error

            // Also include imported manual invoices — they carry VAT too.
            const startDate = start.slice(0, 10)
            const endDateOnly = endDate.slice(0, 10)
            const { data: mi } = await supabase
                .from('manual_invoices')
                .select('id, invoice_number, invoice_date, customer_name, company_name, vat_id, net_amount, vat_amount, total, currency, paid, paid_at')
                .gte('invoice_date', startDate)
                .lt('invoice_date', endDateOnly)
                .order('invoice_date', { ascending: false })

            const manualAsOrders = (mi || []).map((m: any) => {
                const net = Number(m.net_amount) || 0
                const vat = Number(m.vat_amount) || 0
                // Derive vat_rate from amounts (manual invoices don't carry a rate field)
                const derivedRate = net > 0 ? Math.round((vat / net) * 100) : 0
                return {
                    id: m.id,
                    order_number: null,
                    invoice_number: m.invoice_number,
                    invoice_created_at: m.invoice_date,
                    created_at: m.invoice_date,
                    customer_email: null,
                    company_name: m.company_name || m.customer_name,
                    subtotal: net,
                    vat_amount: vat,
                    total: Number(m.total) || (net + vat),
                    vat_rate: derivedRate,
                    payment_status: m.paid ? 'paid' : 'unpaid',
                    amount_paid: m.paid ? (Number(m.total) || 0) : 0,
                    status: 'completed',
                    _source: 'manual_invoice' as const,
                }
            })

            const combined = [...(orders || []), ...manualAsOrders]

            // Group by VAT rate
            const byRate: Record<number, { count: number; subtotal: number; vat: number; total: number }> = {}
            let totalVat = 0
            let totalSubtotal = 0
            let totalGross = 0
            let totalPaid = 0
            let totalOutstanding = 0

            for (const o of combined) {
                const rawRate = Number(o.vat_rate) || 0
                const rate = rawRate < 1 ? Math.round(rawRate * 100) : rawRate
                if (!byRate[rate]) byRate[rate] = { count: 0, subtotal: 0, vat: 0, total: 0 }
                byRate[rate].count++
                byRate[rate].subtotal += Number(o.subtotal) || 0
                byRate[rate].vat += Number(o.vat_amount) || 0
                byRate[rate].total += Number(o.total) || 0
                totalVat += Number(o.vat_amount) || 0
                totalSubtotal += Number(o.subtotal) || 0
                totalGross += Number(o.total) || 0
                totalPaid += Number(o.amount_paid) || 0
                if (o.payment_status !== 'paid' && o.status !== 'cancelled') {
                    totalOutstanding += Number(o.total) || 0
                }
            }

            resultData = {
                orders: combined,
                summary: {
                    totalVat,
                    totalSubtotal,
                    totalGross,
                    totalPaid,
                    totalOutstanding,
                    invoiceCount: combined.length,
                    byRate: Object.entries(byRate)
                        .sort(([a], [b]) => Number(b) - Number(a))
                        .map(([rate, data]) => ({ rate: Number(rate), ...data })),
                }
            }
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
