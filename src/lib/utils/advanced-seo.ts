import { MARKETS } from '@/lib/constants/markets'
import { MARKET_DOMAINS } from './seo'

/**
 * Advanced SEO utilities for multi-market optimization
 */

// Schema.org structured data builders
export const buildProductSchema = (product: any, market: any) => {
    return {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: product.description,
        image: product.image_url,
        sku: product.sku,
        mpn: product.mpn,
        brand: {
            '@type': 'Brand',
            name: 'Tigo Energy'
        },
        offers: {
            '@type': 'Offer',
            priceCurrency: market.currency,
            price: product.price,
            availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
            url: `https://${MARKET_DOMAINS[market.key]}/products/${product.slug}`,
            seller: {
                '@type': 'Organization',
                name: 'Tigo Energy',
                url: `https://${MARKET_DOMAINS[market.key]}`
            }
        },
        aggregateRating: product.rating ? {
            '@type': 'AggregateRating',
            ratingValue: product.rating,
            reviewCount: product.review_count || 0
        } : undefined
    }
}

export const buildOrganizationSchema = (market: any) => {
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
        },
        address: {
            '@type': 'PostalAddress',
            streetAddress: market.address?.street,
            addressLocality: market.address?.city,
            addressRegion: market.address?.region,
            postalCode: market.address?.postalCode,
            addressCountry: market.country
        }
    }
}

export const buildBreadcrumbSchema = (path: string, market: any) => {
    const segments = path.split('/').filter(Boolean)
    const breadcrumbs = [
        {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: `https://${MARKET_DOMAINS[market.key]}`
        }
    ]

    segments.forEach((segment, index) => {
        breadcrumbs.push({
            '@type': 'ListItem',
            position: index + 2,
            name: segment.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
            item: `https://${MARKET_DOMAINS[market.key]}/${segments.slice(0, index + 1).join('/')}`
        })
    })

    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs
    }
}

// Open Graph and Twitter Card builders
export const buildOpenGraphData = (title: string, description: string, image: string, url: string, market: any) => {
    return {
        title: `${title} | Tigo Energy ${market.countryName}`,
        description: description,
        url: url,
        type: 'website',
        locale: market.locale,
        site_name: 'Tigo Energy',
        images: [
            {
                url: image,
                width: 1200,
                height: 630,
                alt: title
            }
        ]
    }
}

export const buildTwitterCardData = (title: string, description: string, image: string) => {
    return {
        card: 'summary_large_image',
        title: title,
        description: description,
        image: image,
        site: '@tigoenergy',
        creator: '@tigoenergy'
    }
}

// Performance monitoring for SEO
export const trackPageLoadTime = () => {
    if (typeof window !== 'undefined' && window.performance) {
        window.addEventListener('load', () => {
            const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
            const loadTime = navigation.loadEventEnd - (navigation as any).navigationStart

            // Send to analytics
            if (typeof (window as any).gtag !== 'undefined') {
                ; (window as any).gtag('event', 'page_load', {
                    event_category: 'Performance',
                    event_label: window.location.pathname,
                    value: Math.round(loadTime)
                })
            }
        })
    }
}

// Core Web Vitals monitoring
export const trackCoreWebVitals = () => {
    if (typeof window !== 'undefined' && window.performance) {
        // LCP (Largest Contentful Paint)
        new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries()
            const lastEntry = entries[entries.length - 1]
            if (typeof (window as any).gtag !== 'undefined') {
                ; (window as any).gtag('event', 'largest_contentful_paint', {
                    event_category: 'Web Vitals',
                    event_label: window.location.pathname,
                    value: Math.round(lastEntry.startTime)
                })
            }
        }).observe({ entryTypes: ['largest-contentful-paint'] })

        // FID (First Input Delay)
        new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries()
            entries.forEach((entry) => {
                if (typeof (window as any).gtag !== 'undefined') {
                    ; (window as any).gtag('event', 'first_input_delay', {
                        event_category: 'Web Vitals',
                        event_label: window.location.pathname,
                        value: Math.round((entry as any).processingStart - entry.startTime)
                    })
                }
            })
        }).observe({ entryTypes: ['first-input'] })

        // CLS (Cumulative Layout Shift)
        let clsValue = 0
        new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries()
            entries.forEach((entry: any) => {
                if (!entry.hadRecentInput) {
                    clsValue += entry.value
                }
            })
        }).observe({ entryTypes: ['layout-shift'] })

        // Report CLS on page unload
        window.addEventListener('beforeunload', () => {
            if (typeof (window as any).gtag !== 'undefined') {
                ; (window as any).gtag('event', 'cumulative_layout_shift', {
                    event_category: 'Web Vitals',
                    event_label: window.location.pathname,
                    value: Math.round(clsValue * 1000)
                })
            }
        })
    }
}

