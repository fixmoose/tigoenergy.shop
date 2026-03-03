import { NextResponse } from 'next/server'

export async function GET() {
    try {
        // Use a free IP geolocation service
        const response = await fetch('https://ipapi.co/json/')
        const data = await response.json()

        return NextResponse.json({
            country: data.country_code,
            countryName: data.country_name,
            city: data.city,
            ip: data.ip
        })
    } catch (error) {
        // Fallback to Germany if IP detection fails
        return NextResponse.json({
            country: 'DE',
            countryName: 'Germany',
            city: null,
            ip: null
        })
    }
}