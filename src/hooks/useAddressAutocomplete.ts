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
    const [hasError, setHasError] = useState(false)
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    useEffect(() => {
        if (typeof window === 'undefined') return
        if (!apiKey) {
            setHasError(true)
            return
        }

        const handleLoad = () => {
            setIsLoaded(true)
            setHasError(false)
        }

        const handleError = () => {
            setIsLoaded(false)
            setHasError(true)
        }

        // 1. If already loaded
        if (window.google?.maps?.places) {
            handleLoad()
            return
        }

        // 2. Listen for singleton events
        window.addEventListener('google-maps-loaded', handleLoad)
        window.addEventListener('google-maps-error', handleError)

        // 3. Define global callbacks (shared)
        if (!(window as any).initMapAutocomplete) {
            (window as any).initMapAutocomplete = () => {
                window.dispatchEvent(new Event('google-maps-loaded'))
            }
        }
        if (!(window as any).gm_authFailure) {
            (window as any).gm_authFailure = () => {
                console.error('Google Maps Authentication Failed (RefererNotAllowedMapError)');
                window.dispatchEvent(new Event('google-maps-error'))
            }
        }

        // 4. Load script if not present
        const scriptId = 'google-maps-script'
        if (!document.getElementById(scriptId)) {
            const script = document.createElement('script')
            script.id = scriptId
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initMapAutocomplete`
            script.async = true
            script.defer = true
            script.onerror = () => window.dispatchEvent(new Event('google-maps-error'))
            document.head.appendChild(script)
        }

        // 5. Polling fallback for edge cases where script is already in DOM but stalled
        const checkInterval = setInterval(() => {
            if (window.google?.maps?.places) {
                handleLoad()
                clearInterval(checkInterval)
            }
        }, 1000)

        // 6. Timeout
        const timeout = setTimeout(() => {
            if (!window.google?.maps?.places && !isLoaded) {
                console.warn('Google Maps Autocomplete timeout')
                handleError()
            }
        }, 8000)

        return () => {
            window.removeEventListener('google-maps-loaded', handleLoad)
            window.removeEventListener('google-maps-error', handleError)
            clearInterval(checkInterval)
            clearTimeout(timeout)
        }
    }, [apiKey])

    useEffect(() => {
        if (!isLoaded || !inputRef.current || !window.google?.maps?.places) return

        try {
            autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
                types: ['address'],
                fields: ['address_components', 'formatted_address', 'geometry'],
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
                let locality = ''
                let postal_town = ''
                let sublocality = ''
                let neighborhood = ''
                let admin_area_2 = ''

                place.address_components.forEach((component: any) => {
                    const types = component.types as string[]
                    if (types.includes('street_number')) streetNumber = component.long_name
                    if (types.includes('route')) route = component.long_name
                    if (types.includes('locality')) locality = component.long_name
                    if (types.includes('postal_town')) postal_town = component.long_name
                    if (types.includes('sublocality_level_1')) sublocality = component.long_name
                    if (types.includes('neighborhood')) neighborhood = component.long_name
                    if (types.includes('administrative_area_level_2')) admin_area_2 = component.long_name
                    if (types.includes('postal_code')) address.postal_code = component.long_name
                    if (types.includes('country')) address.country = component.short_name.toUpperCase()
                    if (types.includes('administrative_area_level_1')) address.state = component.long_name
                })

                address.city = locality || postal_town || sublocality || neighborhood || admin_area_2 || ''
                address.street = streetNumber ? `${route} ${streetNumber}` : route
                onAddressSelected(address)
            })

            return () => {
                if (window.google?.maps?.event && listener) {
                    window.google.maps.event.removeListener(listener)
                }
            }
        } catch (error) {
            console.error('Error initializing Autocomplete:', error)
        }
    }, [isLoaded, onAddressSelected])

    return { inputRef, isLoaded, hasError }
}
