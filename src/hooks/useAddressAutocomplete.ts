'use client'

import { useEffect, useRef, useState } from 'react'

export interface ParsedAddress {
    street: string
    city: string
    postal_code: string
    country: string
    state?: string
}

export function useAddressAutocomplete(onAddressSelected: (address: ParsedAddress) => void) {
    const inputRef = useRef<HTMLInputElement>(null)
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
    const [isLoaded, setIsLoaded] = useState(false)

    useEffect(() => {
        const loadScript = () => {
            if (typeof window === 'undefined') return

            if (window.google?.maps?.places) {
                setIsLoaded(true)
                return
            }

            const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
            if (!apiKey) {
                console.warn('Google Maps API Key missing in environment variables')
                return
            }

            const scriptId = 'google-maps-places-script'
            if (document.getElementById(scriptId)) {
                // Script might be loading, wait for it
                const interval = setInterval(() => {
                    if (window.google?.maps?.places) {
                        setIsLoaded(true)
                        clearInterval(interval)
                    }
                }, 100)
                return
            }

            const script = document.createElement('script')
            script.id = scriptId
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
            script.async = true
            script.defer = true
            script.onload = () => setIsLoaded(true)
            document.head.appendChild(script)
        }

        loadScript()
    }, [])

    useEffect(() => {
        if (!isLoaded || !inputRef.current || !window.google?.maps?.places) return

        autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
            types: ['address'],
            fields: ['address_components', 'formatted_address'],
        })

        const listener = autocompleteRef.current.addListener('place_changed', () => {
            const place = autocompleteRef.current?.getPlace()
            if (!place?.address_components) return

            const address: ParsedAddress = {
                street: '',
                city: '',
                postal_code: '',
                country: '',
            }

            let streetNumber = ''
            let route = ''

            place.address_components.forEach((component: any) => {
                const types = component.types as string[]

                if (types.includes('street_number')) {
                    streetNumber = component.long_name
                }
                if (types.includes('route')) {
                    route = component.long_name
                }
                if (types.includes('locality')) {
                    address.city = component.long_name
                }
                if (types.includes('postal_code')) {
                    address.postal_code = component.long_name
                }
                if (types.includes('country')) {
                    address.country = component.short_name
                }
                if (types.includes('administrative_area_level_1')) {
                    address.state = component.long_name
                }
            })

            // Format street as "Route StreetNumber" or just "Route"
            address.street = streetNumber ? `${route} ${streetNumber}` : route
            onAddressSelected(address)
        })

        return () => {
            if (listener && (window as any).google?.maps?.event) {
                (window as any).google.maps.event.removeListener(listener)
            }
        }
    }, [isLoaded, onAddressSelected])

    return { inputRef, isLoaded }
}
