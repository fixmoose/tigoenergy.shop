import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getMarketFromKey } from '@/lib/constants/markets'

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() || ''

    if (q.length < 3) {
        return NextResponse.json({ suggestions: [] })
    }

    // Resolve language from market
    const headersList = await headers()
    const marketKey = headersList.get('x-market-key') || 'SHOP'
    const market = getMarketFromKey(marketKey)
    const lang = market.defaultLanguage
    const nameCol = `name_${lang}`
    const descCol = `description_${lang}`

    const supabase = await createClient()

    // Build search filter — always search English + localized columns
    const filters = [`name_en.ilike.%${q}%,description_en.ilike.%${q}%,sku.ilike.%${q}%,category.ilike.%${q}%`]
    if (lang !== 'en') {
        filters[0] += `,${nameCol}.ilike.%${q}%,${descCol}.ilike.%${q}%`
    }

    // Select both English and localized name columns
    const selectCols = `id, name_en, ${lang !== 'en' ? `${nameCol},` : ''} slug, images, stock_quantity, stock_status, sku, description_en`

    const { data: products, error } = await supabase
        .from('products')
        .select(selectCols)
        .or(filters[0])
        .eq('active', true)
        .limit(50)

    if (error) {
        return NextResponse.json({ suggestions: [] })
    }

    // 2. Ranking Logic
    // User Rule: "If customer writes 'optimiz' you will give him the first A-O in stock as first option to suggest, second X-O that is in stock..then continue to A-O and X-O based by stock level."

    const qLower = q.toLowerCase()
    const isOptimizerSearch = qLower.includes('optimiz')

    const ranked = (products as any[]).map((p: any) => {
        let score = 0
        const localizedName = (lang !== 'en' && p[nameCol]) ? p[nameCol] : p.name_en
        const name = (localizedName || '').toLowerCase()
        const sku = (p.sku || '').toLowerCase()
        const description = (p.description_en || '').toLowerCase()
        const category = (p.category || '').toLowerCase()
        const stock = p.stock_quantity ?? 0

        // --- SCORING RULES ---

        // 1. Optimizer Special Rule
        if (isOptimizerSearch) {
            if (name.includes('a-o') || sku.includes('a-o')) score += 2000
            else if (name.includes('x-o') || sku.includes('x-o')) score += 1000

            // Bonus for being the "first" in stock (highest stock gets minor boost later)
            // but purely being "type A-O" is the main factor.
        } else {
            // General Relevance
            if (name.startsWith(qLower)) score += 100
            else if (name.includes(qLower)) score += 50

            if (sku.includes(qLower)) score += 45

            if (category.includes(qLower)) score += 40

            // Description is lowest priority (avoids "works with battery" matching "battery" over actual battery)
            if (description.includes(qLower)) score += 5
        }

        // 2. Stock Bonus (Tie Breaker)
        // We want In-Stock items to float up IF relevance is effectively Equal
        if (stock > 0) score += 2

        // 3. Stock Magnitude (very minor tie breaker)
        // Add fractional score based on stock count to sort by quantity within same tier
        score += Math.min(stock, 100) / 1000

        return { ...p, score }
    }).sort((a, b) => b.score - a.score) // Descending Output

    // 3. Limit and Format
    const suggestions = ranked.slice(0, 10).map(p => ({
        name: (lang !== 'en' && p[nameCol]) ? p[nameCol] : p.name_en,
        slug: p.slug,
        image: p.images?.[0] || null,
        stock: p.stock_quantity ?? 0,
        sku: p.sku,
        status: p.stock_status // useful for UI hints
    }))

    return NextResponse.json({ suggestions })
}
