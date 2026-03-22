import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/quick-order
 * Returns the quick-order product catalog: optimizers (A-O, A-F, X-O, A-2F) + accessories (CCA, RSS).
 * Matches both SKU patterns (TS4-AO, TS4-A-O) and name patterns.
 */
export async function GET() {
    const supabase = await createClient()

    // Fetch from TS4 FLEX MLPE + TS4-X MLPE + COMMUNICATIONS categories
    // This is broader than SKU matching and catches all relevant products
    const { data: products, error } = await supabase
        .from('products')
        .select('id, sku, name_en, name_sl, name_de, category, subcategory, price_eur, b2b_price_eur, weight_kg, stock_quantity, reserved_quantity, stock_status, images, units_per_box, quantity_discounts')
        .eq('active', true)
        .or('category.ilike.%TS4%MLPE%,sku.ilike.%CCA%,sku.ilike.%RSS%,name_en.ilike.%CCA%,name_en.ilike.%RSS%')
        .order('sku', { ascending: true })

    if (error) {
        console.error('Quick order products fetch error:', error)
        return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }

    // Classify by checking both SKU and name
    function isOptimizer(p: any): boolean {
        const sku = (p.sku || '').toUpperCase()
        const name = (p.name_en || '').toUpperCase()
        const combined = sku + ' ' + name
        // Match TS4-A-O, TS4-AO, TS4-A-F, TS4-AF, TS4-X-O, TS4-XO, TS4-A-2F, TS4-A2F
        return /TS4.?A.?O/i.test(combined) ||
               /TS4.?A.?F/i.test(combined) ||
               /TS4.?X.?O/i.test(combined) ||
               /TS4.?A.?2F/i.test(combined)
    }

    function isAccessory(p: any): boolean {
        const sku = (p.sku || '').toUpperCase()
        const name = (p.name_en || '').toUpperCase()
        return sku.includes('CCA') || sku.includes('RSS') ||
               name.includes('CCA') || name.includes('RSS')
    }

    const optimizers = (products || []).filter((p: any) => isOptimizer(p))
    const accessories = (products || []).filter((p: any) => isAccessory(p))

    return NextResponse.json({
        optimizers,
        accessories,
        debug: { total: (products || []).length, optimizerCount: optimizers.length, accessoryCount: accessories.length }
    })
}
