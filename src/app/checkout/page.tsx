'use client'
import { useState, useEffect, useRef } from 'react'
import { useCart } from '@/contexts/CartContext'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useMarket } from '@/contexts/MarketContext'
import { createClient } from '@/lib/supabase/client'
import { placeOrder } from '@/app/actions/checkout'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useRecaptcha } from '@/hooks/useRecaptcha'
import { useAddressAutocomplete } from '@/hooks/useAddressAutocomplete'
import { calculateTigoParcels, calculateDPDShippingCost } from '@/lib/shipping/dpd'
import { LowStockWarning } from '@/components/ui/LowStockWarning'

import { MARKETS, EU_COUNTRY_CODES, getMarketKeyFromHostname } from '@/lib/constants/markets'

// Deriving comprehensive countries list from MARKETS config
const COUNTRIES = Object.values(MARKETS)
    .filter(m => m.key !== 'SHOP' && m.key !== 'EU')
    .map(m => ({ code: m.country, name: m.countryName }))
    .sort((a, b) => a.name.localeCompare(b.name))

// Normalize country: convert full names (e.g. "SLOVENIA") to 2-letter codes ("SI")
const COUNTRY_NAME_TO_CODE: Record<string, string> = Object.fromEntries(
    COUNTRIES.flatMap(c => [
        [c.name.toUpperCase(), c.code],
        [c.code, c.code],  // passthrough for already-correct codes
    ])
)
function normalizeCountryCode(val: string): string {
    if (!val) return val
    return COUNTRY_NAME_TO_CODE[val.toUpperCase()] || val
}

const COUNTRY_PREFIXES: Record<string, string> = {
    'SI': '+386',
    'DE': '+49',
    'AT': '+43',
    'FR': '+33',
    'IT': '+39',
    'ES': '+34',
    'NL': '+31',
    'BE': '+32',
    'PL': '+48',
    'CZ': '+420',
    'CH': '+41',
    'HR': '+385'
}

interface SavedAddress {
    id: string
    label?: string
    street: string
    city: string
    postalCode: string
    country: string
    isDefaultShipping?: boolean
    isDefaultBilling?: boolean
    isViesAddress?: boolean
}

interface PaymentPrefs {
    preferred?: string
}

const PAYMENT_METHODS = [
    { id: 'wise', labelKey: 'paymentWiseLabel', descKey: 'paymentWiseDesc', icon: '⚡', enabled: true },
    { id: 'invoice', labelKey: 'paymentInvoiceLabel', descKey: 'paymentInvoiceDesc', icon: '🏦', enabled: true },
]

