import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/quick-order
 * Returns ALL active products categorized for the quick-order catalog.
 * Categories: optimizers (MLPE), inverters, communicators, and everything else.
 * Sorted: optimizers first, then inverters (15kw/10kw first), then communicators, then rest by stock.
 */
export async function GET() {
    const supabase = await createClient()

    // Fetch ALL active products
    const { data: products, error } = await supabase
        .from('products')
        .select('id, sku, name_en, name_sl, name_de, category, subcategory, price_eur, b2b_price_eur, weight_kg, stock_quantity, reserved_quantity, stock_status, images, units_per_box, quantity_discounts')
        .eq('active', true)
        .order('stock_quantity', { ascending: false, nullsFirst: false })

    if (error) {
        console.error('Quick order products fetch error:', error)
        return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }

    const all = products || []

    // Classify products
    function isOptimizer(p: any): boolean {
        const combined = ((p.sku || '') + ' ' + (p.name_en || '')).toUpperCase()
        return /TS4.?A.?O/i.test(combined) ||
               /TS4.?A.?F/i.test(combined) ||
               /TS4.?X.?O/i.test(combined) ||
               /TS4.?A.?2F/i.test(combined)
    }

    function isInverter(p: any): boolean {
        const cat = (p.category || '').toUpperCase()
        const sub = (p.subcategory || '').toUpperCase()
        return cat.includes('EI') || sub.includes('INVERTER')
    }

    function isCommunicator(p: any): boolean {
        const combined = ((p.sku || '') + ' ' + (p.name_en || '') + ' ' + (p.category || '') + ' ' + (p.subcategory || '')).toUpperCase()
        return combined.includes('CCA') || combined.includes('RSS') ||
               combined.includes('CLOUD CONNECT') || combined.includes('ACCESS POINT') ||
               combined.includes('COMMUNICATION') || combined.includes('DATA LOGGER')
    }

    const optimizers = all.filter((p: any) => isOptimizer(p))
    const inverters = all.filter((p: any) => isInverter(p) && !isOptimizer(p))
    const communicators = all.filter((p: any) => isCommunicator(p) && !isOptimizer(p) && !isInverter(p))

    const categorized = new Set([...optimizers, ...inverters, ...communicators].map((p: any) => p.id))
    const other = all.filter((p: any) => !categorized.has(p.id))

    // Sort inverters: 15kw first, then 10kw, then rest
    inverters.sort((a: any, b: any) => {
        const nameA = ((a.name_en || '') + ' ' + (a.sku || '')).toUpperCase()
        const nameB = ((b.name_en || '') + ' ' + (b.sku || '')).toUpperCase()
        const is15A = nameA.includes('15K') ? 0 : nameA.includes('10K') ? 1 : 2
        const is15B = nameB.includes('15K') ? 0 : nameB.includes('10K') ? 1 : 2
        return is15A - is15B
    })

    return NextResponse.json({
        optimizers,
        inverters,
        communicators,
        other,
    })
}
