import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/quick-order
 * Returns the quick-order product catalog: optimizers (A-O, A-F, X-O, A-2F) + accessories (CCA, RSS).
 * Includes stock status and pricing for the authenticated user.
 */
export async function GET() {
    const supabase = await createClient()

    // Fetch optimizer and accessory products by SKU pattern
    const { data: products, error } = await supabase
        .from('products')
        .select('id, sku, name_en, name_sl, name_de, category, subcategory, price_eur, b2b_price_eur, weight_kg, stock_quantity, reserved_quantity, stock_status, images, units_per_box, quantity_discounts')
        .eq('active', true)
        .or('sku.ilike.%TS4-A-O%,sku.ilike.%TS4-A-F%,sku.ilike.%TS4-X-O%,sku.ilike.%TS4-A-2F%,sku.ilike.%CCA%,sku.ilike.%RSS%')
        .order('sku', { ascending: true })

    if (error) {
        console.error('Quick order products fetch error:', error)
        return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }

    // Classify products
    const optimizers = (products || []).filter((p: any) => {
        const sku = (p.sku as string).toUpperCase()
        return sku.includes('TS4-A-O') || sku.includes('TS4-A-F') || sku.includes('TS4-X-O') || sku.includes('TS4-A-2F')
    })

    const accessories = (products || []).filter((p: any) => {
        const sku = (p.sku as string).toUpperCase()
        return sku.includes('CCA') || sku.includes('RSS')
    })

    return NextResponse.json({ optimizers, accessories })
}
