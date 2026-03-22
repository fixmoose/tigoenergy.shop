import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/stock-check
 * Body: { productIds: string[] }
 * Returns stock availability for given product IDs.
 */
export async function POST(req: NextRequest) {
    const { productIds } = await req.json()

    if (!Array.isArray(productIds) || productIds.length === 0) {
        return NextResponse.json({ products: [] })
    }

    const supabase = await createClient()
    const { data: products, error } = await supabase
        .from('products')
        .select('id, sku, name_en, stock_quantity, reserved_quantity, stock_status')
        .in('id', productIds)

    if (error) {
        return NextResponse.json({ products: [] })
    }

    const result = (products || []).map((p: any) => ({
        id: p.id,
        sku: p.sku,
        name: p.name_en,
        available: p.stock_status === 'out_of_stock' ? 0
            : p.stock_status === 'available_to_order' ? 999999
            : Math.max(0, (p.stock_quantity || 0) - (p.reserved_quantity || 0)),
        stock_status: p.stock_status,
    }))

    return NextResponse.json({ products: result })
}
