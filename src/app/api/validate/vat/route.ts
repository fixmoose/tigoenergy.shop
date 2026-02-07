import { NextResponse } from 'next/server'

const VIES_API_URL = 'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number'

// In-memory cache to reduce calls to VIES (they rate-limit)
const vatCache = new Map<string, { data: any; cachedAt: number }>()
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

export async function POST(request: Request) {
    try {
        const { vatNumber } = await request.json()

        const cleanVat = (vatNumber || '').replace(/[^A-Z0-9]/gi, '').toUpperCase()

        if (!cleanVat || cleanVat.length < 5) {
            return NextResponse.json({ valid: false, error: 'Invalid VAT format' }, { status: 400 })
        }

        const countryCode = cleanVat.substring(0, 2)
        const number = cleanVat.substring(2)

        // Check cache
        const cacheKey = `${countryCode}${number}`
        const cached = vatCache.get(cacheKey)
        if (cached && Date.now() - cached.cachedAt < CACHE_DURATION) {
            return NextResponse.json({ ...cached.data, cached: true })
        }

        // Call VIES REST API
        const viesResponse = await fetch(VIES_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ countryCode, vatNumber: number }),
        })

        if (!viesResponse.ok) {
            return NextResponse.json(
                { valid: false, error: 'VIES service temporarily unavailable. Please try again later.' },
                { status: 503 }
            )
        }

        const viesData = await viesResponse.json()

        const result = {
            valid: viesData.valid === true,
            name: viesData.name && viesData.name !== '---' ? viesData.name : null,
            address: viesData.address && viesData.address !== '---' ? viesData.address : null,
            countryCode: viesData.countryCode,
            vatNumber: `${viesData.countryCode}${viesData.vatNumber}`,
            requestDate: viesData.requestDate,
        }

        // Cache result
        vatCache.set(cacheKey, { data: result, cachedAt: Date.now() })

        return NextResponse.json(result)

    } catch (error) {
        console.error('VIES validation error:', error)
        return NextResponse.json(
            { valid: false, error: 'Failed to validate VAT number. Please try again later.' },
            { status: 500 }
        )
    }
}
