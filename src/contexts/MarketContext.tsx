'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import { type MarketConfig } from '@/lib/constants/markets'
import { LANGUAGES, type LanguageMetadata } from '@/lib/constants/languages'

const LANGUAGE_STORAGE_KEY = 'market_language_v2'

interface MarketContextValue {
    market: MarketConfig
    currentLanguage: LanguageMetadata
    setLanguage: (code: string) => void
}

const MarketContext = createContext<MarketContextValue | undefined>(undefined)

export function useMarket() {
    const ctx = useContext(MarketContext)
    if (!ctx) throw new Error('useMarket must be used within MarketProvider')
    return ctx
}

interface MarketProviderProps {
    initialMarket: MarketConfig
    initialLanguage?: string
    children: React.ReactNode
}

export function MarketProvider({ initialMarket, initialLanguage, children }: MarketProviderProps) {
    // Use the server-resolved language to avoid hydration mismatch.
    // The server already reads the preferred_language cookie via middleware,
    // so we trust its value here instead of reading cookie/localStorage on the client.
    const [currentLanguage, setCurrentLanguage] = useState<LanguageMetadata>(() => {
        const lang = initialLanguage || initialMarket.defaultLanguage
        return LANGUAGES[lang] || LANGUAGES.en
    })

    const setLanguage = useCallback((code: string) => {
        // Only allow switching if this market has a language picker
        if (!initialMarket.hasLanguagePicker) return
        // Only allow languages available for this market
        if (!initialMarket.availableLanguages.includes(code)) return
        if (!LANGUAGES[code]) return

        setCurrentLanguage(LANGUAGES[code])
        localStorage.setItem(LANGUAGE_STORAGE_KEY, code)

        // Set cookie so the server (middleware → i18n) picks up the new language
        document.cookie = `preferred_language=${code};path=/;max-age=${365 * 24 * 60 * 60};SameSite=Lax`
        // Reload to re-render server components with the new locale
        window.location.reload()
    }, [initialMarket])

    const value: MarketContextValue = {
        market: initialMarket,
        currentLanguage,
        setLanguage,
    }

    return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>
}
