'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { CURRENCIES, type CurrencyMetadata } from '@/lib/constants/currencies'
import { createClient } from '@/lib/supabase/client'
import { useMarket } from '@/contexts/MarketContext'

type CustomerType = 'b2c' | 'b2b' | null

const STORAGE_KEY = 'preferred_currency_v1'

interface PriceBreakdown {
    net: string
    vatAmount: string
    vatPercent: number
    gross: string
}

interface CurrencyContextValue {
    currentCurrency: CurrencyMetadata
    setCurrency: (code: string) => void
    rates: Record<string, number>
    formatPrice: (euroAmount: number, includeVat?: boolean) => string
    formatPriceNet: (euroAmount: number) => string
    formatPriceGross: (euroAmount: number) => string
    formatPriceBreakdown: (euroNetAmount: number) => PriceBreakdown
    isLoading: boolean
    customerType: CustomerType
    isB2B: boolean
    vatRate: number
}

const CurrencyContext = createContext<CurrencyContextValue | undefined>(undefined)

export function useCurrency() {
    const ctx = useContext(CurrencyContext)
    if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider')
    return ctx
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
    const { market } = useMarket()

    // Initialize currency from market config
    const [currentCurrency, setCurrentCurrency] = useState<CurrencyMetadata>(
        CURRENCIES[market.currency] || CURRENCIES.EUR
    )
    const [rates, setRates] = useState<Record<string, number>>({ EUR: 1 })
    const [isLoading, setIsLoading] = useState(true)
    const [customerType, setCustomerType] = useState<CustomerType>(null)

    // VAT rate comes from the market config
    const vatRate = market.vatRate

    // Fetch customer type from auth
    useEffect(() => {
        async function fetchCustomerType() {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const type = user.user_metadata?.customer_type as CustomerType
                setCustomerType(type || 'b2c')
            } else {
                setCustomerType('b2c')
            }
        }
        fetchCustomerType()

        const supabase = createClient()
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                const type = session.user.user_metadata?.customer_type as CustomerType
                setCustomerType(type || 'b2c')
            } else {
                setCustomerType('b2c')
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    // Fetch cached rates from our server-side endpoint
    useEffect(() => {
        async function fetchRates() {
            try {
                const res = await fetch('/api/exchange-rates')
                const data = await res.json()
                if (data && data.rates) {
                    setRates(data.rates)
                }
            } catch (e) {
                console.error('Failed to fetch currency rates:', e)
            } finally {
                setIsLoading(false)
            }
        }
        fetchRates()
    }, [])

    // Load currency selection from storage (only for markets with a currency picker)
    useEffect(() => {
        if (market.hasCurrencyPicker) {
            const saved = localStorage.getItem(STORAGE_KEY)
            if (saved && CURRENCIES[saved]) {
                setCurrentCurrency(CURRENCIES[saved])
            }
        }
    }, [market.hasCurrencyPicker])

    const setCurrency = (code: string) => {
        if (!CURRENCIES[code]) return
        // Only allow switching if this market has a currency picker
        if (!market.hasCurrencyPicker) return
        setCurrentCurrency(CURRENCIES[code])
        localStorage.setItem(STORAGE_KEY, code)
    }

    const isB2B = customerType === 'b2b'

    const formatPrice = (euroAmount: number, includeVat?: boolean) => {
        const rate = rates[currentCurrency.code] || 1
        const showWithVat = includeVat !== undefined ? includeVat : !isB2B
        const amount = showWithVat ? euroAmount * (1 + vatRate) : euroAmount
        const converted = amount * rate

        return new Intl.NumberFormat(market.locale, {
            style: 'currency',
            currency: currentCurrency.code,
            currencyDisplay: 'symbol',
        }).format(converted)
    }

    const formatPriceNet = (euroAmount: number) => {
        const rate = rates[currentCurrency.code] || 1
        const converted = euroAmount * rate

        return new Intl.NumberFormat(market.locale, {
            style: 'currency',
            currency: currentCurrency.code,
            currencyDisplay: 'symbol',
        }).format(converted)
    }

    const formatPriceGross = (euroAmount: number) => {
        const rate = rates[currentCurrency.code] || 1
        const converted = euroAmount * (1 + vatRate) * rate

        return new Intl.NumberFormat(market.locale, {
            style: 'currency',
            currency: currentCurrency.code,
            currencyDisplay: 'symbol',
        }).format(converted)
    }

    // Returns the net, VAT amount, and gross as formatted strings for tooltip display
    const formatPriceBreakdown = (euroNetAmount: number): PriceBreakdown => {
        const fmt = (amount: number) => new Intl.NumberFormat(market.locale, {
            style: 'currency',
            currency: currentCurrency.code,
            currencyDisplay: 'symbol',
        }).format(amount * (rates[currentCurrency.code] || 1))

        const vatAmount = euroNetAmount * vatRate
        return {
            net: fmt(euroNetAmount),
            vatAmount: fmt(vatAmount),
            vatPercent: Math.round(vatRate * 100),
            gross: fmt(euroNetAmount + vatAmount),
        }
    }

    const value: CurrencyContextValue = {
        currentCurrency,
        setCurrency,
        rates,
        formatPrice,
        formatPriceNet,
        formatPriceGross,
        formatPriceBreakdown,
        isLoading,
        customerType,
        isB2B,
        vatRate,
    }

    return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}
