
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const { address, city, country, postal_code } = await request.json()

        // MOCK GOOGLE MAPS VALIDATION
        // Return "validated" version which is just title-cased or slightly formatted

        const validatedAddress = {
            street: address.trim(),
            city: city.trim(),
            postal_code: postal_code.trim(),
            country: country,
            formatted: `${address.trim()}, ${postal_code.trim()} ${city.trim()}, ${country}`
        }

        // Simulate 90% success, 10% suggestion needed
        // For now, 100% success to avoid blocking dev

        return NextResponse.json({
            isValid: true,
            original: { address, city, country, postal_code },
            validated: validatedAddress
        })
    } catch (error) {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
