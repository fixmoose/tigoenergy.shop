import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { MARKET_DOMAINS } from '@/lib/utils/seo'
import { PRODUCT_CATEGORIES } from '@/lib/constants/categories'

export const dynamic = 'force-dynamic'
export const revalidate = 3600 // Cache for 1 hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const headersList = await headers()
    const marketKey = headersList.get('x-market-key') || 'SHOP'
    const domain = MARKET_DOMAINS[marketKey] || 'tigoenergy.shop'
    const baseUrl = `https://${domain}`

    // Static pages
    const staticPages: MetadataRoute.Sitemap = [
        { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
        { url: `${baseUrl}/products`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
        { url: `${baseUrl}/shipping`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
        { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
        { url: `${baseUrl}/faq`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
        { url: `${baseUrl}/returns`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
        { url: `${baseUrl}/impressum`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
        { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
        { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
        { url: `${baseUrl}/cookies`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.1 },
    ]

    // Category pages from constants
    const categoryPages: MetadataRoute.Sitemap = Object.values(PRODUCT_CATEGORIES).map(cat => ({
        url: `${baseUrl}/products?category=${cat.slug}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
    }))

    // Dynamic product pages
    const supabase = await createAdminClient()
    const { data: products } = await supabase
        .from('products')
        .select('slug, updated_at')
        .eq('active', true)
        .not('slug', 'is', null)

    const productPages: MetadataRoute.Sitemap = (products || []).map((p: { slug: string; updated_at: string | null }) => ({
        url: `${baseUrl}/products/${p.slug}`,
        lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
    }))

    return [...staticPages, ...categoryPages, ...productPages]
}
