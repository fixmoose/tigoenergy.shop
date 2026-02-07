import { getRequestConfig } from 'next-intl/server'
import { headers } from 'next/headers'
import { getMarketFromKey } from '@/lib/constants/markets'

// All supported locales
const SUPPORTED_LOCALES = [
    'en', 'de', 'fr', 'it', 'sl', 'es',
    'nl', 'pl', 'cs', 'sk', 'sv', 'da',
    'ro', 'sr', 'sr-Cyrl', 'mk', 'hr',
    'bg', 'no', 'hu', 'pt', 'lv', 'lt', 'et'
] as const

export default getRequestConfig(async () => {
    // Read market from middleware header — no route-based locale prefix needed
    // headers() can throw during static page generation (e.g. 404), so we catch
    let locale = 'en'
    try {
        const headersList = await headers()
        const marketKey = headersList.get('x-market-key') || 'SHOP'
        const market = getMarketFromKey(marketKey)

        // Prefer user's language choice (from cookie, forwarded by middleware)
        const preferred = headersList.get('x-preferred-language')
        if (preferred && SUPPORTED_LOCALES.includes(preferred as any) && market.availableLanguages.includes(preferred)) {
            locale = preferred
        } else {
            locale = SUPPORTED_LOCALES.includes(market.defaultLanguage as any)
                ? market.defaultLanguage
                : 'en'
        }
    } catch {
        // Static rendering — fall back to English
    }

    const messages = (await import(`@/messages/${locale}.json`)).default

    return {
        locale,
        messages,
    }
})
