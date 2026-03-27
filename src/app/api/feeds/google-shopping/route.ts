import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { MARKETS } from '@/lib/constants/markets'
import { MARKET_DOMAINS } from '@/lib/utils/seo'
import type { Product } from '@/types/database'

// Google Shopping product category for solar equipment
const GOOGLE_CATEGORY = 'Hardware > Power & Electrical Supplies > Solar Energy Kits'

// Map language codes to product name/description field suffixes
const LANG_FIELD_MAP: Record<string, string> = {
    en: 'en', de: 'de', fr: 'fr', it: 'it', es: 'es', nl: 'nl',
    pl: 'pl', cs: 'cs', sl: 'sl', hr: 'hr', sk: 'sk', sv: 'sv',
    da: 'da', ro: 'ro', sr: 'sr', mk: 'mk', bg: 'bg', no: 'no',
    hu: 'hu', pt: 'pt', lv: 'lv', lt: 'lt', et: 'et',
    'sr-Cyrl': 'sr',
}

function escapeXml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}

function getLocalizedField(product: Product, prefix: string, lang: string): string {
    const suffix = LANG_FIELD_MAP[lang] || 'en'
    const key = `${prefix}_${suffix}` as keyof Product
    const value = product[key] as string | undefined
    // Fallback to English if localized field is empty
    if (!value && suffix !== 'en') {
        return (product[`${prefix}_en` as keyof Product] as string) || ''
    }
    return value || ''
}

function getStockStatus(product: Product): string {
    const available = (product.stock_quantity ?? 0) - (product.reserved_quantity ?? 0)
    if (product.stock_status === 'out_of_stock' || available <= 0) return 'out_of_stock'
    if (product.stock_status === 'coming_soon') return 'preorder'
    return 'in_stock'
}

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const marketKey = (searchParams.get('market') || 'SHOP').toUpperCase()

    const market = MARKETS[marketKey]
    if (!market) {
        return NextResponse.json({ error: `Unknown market: ${marketKey}` }, { status: 400 })
    }

    const domain = MARKET_DOMAINS[marketKey] || 'tigoenergy.shop'
    const baseUrl = `https://${domain}`
    const lang = market.defaultLanguage
    const currency = market.currency

    // Fetch active, in-stock products only
    const supabase = await createAdminClient()
    const { data: products, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .eq('stock_status', 'in_stock')
        .gt('stock_quantity', 0)
        .order('sku', { ascending: true })

    if (error) {
        return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }

    // Build XML
    const items = (products as Product[]).map(product => {
        const title = escapeXml(getLocalizedField(product, 'name', lang))
        const rawDesc = getLocalizedField(product, 'description', lang)
        const description = escapeXml(stripHtml(rawDesc).slice(0, 5000))
        const link = `${baseUrl}/products/${product.slug}`
        const imageLink = product.images?.[0]
            ? (product.images[0].startsWith('http') ? product.images[0] : `${baseUrl}${product.images[0]}`)
            : ''
        const availability = getStockStatus(product)
        const price = `${(product.price_eur ?? 0).toFixed(2)} ${currency}`

        // Additional images (up to 10)
        const additionalImages = (product.images || []).slice(1, 11)
            .map(img => {
                const url = img.startsWith('http') ? img : `${baseUrl}${img}`
                return `      <g:additional_image_link>${escapeXml(url)}</g:additional_image_link>`
            })
            .join('\n')

        const weightTag = product.weight_kg
            ? `      <g:shipping_weight>${product.weight_kg} kg</g:shipping_weight>`
            : ''

        const gtinTag = product.sku
            ? `      <g:mpn>${escapeXml(product.sku)}</g:mpn>`
            : ''

        return `    <item>
      <g:id>${escapeXml(product.sku || product.id)}</g:id>
      <g:title>${title}</g:title>
      <g:description>${description}</g:description>
      <g:link>${escapeXml(link)}</g:link>
${imageLink ? `      <g:image_link>${escapeXml(imageLink)}</g:image_link>` : ''}
${additionalImages}
      <g:availability>${availability}</g:availability>
      <g:price>${price}</g:price>
      <g:brand>Tigo Energy</g:brand>
      <g:condition>new</g:condition>
${gtinTag}
      <g:google_product_category>${escapeXml(GOOGLE_CATEGORY)}</g:google_product_category>
      <g:product_type>${escapeXml([product.category, product.subcategory].filter(Boolean).join(' > '))}</g:product_type>
${weightTag}
      <g:identifier_exists>true</g:identifier_exists>
    </item>`
    }).join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Initra Energija - ${market.countryName}</title>
    <link>${baseUrl}</link>
    <description>Tigo Energy solar optimization products - Initra Energija, authorized reseller for ${market.countryName}</description>
${items}
  </channel>
</rss>`

    return new NextResponse(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
    })
}
