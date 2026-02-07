import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { MARKET_DOMAINS } from '@/lib/utils/seo'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const headersList = await headers()
    const marketKey = headersList.get('x-market-key') || 'SHOP'
    const domain = MARKET_DOMAINS[marketKey] || 'tigoenergy.shop'
    const baseUrl = `https://${domain}`

    // Static pages
    const staticPages: MetadataRoute.Sitemap = [
        { url: baseUrl, changeFrequency: 'weekly', priority: 1.0 },
        { url: `${baseUrl}/products`, changeFrequency: 'daily', priority: 0.9 },
        { url: `${baseUrl}/impressum`, changeFrequency: 'yearly', priority: 0.3 },
        { url: `${baseUrl}/support/shop`, changeFrequency: 'monthly', priority: 0.3 },
        { url: `${baseUrl}/support/product`, changeFrequency: 'monthly', priority: 0.3 },
    ]

    // Dynamic product pages
    const supabase = await createClient()
    const { data: products } = await supabase
        .from('products')
        .select('slug, updated_at')
        .eq('active', true)
        .not('slug', 'is', null)

    const productPages: MetadataRoute.Sitemap = (products || []).map((p: { slug: string; updated_at: string | null }) => ({
        url: `${baseUrl}/products/${p.slug}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
    }))

    return [...staticPages, ...productPages]
}
