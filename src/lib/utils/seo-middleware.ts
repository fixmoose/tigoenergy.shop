import { NextRequest, NextResponse } from 'next/server'
import { getMarketFromKey } from '@/lib/constants/markets'
import { buildHreflangAlternates, buildCanonicalUrl, MARKET_DOMAINS } from './seo'

/**
 * SEO middleware for multi-market optimization
 * Handles redirects, canonical URLs, and hreflang tags
 */

export function seoMiddleware(request: NextRequest) {
    const url = request.nextUrl
    const pathname = url.pathname
    const host = url.host
    const protocol = url.protocol

    // Skip for API routes, static files, and internal Next.js routes
    if (
        pathname.startsWith('/api/') ||
        pathname.startsWith('/_next/') ||
        pathname.startsWith('/favicon.ico') ||
        pathname.startsWith('/sitemap.xml') ||
        pathname.startsWith('/robots.txt')
    ) {
        return NextResponse.next()
    }

    // Determine market from host
    const marketKey = getMarketKeyFromHost(host)
    const market = getMarketFromKey(marketKey)

    // Set market key in headers for downstream components
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-market-key', marketKey)
    requestHeaders.set('x-market-country', market.country)
    requestHeaders.set('x-market-currency', market.currency)
    requestHeaders.set('x-market-locale', market.locale)

    // Forward preferred language cookie as a request header so Server Components
    // can read it via headers(). Only forward if the language is valid for this market.
    const preferredLang = request.cookies.get('preferred_language')?.value
    if (preferredLang && market.availableLanguages.includes(preferredLang)) {
        requestHeaders.set('x-preferred-language', preferredLang)
    } else {
        // Ensure the market default is always applied (removes stale cookie language)
        requestHeaders.set('x-preferred-language', market.defaultLanguage)
    }

    const response = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    })

    // Also set these on the response for client-side visibility/cache keying
    response.headers.set('x-market-key', marketKey)
    response.headers.set('x-market-country', market.country)
    response.headers.set('x-market-currency', market.currency)
    response.headers.set('x-market-locale', market.locale)

    // Handle www redirect (Vercel usually handles this, so we disable it here to avoid duplication)
    /*
    if (host.startsWith('www.')) {
        const newUrl = new URL(url)
        newUrl.host = host.replace('www.', '')
        return NextResponse.redirect(newUrl, 301)
    }
    */



    // Add canonical URL header
    const canonicalUrl = buildCanonicalUrl(marketKey, pathname)
    response.headers.set('canonical', canonicalUrl)

    // Add hreflang headers
    const alternates = buildHreflangAlternates(pathname)
    Object.entries(alternates).forEach(([hreflang, href]) => {
        response.headers.append('link', `<${href}>; rel="alternate"; hreflang="${hreflang}"`)
    })

    // Add structured data script injection (for pages that support it)
    if (pathname === '/' || pathname.startsWith('/products')) {
        response.headers.set('x-structured-data', 'enabled')
    }

    // Add performance monitoring headers
    response.headers.set('x-page-load-tracking', 'enabled')
    response.headers.set('x-core-web-vitals', 'enabled')

    // Add security headers
    response.headers.set('x-frame-options', 'DENY')
    response.headers.set('x-content-type-options', 'nosniff')
    response.headers.set('referrer-policy', 'strict-origin-when-cross-origin')

    return response
}

/**
 * Determine market key from hostname
 */
function getMarketKeyFromHost(host: string): string {
    // Map hostnames to market keys
    const hostMap: Record<string, string> = {
        'tigoenergy.si': 'SI',
        'tigoenergy.de': 'DE',
        'tigoenergy.at': 'AT',
        'tigoenergy.ch': 'CH',
        'tigoenergy.fr': 'FR',
        'tigoenergy.it': 'IT',
        'tigoenergy.es': 'ES',
        'tigoenergy.be': 'BE',
        'tigoenergy.nl': 'NL',
        'tigoenergy.pl': 'PL',
        'tigoenergy.cz': 'CZ',
        'tigoenergy.sk': 'SK',
        'tigoenergy.hr': 'HR',
        'tigoenergy.se': 'SE',
        'tigoenergy.dk': 'DK',
        'tigoenergy.ro': 'RO',
        'tigoenergy.rs': 'RS',
        'tigoenergy.mk': 'MK',
        'tigoenergy.me': 'ME',
        'tigoenergy.co.uk': 'GB',
        'tigo-energy.eu': 'EU',
        'tigoenergy.shop': 'SHOP',
    }

    return hostMap[host] || 'SHOP'
}

/**
 * Generate SEO meta tags for a page
 */