// Structured data injection utility
export const injectStructuredData = (data: any) => {
    if (typeof window !== 'undefined') {
        const script = document.createElement('script')
        script.type = 'application/ld+json'
        script.textContent = JSON.stringify(data)
        document.head.appendChild(script)
    }
}

// SEO meta tag utilities
export const setMetaTags = (tags: Record<string, string>) => {
    Object.entries(tags).forEach(([name, content]) => {
        let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement
        if (!meta) {
            meta = document.createElement('meta')
            meta.name = name
            document.head.appendChild(meta)
        }
        meta.content = content
    })
}

// Canonical URL management
export const updateCanonicalUrl = (path: string, marketKey: string) => {
    const domain = MARKET_DOMAINS[marketKey] || 'tigoenergy.shop'
    const canonicalUrl = `https://${domain}${path}`

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement
    if (!canonical) {
        canonical = document.createElement('link')
        canonical.rel = 'canonical'
        document.head.appendChild(canonical)
    }
    canonical.href = canonicalUrl
}

// Hreflang management
export const updateHreflangTags = (path: string) => {
    // Remove existing hreflang tags
    const existingTags = document.querySelectorAll('link[rel="alternate"][hreflang]')
    existingTags.forEach(tag => tag.remove())

    // Add new hreflang tags
    Object.entries(MARKET_DOMAINS).forEach(([key, domain]) => {
        const market = MARKETS[key]
        if (market) {
            const link = document.createElement('link')
            link.rel = 'alternate'
            link.hreflang = `${market.defaultLanguage}-${market.country}`
            link.href = `https://${domain}${path}`
            document.head.appendChild(link)
        }
    })

    // Add x-default
    const xDefault = document.createElement('link')
    xDefault.rel = 'alternate'
    xDefault.hreflang = 'x-default'
    xDefault.href = `https://tigoenergy.shop${path}`
    document.head.appendChild(xDefault)
}

// Performance optimization utilities
export const lazyLoadImages = () => {
    if ('loading' in HTMLImageElement.prototype) {
        // Native lazy loading supported
        const images = document.querySelectorAll('img[loading="lazy"]')
        images.forEach(img => {
            const imgElement = img as HTMLImageElement
            imgElement.src = imgElement.dataset.src || imgElement.src
        })
    } else {
        // Fallback for older browsers
        const images = document.querySelectorAll('img[data-src]')
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target as HTMLImageElement
                    img.src = img.dataset.src || ''
                    img.classList.remove('lazy')
                    observer.unobserve(img)
                }
            })
        })

        images.forEach(img => imageObserver.observe(img))
    }
}

// Accessibility improvements
export const enhanceAccessibility = () => {
    // Add skip links
    const skipLink = document.createElement('a')
    skipLink.href = '#main-content'
    skipLink.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:bg-green-600 focus:text-white focus:p-2 focus:rounded'
    skipLink.textContent = 'Skip to main content'
    document.body.insertBefore(skipLink, document.body.firstChild)

    // Enhance form labels
    const inputs = document.querySelectorAll('input, select, textarea')
    inputs.forEach(input => {
        const label = document.querySelector(`label[for="${input.id}"]`)
        if (label && !input.getAttribute('aria-label')) {
            input.setAttribute('aria-label', label.textContent || '')
        }
    })
}

// Usage examples:
// 
// // In a product page component:
// useEffect(() => {
//   const market = getMarketFromKey(marketKey)
//   const productSchema = buildProductSchema(product, market)
//   const organizationSchema = buildOrganizationSchema(market)
//   const breadcrumbSchema = buildBreadcrumbSchema(router.asPath, market)
//   
//   injectStructuredData(productSchema)
//   injectStructuredData(organizationSchema)
//   injectStructuredData(breadcrumbSchema)
//   
//   trackCoreWebVitals()
//   lazyLoadImages()
//   enhanceAccessibility()
// }, [product, marketKey])