export default function CheckoutPage() {
    const { items, subtotal, clearCart } = useCart()
    const { formatPrice, formatPriceNet, formatPriceGross, isB2B, vatRate, currentCurrency, rates } = useCurrency()
    const { currentLanguage } = useMarket()
    const t = useTranslations('checkout')
    const tc = useTranslations('common')

    // Auth & Basic State
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [modifyingOrder, setModifyingOrder] = useState<{ orderNumber: string; orderId: string } | null>(null)
    const [billingSame, setBillingSame] = useState(true)
    const [createAccount, setCreateAccount] = useState(false)
    const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([])
    const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
    const [preferredPayment, setPreferredPayment] = useState<string>('wise')
    const [invalidFields, setInvalidFields] = useState<string[]>([])
    const [hasOverStock, setHasOverStock] = useState(false)

    // Shipping Rates State
    const [shippingRates, setShippingRates] = useState<any[]>([])
    const [allDpdRates, setAllDpdRates] = useState<{ min_weight_kg: number; max_weight_kg: number; rate_eur: number }[]>([])
    const [selectedShippingId, setSelectedShippingId] = useState<string | null>(null)
    const [loadingRates, setLoadingRates] = useState(false)
    const [customerPaymentTerms, setCustomerPaymentTerms] = useState<string>('prepayment')
    const [pickupPaymentAcknowledged, setPickupPaymentAcknowledged] = useState(false)

    // VAT Validation State
    const [validatingVat, setValidatingVat] = useState(false)
    const [vatResult, setVatResult] = useState<any>(null)
    const [localIsB2B, setLocalIsB2B] = useState<boolean | null>(null)
    const [emailVerified, setEmailVerified] = useState(false)
    const [emailCodeSent, setEmailCodeSent] = useState(false)
    const [emailCode, setEmailCode] = useState('')
    const [sendingEmailCode, setSendingEmailCode] = useState(false)
    const [verifyingEmail, setVerifyingEmail] = useState(false)

    const isValidEmail = (email: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    }

    const handleSendEmailCode = async () => {
        setSendingEmailCode(true)
        setError(null)
        try {
            const res = await fetch('/api/validate/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email })
            })
            const data = await res.json()
            if (data.success) {
                setEmailCodeSent(true)
            } else {
                setError(data.error || 'Failed to send verification code')
                resetRecaptcha()
            }
        } catch (err: any) {
            setError('Verification service unavailable. Please try again.')
            resetRecaptcha()
        } finally {
            setSendingEmailCode(false)
        }
    }

    const handleVerifyEmail = async () => {
        setVerifyingEmail(true)
        setError(null)
        try {
            const res = await fetch('/api/validate/email/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email, code: emailCode })
            })
            const data = await res.json()
            if (data.success) {
                setEmailVerified(true)
            } else {
                setError(data.error || 'Invalid verification code')
            }
        } catch (err) {
            setError('Verification failed. Please try again.')
        } finally {
            setVerifyingEmail(false)
        }
    }

    const { recaptchaRef, resetRecaptcha, execute: executeRecaptcha } = useRecaptcha()

    const { inputRef: shippingRef, isLoaded: isShippingLoaded, hasError: hasShippingError } = useAddressAutocomplete((parsed) => {
        setFormData(prev => ({
            ...prev,
            shipping_street: parsed.street,
            shipping_city: parsed.city,
            shipping_postal_code: parsed.postal_code,
            shipping_country: parsed.country
        }))
    })

    const passwordRef = useRef<HTMLInputElement>(null)

    const { inputRef: billingRef, isLoaded: isBillingLoaded, hasError: hasBillingError } = useAddressAutocomplete((parsed) => {
        setFormData(prev => ({
            ...prev,
            billing_street: parsed.street,
            billing_city: parsed.city,
            billing_postal_code: parsed.postal_code,
            billing_country: parsed.country
        }))
    })

    useEffect(() => {
        if (createAccount) {
            // Short delay to allow the animation/rendering to complete
            const timer = setTimeout(() => {
                passwordRef.current?.focus()
            }, 100)
            return () => clearTimeout(timer)
        }
    }, [createAccount])

    const effectiveIsB2B = localIsB2B !== null ? localIsB2B : isB2B

    // Prefill State
    const [formData, setFormData] = useState(() => {
        let initialCountry = ''
        if (typeof window !== 'undefined') {
            const marketKey = getMarketKeyFromHostname(window.location.hostname)
            const market = MARKETS[marketKey]
            if (market && market.country !== 'EU') {
                initialCountry = market.country
            } else if (marketKey === 'SI') {
                initialCountry = 'SI'
            }
        }

        return {
            email: '',
            shipping_first_name: '',
            shipping_last_name: '',
            shipping_street: '',
            shipping_street2: '',
            shipping_city: '',
            shipping_postal_code: '',
            shipping_country: initialCountry,
            shipping_phone: '',
            company_name: '',
            vat_id: '',
            billing_first_name: '',
            billing_last_name: '',
            billing_street: '',
            billing_street2: '',
            billing_city: '',
            billing_postal_code: '',
            billing_country: initialCountry,
            password: '',
            confirm_password: '',
            po_number: '',
            commercial_access: false,
            truck_access_notes: '',
            terms_agreement: false,
            newsletter_subscribe: false,
        }
    })

    useEffect(() => {
        const init = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)

            if (user) {
                const { data: customerData } = await supabase
                    .from('customers')
                    .select('*')
                    .eq('id', user.id)
                    .single()

                if (customerData) {
                    if (customerData.payment_terms) setCustomerPaymentTerms(customerData.payment_terms)
                    const addresses: SavedAddress[] = (customerData.addresses || []).map((a: SavedAddress) => ({
                        ...a,
                        country: normalizeCountryCode(a.country),
                        // VIES addresses should not be default shipping unless it's the only address
                        isDefaultShipping: a.isViesAddress ? false : a.isDefaultShipping,
                    }))
                    setSavedAddresses(addresses)
                    const hasNonVies = addresses.some(a => !a.isViesAddress)
                    const defaultShipping = addresses.find(a => a.isDefaultShipping && !a.isViesAddress)
                        || addresses.find(a => !a.isViesAddress)
                        || (!hasNonVies ? addresses[0] : undefined) // fallback to VIES if it's the only address
                    const viesAddress = addresses.find(a => a.isViesAddress)

                    // Fallback to user_metadata for address fields when no saved addresses
                    const meta = user.user_metadata || {}
                    const shippingStreet = defaultShipping?.street || meta.company_address || meta.street || ''
                    const shippingCity = defaultShipping?.city || meta.city || ''
                    const shippingPostal = defaultShipping?.postalCode || meta.postal_code || meta.postalCode || ''
                    const shippingCountry = normalizeCountryCode(defaultShipping?.country || meta.country || '')

                    // For B2B: billing is always VIES address; for B2C: billing = shipping
                    const billingSource = customerData.is_b2b && viesAddress ? viesAddress : null
                    const billingStreet = billingSource?.street || shippingStreet
                    const billingCity = billingSource?.city || shippingCity
                    const billingPostal = billingSource?.postalCode || shippingPostal
                    const billingCountry = normalizeCountryCode(billingSource?.country || shippingCountry)

                    setFormData(prev => ({
                        ...prev,
                        email: user.email || '',
                        shipping_first_name: customerData.first_name || user.user_metadata?.first_name || '',
                        shipping_last_name: customerData.last_name || user.user_metadata?.last_name || '',
                        shipping_phone: (customerData.phone && customerData.phone.length > 4) ? customerData.phone : (user.user_metadata?.phone && user.user_metadata.phone.length > 4 ? user.user_metadata.phone : ''),
                        company_name: customerData.company_name || user.user_metadata?.company_name || '',
                        shipping_street: shippingStreet,
                        shipping_city: shippingCity,
                        shipping_postal_code: shippingPostal,
                        shipping_country: shippingCountry,
                        vat_id: customerData.vat_id || user.user_metadata?.vat_id || '',
                        billing_first_name: customerData.first_name || user.user_metadata?.first_name || '',
                        billing_last_name: customerData.last_name || user.user_metadata?.last_name || '',
                        billing_street: billingStreet,
                        billing_city: billingCity,
                        billing_postal_code: billingPostal,
                        billing_country: billingCountry,
                    }))

                    if (defaultShipping) {
                        setSelectedAddressId(defaultShipping.id)
                    }

                    if (customerData.is_b2b) {
                        setLocalIsB2B(true)
                        // B2B: billing is always VIES, keep billingSame false and lock it
                        if (viesAddress) setBillingSame(false)
                        setFormData(prev => ({
                            ...prev,
                            commercial_access: customerData.commercial_access || false,
                            truck_access_notes: customerData.truck_access_notes || ''
                        }))
                    }
                }
            }

            try {
                const paymentPrefs = localStorage.getItem('tigo_payment_prefs')
                if (paymentPrefs) {
                    const prefs: PaymentPrefs = JSON.parse(paymentPrefs)
                    if (prefs.preferred) setPreferredPayment(prefs.preferred)
                }
            } catch (e) { }

            setLoading(false)
        }
        init()

        // Check if modifying an order
        try {
            const raw = sessionStorage.getItem('modifying_order')
            if (raw) setModifyingOrder(JSON.parse(raw))
        } catch {}
    }, [])

    // Check stock availability for cart items
    useEffect(() => {
        if (items.length === 0) { setHasOverStock(false); return }
        const productIds = items.map(i => i.product_id).filter(Boolean)
        if (productIds.length === 0) return

        fetch('/api/stock-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productIds }),
        })
            .then(r => r.json())
            .then(data => {
                const overStock = items.some(item => {
                    const stock = data.products?.find((p: any) => p.id === item.product_id)
                    if (!stock) return false
                    return stock.available < 999999 && (item.quantity || 0) > stock.available
                })
                setHasOverStock(overStock)
            })
            .catch(() => {})
    }, [items])

    // Auto-validate VAT on load for B2B users with a pre-filled VAT ID
    useEffect(() => {
        if (!loading && formData.vat_id && formData.vat_id.length >= 4 && !vatResult && !validatingVat) {
            handleVatValidate()
        }
    }, [loading])

    const totalWeight = items.reduce((sum, item) => sum + ((item.weight_kg || 0) * (item.quantity || 0)), 0)

    // Pallet Mode Detection
    const junctionQty = items
        .filter(i => (i.metadata as any)?.subcategory === 'GO Junction' || i.name.includes('GO Junction'))
        .reduce((s, i) => s + i.quantity, 0)
    const evChargerQty = items
        .filter(i => (i.metadata as any)?.subcategory === 'GO EV Charger' || i.name.includes('GO EV Charger'))
        .reduce((s, i) => s + i.quantity, 0)
    const isPalletMode = junctionQty >= 50 || evChargerQty >= 25
    const parcels = calculateTigoParcels(items as any)
    const boxCount = parcels.length
    const showInterEuropa = totalWeight > 100 || boxCount > 5

    useEffect(() => {
        const fetchRates = async () => {
            if (!formData.shipping_country) return
            setLoadingRates(true)
            try {
                const supabase = createClient()
                const { data, error } = await supabase
                    .from('shipping_rates')
                    .select('*')
                    .eq('country_code', formData.shipping_country)
                    .eq('active', true)

                if (error) throw error

                // Advanced Filtering Logic
                let filtered = data || []
                const isSI = formData.shipping_country === 'SI'

                if (isPalletMode) {
                    // Bulky items (junctions/chargers): Only InterEuropa or Personal Pick-up
                    filtered = filtered.filter(r =>
                        r.carrier === 'InterEuropa' ||
                        (r.carrier === 'Personal Pick-up' && formData.shipping_country === 'SI')
                    )
                } else {
                    // Normal orders: Show DPD + optionally InterEuropa for large orders
                    filtered = filtered.filter(r =>
                        r.carrier === 'DPD' ||
                        (r.carrier === 'Personal Pick-up' && formData.shipping_country === 'SI')
                    )
                }

                // Store all DPD weight bands for per-parcel pricing
                setAllDpdRates(filtered.filter(r => r.carrier === 'DPD'))

                // Deduplication: Keep only one rate per carrier + service type (the cheapest one)
                const uniqueRates = new Map<string, any>();
                filtered.forEach(rate => {
                    const key = `${rate.carrier}-${rate.service_type}`;
                    const existing = uniqueRates.get(key);
                    if (!existing || rate.rate_eur < existing.rate_eur) {
                        uniqueRates.set(key, rate);
                    }
                });
                filtered = Array.from(uniqueRates.values());

                // Inject InterEuropa pallet option for large orders (>100kg or >5 boxes)
                if (showInterEuropa && !isPalletMode) {
                    const ieRate = totalWeight <= 200 ? 150 : 250
                    filtered.push({
                        id: 'intereuropa-pallet',
                        carrier: 'InterEuropa',
                        service_type: 'Pallet',
                        rate_eur: ieRate,
                        country_code: formData.shipping_country,
                        is_estimate: true,
                    })
                }

                // Sorting: GLS > DPD > Others
                filtered.sort((a, b) => {
                    const order = ['GLS', 'DPD', 'InterEuropa', 'Personal Pick-up']
                    const indexA = order.indexOf(a.carrier)
                    const indexB = order.indexOf(b.carrier)
                    if (indexA !== -1 && indexB !== -1) return indexA - indexB
                    if (indexA !== -1) return -1
                    if (indexB !== -1) return 1
                    return 0
                })

                setShippingRates(filtered)

                if (filtered.length > 0) {
                    const currentRateAvailable = filtered.find(r => r.id === selectedShippingId)
                    if (!currentRateAvailable) {
                        // For SI, prefer Personal Pick-up as default
                        const pickupRate = formData.shipping_country === 'SI'
                            ? filtered.find(r => r.carrier === 'Personal Pick-up')
                            : null
                        setSelectedShippingId(pickupRate ? pickupRate.id : filtered[0].id)
                    }
                } else {
                    console.warn(`No shipping rates found for ${formData.shipping_country}`);
                    setSelectedShippingId(null)
                }
            } catch (err) {
                console.error('Error fetching shipping rates:', err)
                setShippingRates([])
                setAllDpdRates([])
            } finally {
                setLoadingRates(false)
            }
        }
        fetchRates()
    }, [formData.shipping_country, totalWeight])

    // No longer auto-filling prefix, using placeholder instead

    // IP-based country detection and domain redirection
    useEffect(() => {
        const handleIPDetection = async () => {
            try {
                const res = await fetch('/api/geoip')
                const data = await res.json()

                if (!data.country) return

                // Check if we have a localized domain for this country
                const localizedDomain = getLocalizedDomainForCountry(data.country)

                if (localizedDomain) {
                    // Redirect to localized domain
                    const currentHostname = window.location.hostname
                    if (currentHostname !== localizedDomain) {
                        const protocol = window.location.protocol
                        const path = window.location.pathname + window.location.search
                        window.location.href = `${protocol}//${localizedDomain}${path}`
                        return
                    }
                } else {
                    // No localized domain, use IP for country selection
                    setFormData(prev => ({
                        ...prev,
                        shipping_country: data.country,
                        billing_country: data.country
                    }))
                }
            } catch (err) {
                console.warn('IP-based country detection failed:', err)
            }
        }

        // Only run for .shop domain to avoid conflicts with market-specific domains
        // SKIP if we are on localhost to prevent dev redirection loops
        if (typeof window !== 'undefined') {
            const hostname = window.location.hostname
            if (hostname === 'tigoenergy.shop') {
                handleIPDetection()
            }
        }
    }, [])

    // Helper function to get localized domain for country
    const getLocalizedDomainForCountry = (countryCode: string): string | null => {
        const domainMap: Record<string, string> = {
            'SI': 'tigoenergy.si',
            'DE': 'tigoenergy.de',
            'AT': 'tigoenergy.at',
            'CH': 'tigoenergy.ch',
            'FR': 'tigoenergy.fr',
            'IT': 'tigoenergy.it',
            'ES': 'tigoenergy.es',
            'NL': 'tigoenergy.nl',
            'BE': 'tigoenergy.be',
            'PL': 'tigoenergy.pl',
            'CZ': 'tigoenergy.cz',
            'SK': 'tigoenergy.sk',
            'HR': 'tigoenergy.hr',
            'SE': 'tigoenergy.se',
            'DK': 'tigoenergy.dk',
            'RO': 'tigoenergy.ro',
            'RS': 'tigoenergy.rs',
            'MK': 'tigoenergy.mk',
            'ME': 'tigoenergy.me',
            'GB': 'tigoenergy.co.uk'
        }
        return domainMap[countryCode] || null
    }

    // Auto-prefill phone placeholder based on country or IP
    const phonePlaceholder = `${COUNTRY_PREFIXES[formData.shipping_country] || '+49'} ...`

    const handleVatValidate = async () => {
        console.log('Validating VAT:', formData.vat_id)
        if (!formData.vat_id || formData.vat_id.length < 4) return
        setValidatingVat(true)
        setVatResult(null)
        try {
            const res = await fetch('/api/validate/vat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vatNumber: formData.vat_id })
            })
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}))
                throw new Error(errorData.error || `Server error: ${res.status}`)
            }
            const data = await res.json()
            console.log('VAT Validation Result:', data)
            setVatResult(data)
            if (data.valid) {
                setLocalIsB2B(true)
                setFormData(prev => ({
                    ...prev,
                    company_name: data.name || prev.company_name,
                    shipping_street: data.address || prev.shipping_street,
                    shipping_country: data.countryCode || prev.shipping_country,
                    billing_street: billingSame ? (data.address || prev.billing_street) : prev.billing_street,
                    billing_country: billingSame ? (data.countryCode || prev.billing_country) : prev.billing_country
                }))
            } else {
                setLocalIsB2B(false)
            }
        } catch (err: any) {
            console.error('VAT validation error:', err)
            setVatResult({ valid: false, error: err.message || 'Validation service currently unavailable' })
            setLocalIsB2B(false)
        } finally {
            setValidatingVat(false)
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const target = e.target as HTMLInputElement
        const name = target.name
        const value = target.type === 'checkbox' ? target.checked : target.value

        setFormData(prev => ({ ...prev, [name]: value }))

        if (invalidFields.includes(name)) {
            setInvalidFields(prev => prev.filter(f => f !== name))
        }
    }

    const handleSelectAddress = (address: SavedAddress) => {
        setSelectedAddressId(address.id)
        setFormData(prev => ({
            ...prev,
            shipping_street: address.street,
            shipping_city: address.city,
            shipping_postal_code: address.postalCode,
            shipping_country: normalizeCountryCode(address.country),
        }))
    }

    const validateForm = (): boolean => {
        const requiredFields = [
            'email', 'shipping_phone',
            'shipping_street', 'shipping_city', 'shipping_postal_code', 'shipping_country'
        ]
        if (user) {
            requiredFields.push('shipping_first_name', 'shipping_last_name')
        } else {
            requiredFields.push('company_name')
        }
        if (!billingSame) {
            requiredFields.push('billing_first_name', 'billing_last_name', 'billing_street', 'billing_city', 'billing_postal_code', 'billing_country')
        }
        if (!selectedShippingId && shippingRates.length > 0) {
            setError(t('selectShippingMethod'))
            return false
        }
        const missing = requiredFields.filter(field => {
            const val = formData[field as keyof typeof formData]
            if (typeof val === 'boolean') return !val
            if (typeof val === 'string') return !val.trim()
            return val === undefined || val === null
        })

        // Special check for terms_agreement if not in requiredFields list
        if (!formData.terms_agreement) {
            if (!missing.includes('terms_agreement')) missing.push('terms_agreement')
        }

        if (missing.length > 0) {
            console.log('Missing required fields:', missing, 'formData:', Object.fromEntries(missing.map(f => [f, formData[f as keyof typeof formData]])))
            setInvalidFields(missing)
            setError(t('requiredFields'))

            // Scroll to the first missing field and highlight all
            const firstMissingField = missing[0]
            const firstMissingElement = document.querySelector(`[name="${firstMissingField}"]`) as HTMLElement

            // Add a temporary overlay message to the first missing field for immediate feedback
            if (firstMissingElement) {
                // Focus and scroll
                firstMissingElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                setTimeout(() => firstMissingElement.focus({ preventScroll: true }), 500)

                // Add shake animation
                firstMissingElement.classList.add('animate-shake')
                setTimeout(() => firstMissingElement.classList.remove('animate-shake'), 1000)
            }
            return false
        }
        if (!user && !emailVerified) {
            setError(t('verifyEmailFirst'))
            setInvalidFields(['email'])

            // Flash email field and scroll to it
            const emailElement = document.querySelector('[name="email"]') as HTMLElement
            if (emailElement) {
                emailElement.classList.add('animate-pulse', 'ring-2', 'ring-red-500', 'bg-red-50')
                setTimeout(() => {
                    emailElement.classList.remove('animate-pulse', 'ring-2', 'ring-red-500', 'bg-red-50')
                }, 2000)

                emailElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                emailElement.focus({ preventScroll: true })
            }
            return false
        }
        return true
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const form = e.currentTarget
        setError(null)
        setInvalidFields([])
        console.log('Submitting form...')
        if (!validateForm()) {
            console.log('Form validation failed:', { invalidFields, error })
            return
        }
        if (createAccount && formData.password !== formData.confirm_password) {
            setError("Passwords do not match")
            setInvalidFields(['password', 'confirm_password'])
            return
        }
        setSubmitting(true)

        try {
            const token = await executeRecaptcha('CHECKOUT')
            const data = new FormData(form)

            // Logic for guest name handling
            if (!user) {
                const guestName = data.get('company_name') as string
                if (guestName && !data.get('shipping_first_name')) {
                    data.set('shipping_first_name', guestName)
                    data.set('shipping_last_name', '')
                }
            }

            data.append('cart_items', JSON.stringify(items))
            data.append('language', currentLanguage.code)
            data.append('recaptcha_token', token)
            data.append('display_currency', currentCurrency.code)
            data.append('exchange_rate', String(rates[currentCurrency.code] || 1))
            if (selectedShippingId) data.append('shipping_id', selectedShippingId)
            if (modifyingOrder) data.append('original_order_id', modifyingOrder.orderId)
            if (pickupPaymentAcknowledged) data.append('pickup_payment_proof_required', 'true')

            const res = await placeOrder({}, data)
            if (res.error) {
                setError(res.error)
                resetRecaptcha()
            } else if (res.success && res.orderId) {
                clearCart()
                sessionStorage.removeItem('modifying_order')
                window.location.href = `/checkout/success/${res.orderId}`
            }
        } catch (err: any) {
            setError(err.message || 'Something went wrong')
            resetRecaptcha()
        } finally {
            setSubmitting(false)
        }
    }

    const sortedPaymentMethods = [...PAYMENT_METHODS].sort((a, b) => {
        if (a.id === preferredPayment) return -1
        if (b.id === preferredPayment) return 1
        return 0
    })

    const getInputClass = (fieldName: string, baseClass: string = '') => {
        const isInvalid = invalidFields.includes(fieldName)
        return `w-full border rounded-lg px-3 py-2.5 transition-all duration-300 ${baseClass} ${isInvalid
            ? 'border-red-500 bg-red-50/50 ring-4 ring-red-100 placeholder-red-300'
            : 'border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-100'
            }`
    }

    const selectedShippingRate = shippingRates.find(r => r.id === selectedShippingId)
    const currentShippingCost = selectedShippingRate
        ? (selectedShippingRate.carrier === 'DPD' && boxCount > 1
            ? calculateDPDShippingCost(parcels, allDpdRates)
            : selectedShippingRate.rate_eur)
        : 0

    // B2B VAT Logic:
    // 1. If not B2B -> Charge VAT
    // 2. If B2B is from Slovenia (SI) -> Charge VAT (22%)
    // 3. If B2B is from outside Slovenia and VIES-validated -> 0% VAT (Reverse Charge)
    const isSlovenianB2B = effectiveIsB2B && formData.shipping_country === 'SI'
    const appliesVat = !effectiveIsB2B || isSlovenianB2B
    const isExportOrder = formData.shipping_country && !EU_COUNTRY_CODES.includes(formData.shipping_country)

    const finalVatAmount = appliesVat ? (subtotal + currentShippingCost) * vatRate : 0
    const finalTotal = subtotal + currentShippingCost + finalVatAmount

    if (!loading && items.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-4">{t('cartIsEmpty')}</h1>
                    <Link href="/products" className="text-green-600 hover:underline">{tc('continueShop')}</Link>
                </div>
            </div>
        )
    }

    if (loading) return <div className="p-12 text-center">{t('loadingCheckout')}</div>

    return (
        <div className="bg-gray-50 min-h-screen pb-12">
            <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-8">{t('secureCheckout')}</h1>

                {hasOverStock && <div className="mb-6"><LowStockWarning title={tc('lowStockTitle')} note={tc('lowStockNote')} /></div>}

                {modifyingOrder && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-center gap-3">
                        <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        <p className="text-sm text-blue-800">
                            <strong>Updating Order #{modifyingOrder.orderNumber}</strong> — Review your changes and place the updated order.
                        </p>
                    </div>
                )}

                <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        {(invalidFields.length > 0 || error) && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                                <span className="text-2xl">⚠️</span>
                                <div>
                                    <h3 className="font-bold text-red-800">{error || t('requiredFields')}</h3>
                                    {invalidFields.length > 0 && (
                                        <p className="text-sm text-red-600">{t('requiredFieldsDesc')}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <span className="bg-green-100 text-green-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                                {t('contactInfo')}
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium mb-1">{t('emailAddress')} <span className="text-red-500">*</span></label>
                                    <div className="flex gap-2">
                                        <input
                                            type="email" name="email" required value={formData.email}
                                            onChange={handleChange}
                                            readOnly={!!user || emailVerified}
                                            className={`${getInputClass('email')} ${(user || emailVerified) ? 'bg-gray-100 text-gray-500' : ''}`}
                                        />
                                        {!user && !emailVerified && isValidEmail(formData.email) && !emailCodeSent && (
                                            <button
                                                type="button"
                                                onClick={handleSendEmailCode}
                                                disabled={sendingEmailCode}
                                                className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-green-700 transition shrink-0 shadow-sm"
                                            >
                                                {sendingEmailCode ? '...' : 'Verify'}
                                            </button>
                                        )}
                                        {emailVerified && (
                                            <div className="bg-green-100 text-green-700 px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-1 shrink-0">
                                                ✓ Verified
                                            </div>
                                        )}
                                    </div>

                                    {!user && emailCodeSent && !emailVerified && (
                                        <div className="mt-3 p-4 bg-green-50 rounded-xl border border-green-100 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="flex items-center justify-between">
                                                <p className="text-[11px] font-bold text-green-800 uppercase tracking-wider">Verification Code Sent</p>
                                                <button
                                                    type="button"
                                                    onClick={() => setEmailCodeSent(false)}
                                                    className="text-[10px] text-green-600 hover:text-green-800 font-bold uppercase tracking-widest bg-white px-2 py-1 rounded border border-green-200"
                                                >
                                                    Change Email
                                                </button>
                                            </div>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={emailCode}
                                                    onChange={(e) => setEmailCode(e.target.value)}
                                                    className="flex-1 border-green-200 focus:border-green-500 focus:ring-green-500 rounded-lg px-3 py-2 text-sm text-center tracking-[0.5em] font-black"
                                                    placeholder="000000"
                                                    maxLength={6}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleVerifyEmail}
                                                    disabled={verifyingEmail || emailCode.length < 6}
                                                    className="bg-green-600 text-white px-4 rounded-lg font-bold text-sm hover:bg-green-700 transition shadow-sm"
                                                >
                                                    {verifyingEmail ? '...' : 'Confirm'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium mb-1">{t('phoneNumber')} <span className="text-red-500">*</span></label>
                                    <input
                                        type="tel"
                                        name="shipping_phone"
                                        required
                                        value={formData.shipping_phone}
                                        onChange={handleChange}
                                        className={getInputClass('shipping_phone')}
                                        placeholder={phonePlaceholder}
                                    />
                                </div>
                            </div>
                            {!user && (
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" name="create_account" className="rounded text-green-600 focus:ring-green-500" checked={createAccount} onChange={e => setCreateAccount(e.target.checked)} />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-gray-900 group-hover:text-green-700 transition-colors">{t('createAccountFaster')}</span>
                                            <span className="text-xs text-gray-500">{tc('createAccountBenefits')}</span>
                                        </div>
                                    </label>
                                    {createAccount && (
                                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-green-50/50 p-6 rounded-xl border border-green-100 animate-in slide-in-from-top-2 duration-300">
                                            <div>
                                                <label className="block text-xs font-bold text-green-800 mb-1 uppercase tracking-wider">{t('password')}</label>
                                                <input ref={passwordRef} type="password" name="password" required value={formData.password} onChange={handleChange} className="w-full border-green-200 focus:border-green-500 focus:ring-green-500 rounded-lg px-3 py-2 text-sm" placeholder="••••••••" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-green-800 mb-1 uppercase tracking-wider">{t('confirmPassword')}</label>
                                                <input type="password" name="confirm_password" required value={formData.confirm_password} onChange={handleChange} className="w-full border-green-200 focus:border-green-500 focus:ring-green-500 rounded-lg px-3 py-2 text-sm" placeholder="••••••••" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <span className="bg-green-100 text-green-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                                {t('shippingAddress')}
                            </h2>
                            {savedAddresses.filter(a => !a.isViesAddress).length > 0 && (
                                <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {savedAddresses.filter(a => !a.isViesAddress).map(addr => (
                                        <button key={addr.id} type="button" onClick={() => handleSelectAddress(addr)} className={`text-left p-3 border-2 rounded-lg ${selectedAddressId === addr.id ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                                            {(addr.label || addr.isDefaultShipping) && (
                                                <div className="flex items-center gap-2 mb-1">
                                                    {addr.label && <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{addr.label}</span>}
                                                    {addr.isDefaultShipping && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-semibold">{t('defaultShipping')}</span>}
                                                </div>
                                            )}
                                            <p className="font-medium text-sm">{addr.street}</p>
                                            <p className="text-gray-500 text-xs">{addr.postalCode} {addr.city}, {addr.country}</p>
                                        </button>
                                    ))}
                                    <button type="button" onClick={() => setSelectedAddressId(null)} className="p-3 border-2 border-dashed rounded-lg text-sm text-gray-500 text-center">{t('newAddress')}</button>
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium mb-1">
                                        {!user ? t('guestName') : t('companyName')} <span className="text-red-500">*</span>
                                    </label>
                                    <input type="text" name="company_name" required={!user} value={formData.company_name} onChange={handleChange} className={getInputClass('company_name')} />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium mb-1">{t('vatId')}</label>
                                    <div className="flex gap-2">
                                        <input type="text" name="vat_id" value={formData.vat_id} onChange={handleChange} className="grow border border-gray-300 rounded-lg px-3 py-2" placeholder="e.g. DE123456789" />
                                        <button type="button" onClick={handleVatValidate} disabled={validatingVat || !formData.vat_id} className="px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition">
                                            {validatingVat ? '...' : t('validate')}
                                        </button>
                                    </div>
                                    {vatResult && (
                                        <div className={`mt-2 text-xs p-2 rounded ${vatResult.valid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                            {vatResult.valid ? `✓ Valid: ${vatResult.name}` : `✗ ${vatResult.error || 'Invalid VAT'}`}
                                        </div>
                                    )}
                                </div>
                                {effectiveIsB2B && (
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium mb-1">{t('poNumber')} <span className="text-xs text-gray-400">({t('poNumberOptional')})</span></label>
                                        <input type="text" name="po_number" value={formData.po_number} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder={t('poNumberPlaceholder')} />
                                    </div>
                                )}
                                <div className="md:col-span-2">
                                    {hasShippingError ? (
                                        <p className="text-[11px] text-amber-600 font-medium bg-amber-50 p-2.5 rounded-lg border border-amber-100 mb-2">
                                            {t('addressNoteManual')}
                                        </p>
                                    ) : (
                                        <p className="text-[11px] text-blue-600 font-medium bg-blue-50 p-2.5 rounded-lg border border-blue-100 mb-2">
                                            {t('addressNoteLookup')}
                                        </p>
                                    )}
                                </div>
                                {user && (
                                    <>
                                        <input type="text" name="shipping_first_name" required value={formData.shipping_first_name} onChange={handleChange} className={getInputClass('shipping_first_name')} placeholder={t('firstName')} />
                                        <input type="text" name="shipping_last_name" required value={formData.shipping_last_name} onChange={handleChange} className={getInputClass('shipping_last_name')} placeholder={t('lastName')} />
                                    </>
                                )}
                                <div className="md:col-span-2">
                                    <input
                                        ref={selectedAddressId ? undefined : shippingRef}
                                        type="text"
                                        name="shipping_street"
                                        required
                                        readOnly={!!selectedAddressId}
                                        value={formData.shipping_street}
                                        onChange={handleChange}
                                        className={`${getInputClass('shipping_street')} ${selectedAddressId ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                                        placeholder={t('streetAddress')}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <input
                                        type="text"
                                        name="shipping_street2"
                                        value={formData.shipping_street2}
                                        onChange={handleChange}
                                        className={getInputClass('shipping_street2')}
                                        placeholder="Suite, Apt, PO Box, etc. (Optional)"
                                    />
                                </div>
                                <input type="text" name="shipping_postal_code" required readOnly={!!selectedAddressId} value={formData.shipping_postal_code} onChange={handleChange} className={`${getInputClass('shipping_postal_code')} ${selectedAddressId ? 'bg-gray-50 cursor-not-allowed' : ''}`} placeholder={t('postalCode')} />
                                <input type="text" name="shipping_city" required readOnly={!!selectedAddressId} value={formData.shipping_city} onChange={handleChange} className={`${getInputClass('shipping_city')} ${selectedAddressId ? 'bg-gray-50 cursor-not-allowed' : ''}`} placeholder={t('city')} />
                                <div className="md:col-span-2">
                                    {effectiveIsB2B && formData.vat_id ? (
                                        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50 text-gray-700">
                                            <span className="text-sm font-medium">{COUNTRIES.find(c => c.code === formData.shipping_country)?.name || formData.shipping_country}</span>
                                            <span className="text-xs text-gray-400 ml-auto">{t('lockedByVat')}</span>
                                            <input type="hidden" name="shipping_country" value={formData.shipping_country} />
                                        </div>
                                    ) : (
                                        <select name="shipping_country" value={formData.shipping_country} onChange={handleChange} className={getInputClass('shipping_country', 'bg-white')}>
                                            <option value="">-- {t('selectCountry')} --</option>
                                            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                                        </select>
                                    )}
                                    {effectiveIsB2B && (
                                        <div className="mt-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-4">
                                            <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wider">{t('logisticsAccess')}</h3>
                                            <div className="flex flex-col gap-2">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        name="commercial_access"
                                                        checked={formData.commercial_access}
                                                        onChange={e => setFormData(prev => ({ ...prev, commercial_access: e.target.checked }))}
                                                        className="rounded text-blue-600"
                                                    />
                                                    <span className="text-sm font-medium">{t('truckAccess')}</span>
                                                </label>
                                                <p className="text-[11px] text-gray-500 ml-6">{t('truckAccessDesc')}</p>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-blue-800 mb-1 uppercase tracking-wider">{t('truckAccessNotes')}</label>
                                                <textarea
                                                    name="truck_access_notes"
                                                    value={formData.truck_access_notes}
                                                    onChange={e => setFormData(prev => ({ ...prev, truck_access_notes: e.target.value }))}
                                                    className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder={t('truckAccessPlaceholder')}
                                                    rows={2}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <span className="bg-green-100 text-green-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                                {t('shippingMethod')}
                            </h2>
                            {loadingRates ? (
                                <div className="space-y-3"><div className="h-16 bg-gray-50 animate-pulse rounded-xl" /><div className="h-16 bg-gray-50 animate-pulse rounded-xl" /></div>
                            ) : shippingRates.length > 0 ? (
                                <div className="space-y-3">
                                    {shippingRates.map((rate) => {
                                        const isPickup = rate.carrier === 'Personal Pick-up'
                                        const isIE = rate.carrier === 'InterEuropa'
                                        const effectiveRate = rate.carrier === 'DPD' && boxCount > 1
                                            ? calculateDPDShippingCost(parcels, allDpdRates)
                                            : rate.rate_eur
                                        return (
                                            <label key={rate.id} className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-all ${selectedShippingId === rate.id ? (isIE ? 'border-blue-500 bg-blue-50' : 'border-green-500 bg-green-50') : 'border-gray-200 hover:border-green-300'}`}>
                                                <div className="flex items-center gap-3">
                                                    <input type="radio" name="shipping_id" value={rate.id} checked={selectedShippingId === rate.id} onChange={() => setSelectedShippingId(rate.id)} className="text-green-600" />
                                                    <div>
                                                        <div className="font-bold text-gray-900">
                                                            {isPickup ? t('personalPickup') : isIE ? 'InterEuropa Pallet' : `${rate.carrier} ${t('standard')}`}
                                                            {rate.carrier === 'DPD' && boxCount > 1 && (
                                                                <span className="ml-2 text-xs font-normal text-green-600 bg-green-100 px-1.5 py-0.5 rounded">
                                                                    ({boxCount} {t('boxes')})
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {isPickup ? t('pickupReady') : isIE ? t('interEuropaEstimate') : t('deliveryDays')}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className={`font-bold ${isIE ? 'text-blue-700' : 'text-gray-900'}`}>
                                                    {isPickup ? t('personalPickup') : isIE
                                                        ? `~${formatPriceNet(effectiveRate)}`
                                                        : (effectiveRate === 0 ? t('free') : formatPriceNet(effectiveRate))}
                                                </div>
                                            </label>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">{t('noShippingMethods')}</div>
                            )}

                            {/* Pickup payment proof notice — prepayment customers only */}
                            {selectedShippingRate?.carrier === 'Personal Pick-up' && customerPaymentTerms !== 'net30' && (
                                <div className="mt-4 bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={pickupPaymentAcknowledged}
                                            onChange={e => setPickupPaymentAcknowledged(e.target.checked)}
                                            className="mt-1 text-amber-600 rounded"
                                        />
                                        <div>
                                            <p className="font-bold text-amber-800 text-sm">{t('paymentProofTitle')}</p>
                                            <p className="text-xs text-amber-700 mt-1">{t('paymentProofDescription')}</p>
                                        </div>
                                    </label>
                                </div>
                            )}
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <span className="bg-green-100 text-green-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">4</span>
                                {t('billingAddress')}
                            </h2>
                            {effectiveIsB2B ? (
                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">{t('viesRegisteredAddress')}</p>
                                    <div className="text-sm text-gray-900 space-y-0.5">
                                        <p className="font-semibold">{formData.company_name}</p>
                                        <p>{formData.billing_street}</p>
                                        <p>{formData.billing_postal_code} {formData.billing_city}</p>
                                        <p className="uppercase text-xs text-gray-500">{formData.billing_country}</p>
                                        {formData.vat_id && <p className="text-xs text-blue-600 font-mono mt-1">{formData.vat_id}</p>}
                                    </div>
                                    <input type="hidden" name="billing_street" value={formData.billing_street} />
                                    <input type="hidden" name="billing_city" value={formData.billing_city} />
                                    <input type="hidden" name="billing_postal_code" value={formData.billing_postal_code} />
                                    <input type="hidden" name="billing_country" value={formData.billing_country} />
                                </div>
                            ) : (
                            <>
                            <label className="flex items-center gap-2 mb-4 cursor-pointer">
                                <input type="checkbox" name="billing_same" checked={billingSame} onChange={e => setBillingSame(e.target.checked)} className="rounded text-green-600" />
                                <span className="text-sm font-medium">{t('sameAsShipping')}</span>
                            </label>
                            {!billingSame && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <input type="text" name="billing_first_name" required={!billingSame} value={formData.billing_first_name} onChange={handleChange} className={getInputClass('billing_first_name')} placeholder={t('firstName')} />
                                    <input type="text" name="billing_last_name" required={!billingSame} value={formData.billing_last_name} onChange={handleChange} className={getInputClass('billing_last_name')} placeholder={t('lastName')} />
                                    <div className="md:col-span-2">
                                        <input
                                            ref={billingRef}
                                            type="text"
                                            name="billing_street"
                                            required={!billingSame}
                                            value={formData.billing_street}
                                            onChange={handleChange}
                                            className={getInputClass('billing_street')}
                                            placeholder={t('streetAddress')}
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <input
                                            type="text"
                                            name="billing_street2"
                                            value={formData.billing_street2}
                                            onChange={handleChange}
                                            className={getInputClass('billing_street2')}
                                            placeholder="Suite, Apt, PO Box, etc. (Optional)"
                                        />
                                    </div>
                                    <input type="text" name="billing_postal_code" required={!billingSame} value={formData.billing_postal_code} onChange={handleChange} className={getInputClass('billing_postal_code')} placeholder={t('postalCode')} />
                                    <input type="text" name="billing_city" required={!billingSame} value={formData.billing_city} onChange={handleChange} className={getInputClass('billing_city')} placeholder={t('city')} />
                                    <div className="md:col-span-2">
                                        <select name="billing_country" value={formData.billing_country} onChange={handleChange} className={getInputClass('billing_country', 'bg-white')}>
                                            <option value="">-- Select Country --</option>
                                            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}
                            </>
                            )}
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <span className="bg-green-100 text-green-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">5</span>
                                {t('paymentMethod')}
                            </h2>
                            <div className="space-y-3">
                                {sortedPaymentMethods.map((method) => (
                                    <label key={method.id} className={`flex items-center gap-3 p-4 border rounded-xl transition-all ${method.enabled ? 'cursor-pointer hover:border-green-300 hover:bg-green-50/30' : 'opacity-50 cursor-not-allowed bg-gray-50'} ${method.id === preferredPayment && method.enabled ? 'border-green-500 bg-green-50/50' : 'border-gray-200'}`}>
                                        <input type="radio" name="payment_method" value={method.id} defaultChecked={method.id === preferredPayment} disabled={!method.enabled} className="text-green-600" />
                                        <div className="flex-1">
                                            <div className="font-bold text-gray-900">{t(method.labelKey)} {method.id === preferredPayment && <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{t('preferred')}</span>}</div>
                                            <div className="text-xs text-gray-500">{t(method.descKey)}</div>
                                        </div>
                                        <div className="text-xl">{method.icon}</div>
                                    </label>
                                ))}
                            </div>

                            <div className="mt-4 p-3 bg-amber-50/50 rounded-xl border border-amber-100 flex items-start gap-3 animate-in fade-in slide-in-from-top-1 duration-500">
                                <span className="text-amber-500 text-sm">ℹ️</span>
                                <div className="text-[11px] text-amber-900 leading-relaxed">
                                    <span className="font-bold block mb-0.5 uppercase tracking-wider opacity-70">{t('paymentInfo')}</span>
                                    {t('paymentInfoDesc')}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-1">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 sticky top-[128px]">
                            <h2 className="text-lg font-bold mb-6">{t('orderSummary')}</h2>
                            <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto pr-2">
                                {items.map(item => (
                                    <div key={item.sku} className="flex gap-3 text-sm">
                                        <div className="w-14 h-14 bg-gray-50 rounded-lg shrink-0 flex items-center justify-center border border-gray-100 relative">
                                            <span className="absolute -top-1 -right-1 bg-green-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">{item.quantity}</span>
                                            {item.image_url ? <img src={item.image_url} alt={item.name} className="w-full h-full object-contain p-1" /> : <span>📦</span>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-gray-800 line-clamp-2 font-medium">{item.name}</div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-gray-400 text-xs">{item.sku}</span>
                                                <span className="text-gray-900 text-xs font-bold bg-gray-100 px-1.5 py-0.5 rounded">QTY: {item.quantity}</span>
                                            </div>
                                        </div>
                                        <div className="font-semibold">{formatPrice(item.total_price || 0)}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="border-t border-gray-100 pt-4 space-y-2 text-sm">
                                <div className="flex justify-between text-gray-600"><span>{t('subtotalNet')}</span><span>{formatPriceNet(subtotal)}</span></div>
                                <div className="flex justify-between text-gray-600"><span>{t('shipping')}</span><span>{selectedShippingRate?.carrier === 'Personal Pick-up' ? t('personalPickup') : (currentShippingCost === 0 ? t('free') : formatPriceNet(currentShippingCost))}</span></div>
                                {!appliesVat && (
                                    <div className="flex justify-between text-gray-600"><span>{t('vat', { rate: (vatRate * 100).toFixed(0) })}</span><span>{formatPriceNet(0)}</span></div>
                                )}
                                {appliesVat && (
                                    <div className="flex justify-between text-gray-600"><span>{t('vat', { rate: (vatRate * 100).toFixed(0) })}</span><span>{formatPriceNet(finalVatAmount)}</span></div>
                                )}
                                <div className="flex justify-between font-bold text-lg pt-2 border-t mt-2"><span>{t('total')}</span><span>{formatPriceNet(finalTotal)}</span></div>
                                <div className="bg-gray-50 border rounded-lg p-3 mt-3 text-[11px] text-gray-500 space-y-2">
                                    <p>
                                        {effectiveIsB2B
                                            ? (isSlovenianB2B
                                                ? t('slovenianB2bNote')
                                                : t('euB2bNote'))
                                            : t('pricesIncludeVat', { rate: (vatRate * 100).toFixed(0) })}
                                    </p>
                                    {effectiveIsB2B && (
                                        <p className="font-bold text-red-600">{t('b2bFinalSale')}</p>
                                    )}
                                </div>
                                {isExportOrder && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-3 text-[11px] text-amber-800 space-y-1">
                                        <p className="font-bold">⚠️ {t('customsDisclaimerTitle')}</p>
                                        <p>{t('customsDisclaimerBody')}</p>
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 space-y-3">
                                <label className={`flex items-start gap-2 p-3 rounded-lg transition-all duration-300 cursor-pointer group ${invalidFields.includes('terms_agreement') ? 'bg-red-50 ring-4 ring-red-100 border border-red-500' : 'hover:bg-gray-50'}`}>
                                    <input
                                        type="checkbox"
                                        name="terms_agreement"
                                        required
                                        checked={formData.terms_agreement}
                                        onChange={handleChange}
                                        className="mt-1 rounded text-green-600 focus:ring-green-500"
                                    />
                                    <span className={`text-xs ${invalidFields.includes('terms_agreement') ? 'text-red-800 font-bold' : 'text-gray-500'} group-hover:text-gray-700 transition`}>
                                        {t('termsAgree')} <a href="/terms" target="_blank" className="text-green-600 hover:underline">{t('termsConditions')}</a> {t('privacyAcknowledge')} <a href="/privacy" target="_blank" className="text-green-600 hover:underline">{t('privacyPolicy')}</a>.
                                        {effectiveIsB2B
                                            ? ` ${t('b2bTermsNote')}`
                                            : ` ${t('warrantyReturnInfo')}`}
                                    </span>
                                </label>
                                <label className="flex items-center gap-2 p-3 cursor-pointer group hover:bg-gray-50 rounded-lg transition-all">
                                    <input
                                        type="checkbox"
                                        name="newsletter_subscribe"
                                        checked={formData.newsletter_subscribe}
                                        onChange={handleChange}
                                        className="rounded text-green-600 focus:ring-green-500"
                                    />
                                    <span className="text-xs text-gray-500 group-hover:text-gray-700 transition">
                                        {t('newsletterSubscribe')}
                                    </span>
                                </label>
                            </div>

                            <div className="mt-4 py-2 flex justify-center">
                                <div ref={recaptchaRef}></div>
                            </div>

                            {error && (
                                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-bold animate-pulse">
                                    ⚠️ {error}
                                </div>
                            )}

                            <button type="submit" disabled={submitting} className="w-full mt-6 bg-green-600 text-white font-bold py-4 rounded-xl hover:bg-green-700 transition shadow-lg disabled:opacity-70 flex items-center justify-center gap-2">
                                {submitting ? t('processing') : t('placeOrder')}
                            </button>
                            <Link href="/cart" className="block w-full mt-3 text-center text-gray-500 hover:text-gray-700 text-sm font-medium py-2 transition-colors">
                                ← {t('backToCart')}
                            </Link>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}
