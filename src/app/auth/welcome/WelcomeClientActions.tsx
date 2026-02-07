'use client'

import { useEffect, useRef } from 'react'
import { useCart } from '@/contexts/CartContext'

export default function WelcomeClientActions() {
    const { clearCart } = useCart()
    const hasCleared = useRef(false)

    useEffect(() => {
        // Clear cart once for new user registration
        // Only run once per welcome page visit
        if (!hasCleared.current) {
            hasCleared.current = true
            clearCart()
        }
    }, [clearCart])

    // This component doesn't render anything visible
    return null
}
