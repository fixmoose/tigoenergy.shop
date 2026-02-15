import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { MARKET_DOMAINS } from '@/lib/utils/seo'

export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
    const headersList = await headers()
    const marketKey = headersList.get('x-market-key') || 'SHOP'
    const domain = MARKET_DOMAINS[marketKey] || 'tigoenergy.shop'

    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/admin', '/api', '/auth', '/dashboard', '/cart', '/checkout'],
        },
        sitemap: `https://${domain}/sitemap.xml`,
    }
}
