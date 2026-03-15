import { NextResponse } from 'next/server'

/**
 * Server-side cached exchange rates.
 * Fetches from Open Exchange Rates API and caches for 4 hours.
 * Falls back to last known rates if the upstream API fails.
 */

let cachedRates: Record<string, number> | null = null
let cachedAt = 0
const CACHE_TTL = 4 * 60 * 60 * 1000 // 4 hours

// Hardcoded fallback rates (approximate, updated March 2026)
// Only used if the API has never succeeded in this server instance
const FALLBACK_RATES: Record<string, number> = {
    EUR: 1,
    PLN: 4.28,
    CZK: 25.10,
    SEK: 11.20,
    DKK: 7.46,
    CHF: 0.96,
    GBP: 0.84,
    HUF: 398.0,
    RON: 4.97,
    RSD: 117.0,
    MKD: 61.5,
    NOK: 11.50,
    BAM: 1.96,
    USD: 1.08,
}

async function fetchRates(): Promise<Record<string, number>> {
    const res = await fetch('https://open.er-api.com/v6/latest/EUR', {
        next: { revalidate: 14400 }, // 4h Next.js cache
    })
    if (!res.ok) throw new Error(`Exchange rate API returned ${res.status}`)
    const data = await res.json()
    if (!data?.rates) throw new Error('Invalid exchange rate response')
    return data.rates
}

export async function GET() {
    const now = Date.now()

    // Return cached rates if still fresh
    if (cachedRates && now - cachedAt < CACHE_TTL) {
        return NextResponse.json({
            rates: cachedRates,
            cached: true,
            cachedAt: new Date(cachedAt).toISOString(),
            expiresAt: new Date(cachedAt + CACHE_TTL).toISOString(),
        })
    }

    try {
        const rates = await fetchRates()
        cachedRates = rates
        cachedAt = now

        return NextResponse.json({
            rates,
            cached: false,
            cachedAt: new Date(now).toISOString(),
            expiresAt: new Date(now + CACHE_TTL).toISOString(),
        })
    } catch (err) {
        console.error('Failed to fetch exchange rates:', err)

        // Return stale cache if available
        if (cachedRates) {
            return NextResponse.json({
                rates: cachedRates,
                cached: true,
                stale: true,
                cachedAt: new Date(cachedAt).toISOString(),
                error: 'Using stale cache — upstream API unavailable',
            })
        }

        // Last resort: hardcoded fallback
        return NextResponse.json({
            rates: FALLBACK_RATES,
            cached: false,
            fallback: true,
            error: 'Using hardcoded fallback rates',
        })
    }
}
