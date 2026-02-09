import { MARKETS } from '@/lib/constants/markets'

/**
 * Primary domain per market key (one canonical domain per market).
 * Used for hreflang alternate links in <head>.
 */
export const MARKET_DOMAINS: Record<string, string> = {
    SI: 'tigoenergy.si',
    DE: 'tigoenergy.de',
    AT: 'tigoenergy.at',
    CH: 'tigoenergy.ch',
    FR: 'tigoenergy.fr',
    IT: 'tigoenergy.it',
    ES: 'tigoenergy.es',
    BE: 'tigoenergy.be',
    NL: 'tigoenergy.nl',
    PL: 'tigoenergy.pl',
    CZ: 'tigoenergy.cz',
    SK: 'tigoenergy.sk',
    HR: 'tigoenergy.hr',
    SE: 'tigoenergy.se',
    DK: 'tigoenergy.dk',
    RO: 'tigoenergy.ro',
    RS: 'tigoenergy.rs',
    MK: 'tigoenergy.mk',
    ME: 'tigoenergy.me',
    GB: 'tigoenergy.co.uk',
    EU: 'tigo-energy.eu',
    SHOP: 'tigoenergy.shop',
}

/**
 * Build hreflang alternate link objects for a given path.
 * Returns an array suitable for Next.js Metadata `alternates.languages`.
 */
export function buildHreflangAlternates(path: string = '/'): Record<string, string> {
    const alternates: Record<string, string> = {}

    for (const [key, market] of Object.entries(MARKETS)) {
        const domain = MARKET_DOMAINS[key]
        if (!domain) continue

        // hreflang uses language-country format (e.g. "de-DE", "fr-FR")
        const hreflang = `${market.defaultLanguage}-${market.country}`
        alternates[hreflang] = `https://${domain}${path}`
    }

    // x-default points to the SHOP (global fallback)
    alternates['x-default'] = `https://tigoenergy.shop${path}`

    return alternates
}

/**
 * Build canonical URL for a given market and path.
 */
export function buildCanonicalUrl(marketKey: string, path: string = '/'): string {
    const domain = MARKET_DOMAINS[marketKey] || 'tigoenergy.shop'
    return `https://${domain}${path}`
}
