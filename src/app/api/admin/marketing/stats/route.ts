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

        // 1. Fetch Abandoned Carts with Customer Info
        const { data: abandonedCarts, error: cartsError } = await supabase
            .from('carts')
            .select('*, customers:user_id(email, first_name, last_name, addresses, marketing_consent)')
            .order('updated_at', { ascending: false })
            .limit(50)

        if (cartsError) throw cartsError

        // 2. Fetch Localization Stats from Orders
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('delivery_country, total, billing_address')
            .not('status', 'eq', 'cancelled')

        if (ordersError) throw ordersError

        // Process localization clusters
        const countryStats: Record<string, { count: number, revenue: number }> = {}
        const cityStats: Record<string, { count: number, country: string }> = {}

        orders?.forEach(order => {
            const country = order.delivery_country || 'Unknown'
            const revenue = Number(order.total) || 0

            // Country clustering
            if (!countryStats[country]) {
                countryStats[country] = { count: 0, revenue: 0 }
            }
            countryStats[country].count++
            countryStats[country].revenue += revenue

            // City clustering
            const city = (order.billing_address as any)?.city || 'Unknown'
            const cityKey = `${city}, ${country}`
            if (!cityStats[cityKey]) {
                cityStats[cityKey] = { count: 0, country }
            }
            cityStats[cityKey].count++
        })

        const topCountries = Object.entries(countryStats)
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .slice(0, 10)
            .map(([name, data]) => ({ name, ...data }))

        const topCities = Object.entries(cityStats)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 10)
            .map(([name, data]) => ({ name, ...data }))

        return NextResponse.json({
            success: true,
            data: {
                abandonedCarts,
                localization: {
                    topCountries,
                    topCities
                }
            }
        })
    } catch (error: any) {
        console.error('Marketing Stats API Error:', error)
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to fetch marketing stats' },
            { status: 500 }
        )
    }
}