export function generateSEOMetaTags({
    title,
    description,
    image,
    url,
    market,
    keywords = [],
    robots = 'index, follow'
}: {
    title: string
    description: string
    image?: string
    url: string
    market: any
    keywords?: string[]
    robots?: string
}) {
    const canonicalUrl = buildCanonicalUrl(market.key, url)
    const alternates = buildHreflangAlternates(url)

    return {
        title: `${title} | Tigo Energy ${market.countryName}`,
        description: description,
        keywords: [...keywords, 'Tigo Energy', market.countryName, 'solar', 'photovoltaic'].join(', '),
        robots: robots,
        alternates: {
            canonical: canonicalUrl,
            languages: alternates
        },
        openGraph: {
            title: `${title} | Tigo Energy ${market.countryName}`,
            description: description,
            url: canonicalUrl,
            type: 'website',
            locale: market.locale,
            site_name: 'Tigo Energy',
            images: image ? [
                {
                    url: image,
                    width: 1200,
                    height: 630,
                    alt: title
                }
            ] : undefined
        },
        twitter: {
            card: 'summary_large_image',
            title: title,
            description: description,
            image: image,
            site: '@tigoenergy',
            creator: '@tigoenergy'
        }
    }
}

/**
 * Generate structured data for a page
 */
export function generateStructuredData({
    type,
    data,
    market
}: {
    type: 'product' | 'organization' | 'breadcrumb' | 'webpage'
    data: any
    market: any
}) {
    switch (type) {
        case 'product':
            return {
                '@context': 'https://schema.org',
                '@type': 'Product',
                name: data.name,
                description: data.description,
                image: data.image,
                sku: data.sku,
                mpn: data.mpn,
                brand: {
                    '@type': 'Brand',
                    name: 'Tigo Energy'
                },
                offers: {
                    '@type': 'Offer',
                    priceCurrency: market.currency,
                    price: data.price,
                    availability: data.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
                    url: `https://${MARKET_DOMAINS[market.key]}/products/${data.slug}`
                }
            }

        case 'organization':
            return {
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: 'Tigo Energy',
                alternateName: 'Tigo Energy Solutions',
                description: 'Professional solar energy solutions provider',
                url: `https://${MARKET_DOMAINS[market.key]}`,
                logo: `https://${MARKET_DOMAINS[market.key]}/tigo-logo.png`,
                sameAs: [
                    'https://www.facebook.com/tigoenergy',
                    'https://www.linkedin.com/company/tigo-energy',
                    'https://www.instagram.com/tigoenergy'
                ],
                contactPoint: {
                    '@type': 'ContactPoint',
                    telephone: market.phone,
                    contactType: 'customer service',
                    areaServed: market.country,
                    availableLanguage: market.availableLanguages
                }
            }

        case 'breadcrumb':
            const segments = data.path.split('/').filter(Boolean)
            const breadcrumbs = [
                {
                    '@type': 'ListItem',
                    position: 1,
                    name: 'Home',
                    item: `https://${MARKET_DOMAINS[market.key]}`
                }
            ]

            segments.forEach((segment: string, index: number) => {
                breadcrumbs.push({
                    '@type': 'ListItem',
                    position: index + 2,
                    name: segment.replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
                    item: `https://${MARKET_DOMAINS[market.key]}/${segments.slice(0, index + 1).join('/')}`
                })
            })

            return {
                '@context': 'https://schema.org',
                '@type': 'BreadcrumbList',
                itemListElement: breadcrumbs
            }

        case 'webpage':
            return {
                '@context': 'https://schema.org',
                '@type': 'WebPage',
                name: data.title,
                description: data.description,
                url: `https://${MARKET_DOMAINS[market.key]}${data.path}`,
                isPartOf: {
                    '@type': 'WebSite',
                    name: 'Tigo Energy',
                    url: `https://${MARKET_DOMAINS[market.key]}`
                },
                inLanguage: market.locale,
                potentialAction: {
                    '@type': 'SearchAction',
                    target: `https://${MARKET_DOMAINS[market.key]}/products?search={search_term_string}`,
                    'query-input': 'required name=search_term_string'
                }
            }

        default:
            return null
    }
}

// Usage in middleware.ts:
// export const config = {
//   matcher: [
//     /*
//      * Match all request paths except for the ones starting with:
//      * - api (API routes)
//      * - _next/static (static files)
//      * - _next/image (image optimization files)
//      * - favicon.ico (favicon file)
//      * - sitemap.xml (sitemap)
//      * - robots.txt (robots.txt)
//      */
//     '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
//   ],
// }
//
// export function middleware(request: NextRequest) {
//   return seoMiddleware(request)
// }