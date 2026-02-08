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
        if (typeof window === 'undefined') return

        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        if (!apiKey) {
            console.error('Google Maps API Key missing')
            return
        }

        // Check if script is already present
        if (window.google?.maps?.places) {
            setIsLoaded(true)
            return
        }

        const scriptId = 'google-maps-script'
        let script = document.getElementById(scriptId) as HTMLScriptElement

        if (!script) {
            script = document.createElement('script');
            script.id = scriptId;
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initMapAutocomplete`;
            script.async = true;
            script.defer = true;

            // Define global callback before appending script
            (window as any).initMapAutocomplete = () => {
                setIsLoaded(true);
            };

            script.onerror = () => {
                console.error('Failed to load Google Maps script');
            };

            document.head.appendChild(script);
        } else if (window.google?.maps?.places) {
            setIsLoaded(true)
        } else {
            // Script exists but not yet loaded, wait for the callback or onload
            const interval = setInterval(() => {
                if (window.google?.maps?.places) {
                    setIsLoaded(true)
                    clearInterval(interval)
                }
            }, 500)
            return () => clearInterval(interval)
        }
    }, [])

    useEffect(() => {
        if (!isLoaded || !inputRef.current || !window.google?.maps?.places) return

        try {
            // Initialize Autocomplete
            autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
                types: ['address'],
                fields: ['address_components', 'formatted_address', 'geometry'],
            })

            const listener = autocompleteRef.current.addListener('place_changed', () => {
                const place = autocompleteRef.current?.getPlace()
                console.log('DEBUG: Google Place Result:', place)
                if (!place?.address_components) return

                const address: ParsedAddress = {
                    street: '',
                    city: '',
                    postal_code: '',
                    country: '',
                }

                let streetNumber = ''
                let route = ''
                let cityLocality = ''
                let cityPostalTown = ''
                let cityAdminArea2 = ''

                place.address_components.forEach((component: any) => {
                    const types = component.types as string[]

                    if (types.includes('street_number')) {
                        streetNumber = component.long_name
                    }
                    if (types.includes('route')) {
                        route = component.long_name
                    }
                    if (types.includes('locality')) {
                        cityLocality = component.long_name
                    }
                    if (types.includes('postal_town')) {
                        cityPostalTown = component.long_name
                    }
                    if (types.includes('administrative_area_level_2')) {
                        cityAdminArea2 = component.long_name
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

                // Set city based on priority: locality > postal_town > admin_area_2
                address.city = cityLocality || cityPostalTown || cityAdminArea2 || ''

                address.street = streetNumber ? `${route} ${streetNumber}` : route
                onAddressSelected(address)
            })

            return () => {
                if (window.google?.maps?.event && listener) {
                    window.google.maps.event.removeListener(listener)
                }
                // Clear the Pac container (Google's dropdown div) if component unmounts
                const pacContainers = document.querySelectorAll('.pac-container')
                pacContainers.forEach(container => container.remove())
            }
        } catch (error) {
            console.error('Error initializing Autocomplete:', error)
        }
    }, [isLoaded, onAddressSelected])

    return { inputRef, isLoaded }
}
