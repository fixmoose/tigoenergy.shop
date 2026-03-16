import { MARKETS } from '@/lib/constants/markets'

// Build a lookup map: full country name (UPPERCASE) → 2-letter ISO code
const COUNTRY_NAME_TO_CODE: Record<string, string> = Object.fromEntries(
    Object.values(MARKETS).flatMap(c => [
        [c.countryName.toUpperCase(), c.country],
        [c.country.toUpperCase(), c.country],
    ])
)

/**
 * Normalizes a country value to a 2-letter ISO code.
 * Handles full names like "SLOVENIA" → "SI", passthrough for "SI" → "SI".
 */
export function normalizeCountryCode(val: string): string {
    if (!val) return val
    return COUNTRY_NAME_TO_CODE[val.toUpperCase()] || val
}
