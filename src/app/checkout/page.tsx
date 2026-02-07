'use client'
import { useState, useEffect } from 'react'
import { useCart } from '@/contexts/CartContext'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useMarket } from '@/contexts/MarketContext'
import { createClient } from '@/lib/supabase/client'
import { placeOrder } from '@/app/actions/checkout'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useRecaptcha } from '@/hooks/useRecaptcha'
import { useAddressAutocomplete } from '@/hooks/useAddressAutocomplete'

// Mock countries for valid EU selection
const COUNTRIES = [
    { code: 'DE', name: 'Germany' },
    { code: 'AT', name: 'Austria' },
    { code: 'FR', name: 'France' },
    { code: 'IT', name: 'Italy' },
    { code: 'ES', name: 'Spain' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'BE', name: 'Belgium' },
    { code: 'PL', name: 'Poland' },
    { code: 'CZ', name: 'Czech Republic' },
    { code: 'CH', name: 'Switzerland' },
    { code: 'SI', name: 'Slovenia' },
    { code: 'HR', name: 'Croatia' }
]

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
    street: string
    city: string
    postalCode: string
    country: string
    isDefaultShipping?: boolean
    isDefaultBilling?: boolean
}

interface PaymentPrefs {
    preferred?: string
}

const PAYMENT_METHODS = [
    { id: 'wise', label: 'Quick Pay (Wise, ApplePay, Cards)', desc: 'Pay instantly via Wise landing page.', icon: '⚡', enabled: true },
    { id: 'invoice', label: 'IBAN Bank Transfer', desc: 'Prepayment via Wise BE account. Details on next page.', icon: '🏦', enabled: true },
]

export default function CheckoutPage() {
    const { items, subtotal, clearCart } = useCart()
    const { formatPrice, formatPriceNet, formatPriceGross, isB2B, vatRate } = useCurrency()
    const { currentLanguage } = useMarket()
    const t = useTranslations('checkout')
    const tc = useTranslations('common')

    // Auth & Basic State
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [billingSame, setBillingSame] = useState(true)
    const [createAccount, setCreateAccount] = useState(false)
    const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([])
    const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
    const [preferredPayment, setPreferredPayment] = useState<string>('wise')
    const [invalidFields, setInvalidFields] = useState<string[]>([])

    // Shipping Rates State
    const [shippingRates, setShippingRates] = useState<any[]>([])
    const [selectedShippingId, setSelectedShippingId] = useState<string | null>(null)
    const [loadingRates, setLoadingRates] = useState(false)

    // VAT Validation State
    const [validatingVat, setValidatingVat] = useState(false)
    const [vatResult, setVatResult] = useState<any>(null)
    const [localIsB2B, setLocalIsB2B] = useState<boolean | null>(null)
    const { recaptchaRef, token: recaptchaToken } = useRecaptcha()

    const { inputRef: shippingRef } = useAddressAutocomplete((parsed) => {
        setFormData(prev => ({
            ...prev,
            shipping_street: parsed.street,
            shipping_city: parsed.city,
            shipping_postal_code: parsed.postal_code,
            shipping_country: parsed.country
        }))
    })

    const { inputRef: billingRef } = useAddressAutocomplete((parsed) => {
        setFormData(prev => ({
            ...prev,
            billing_street: parsed.street,
            billing_city: parsed.city,
            billing_postal_code: parsed.postal_code,
            billing_country: parsed.country
        }))
    })

    const effectiveIsB2B = localIsB2B !== null ? localIsB2B : isB2B

    // Prefill State
    const [formData, setFormData] = useState({
        email: '',
        shipping_first_name: '',
        shipping_last_name: '',
        shipping_street: '',
        shipping_city: '',
        shipping_postal_code: '',
        shipping_country: 'DE',
        shipping_phone: '',
        company_name: '',
        vat_id: '',
        billing_first_name: '',
        billing_last_name: '',
        billing_street: '',
        billing_city: '',
        billing_postal_code: '',
        billing_country: 'DE',
        password: '',
        confirm_password: '',
        commercial_access: false,
        truck_access_notes: ''
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
                    const addresses: SavedAddress[] = customerData.addresses || []
                    setSavedAddresses(addresses)
                    const defaultShipping = addresses.find(a => a.isDefaultShipping)

                    setFormData(prev => ({
                        ...prev,
                        email: user.email || '',
                        shipping_first_name: customerData.first_name || user.user_metadata?.first_name || '',
                        shipping_last_name: customerData.last_name || user.user_metadata?.last_name || '',
                        shipping_phone: customerData.phone || user.user_metadata?.phone || '',
                        company_name: customerData.company_name || user.user_metadata?.company_name || '',
                        shipping_street: defaultShipping?.street || '',
                        shipping_city: defaultShipping?.city || '',
                        shipping_postal_code: defaultShipping?.postalCode || '',
                        shipping_country: defaultShipping?.country || 'DE',
                        vat_id: customerData.vat_id || '',
                    }))

                    if (defaultShipping) {
                        setSelectedAddressId(defaultShipping.id)
                    }

                    if (customerData.is_b2b) {
                        setLocalIsB2B(true)
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
    }, [])

    const totalWeight = items.reduce((sum, item) => sum + ((item.weight_kg || 0) * (item.quantity || 0)), 0)

    // Pallet Mode Detection
    const junctionQty = items
        .filter(i => (i.metadata as any)?.subcategory === 'GO Junction' || i.name.includes('GO Junction'))
        .reduce((s, i) => s + i.quantity, 0)
    const evChargerQty = items
        .filter(i => (i.metadata as any)?.subcategory === 'GO EV Charger' || i.name.includes('GO EV Charger'))
        .reduce((s, i) => s + i.quantity, 0)
    const isPalletMode = junctionQty >= 50 || evChargerQty >= 25 || totalWeight > 100

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
                    .lte('min_weight_kg', totalWeight)
                    .gte('max_weight_kg', totalWeight)
                    .eq('active', true)

                if (error) throw error

                // Advanced Filtering Logic
                let filtered = data || []
                const isSI = formData.shipping_country === 'SI'

                if (isPalletMode) {
                    // Only InterEuropa allowed for pallet shipments
                    // EXCEPT for SI where we also allow Personal Pick-up
                    filtered = filtered.filter(r =>
                        r.carrier === 'InterEuropa' ||
                        (isSI && r.carrier === 'Personal Pick-up')
                    )
                } else {
                    // Normal mode: Hide InterEuropa, allow GLS/DPD
                    filtered = filtered.filter(r => r.carrier !== 'InterEuropa')
                }

                // Deduplication: Keep only one rate per carrier (the cheapest one)
                // This prevents "InterEuropa appearing 5 times" issues
                const uniqueRates = new Map<string, any>();
                filtered.forEach(rate => {
                    const existing = uniqueRates.get(rate.carrier);
                    if (!existing || rate.rate_eur < existing.rate_eur) {
                        uniqueRates.set(rate.carrier, rate);
                    }
                });
                filtered = Array.from(uniqueRates.values());

                setShippingRates(filtered)

                if (filtered.length > 0) {
                    const currentRateAvailable = filtered.find(r => r.id === selectedShippingId)
                    if (!currentRateAvailable) {
                        setSelectedShippingId(filtered[0].id)
                    }
                } else {
                    setSelectedShippingId(null)
                }
            } catch (err) {
                console.error('Error fetching shipping rates:', err)
                setShippingRates([])
            } finally {
                setLoadingRates(false)
            }
        }
        fetchRates()
    }, [formData.shipping_country, totalWeight])

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
                if (data.name) {
                    setFormData(prev => ({ ...prev, company_name: data.name }))
                }
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
        const { name, value } = e.target
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
            shipping_country: address.country,
        }))
    }

    const validateForm = (): boolean => {
        const requiredFields = [
            'email', 'shipping_phone', 'shipping_first_name', 'shipping_last_name',
            'shipping_street', 'shipping_city', 'shipping_postal_code'
        ]
        if (!billingSame) {
            requiredFields.push('billing_first_name', 'billing_last_name', 'billing_street', 'billing_city', 'billing_postal_code')
        }
        if (!selectedShippingId && shippingRates.length > 0) {
            setError('Please select a shipping method.')
            return false
        }
        const missing = requiredFields.filter(field => {
            const val = formData[field as keyof typeof formData]
            if (typeof val === 'string') return !val.trim()
            return val === undefined || val === null
        })
        if (missing.length > 0) {
            setInvalidFields(missing)
            setError('Please fill in all mandatory fields.')
            window.scrollTo({ top: 0, behavior: 'smooth' })
            return false
        }
        return true
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!recaptchaToken) {
            setError('Please complete the reCAPTCHA')
            return
        }
        setError(null)
        setInvalidFields([])
        if (!validateForm()) return
        if (createAccount && formData.password !== formData.confirm_password) {
            setError("Passwords do not match")
            setInvalidFields(['password', 'confirm_password'])
            return
        }
        setSubmitting(true)
        const data = new FormData(e.currentTarget)
        data.append('cart_items', JSON.stringify(items))
        data.append('language', currentLanguage.code)
        data.append('recaptcha_token', recaptchaToken)
        if (selectedShippingId) data.append('shipping_id', selectedShippingId)

        try {
            const res = await placeOrder({}, data)
            if (res.error) {
                setError(res.error)
            } else if (res.success && res.orderId) {
                clearCart()
                window.location.href = `/checkout/success/${res.orderId}`
            }
        } catch (err: any) {
            setError(err.message || 'Something went wrong')
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
        return `w-full border rounded-lg px-3 py-2 ${baseClass} ${isInvalid ? 'border-red-500 animate-pulse ring-2 ring-red-200' : 'border-gray-300'}`
    }

    const selectedShippingRate = shippingRates.find(r => r.id === selectedShippingId)
    const currentShippingCost = selectedShippingRate?.rate_eur || 0

    // B2B VAT Logic:
    // 1. If not B2B -> Charge VAT
    // 2. If B2B is from Slovenia (SI) -> Charge VAT (22%)
    // 3. If B2B is from outside Slovenia and VIES-validated -> 0% VAT (Reverse Charge)
    const isSlovenianB2B = effectiveIsB2B && formData.shipping_country === 'SI'
    const appliesVat = !effectiveIsB2B || isSlovenianB2B

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
                <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        {invalidFields.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                                <span className="text-2xl">⚠️</span>
                                <div>
                                    <h3 className="font-bold text-red-800">{t('requiredFields')}</h3>
                                    <p className="text-sm text-red-600">{t('requiredFieldsDesc')}</p>
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
                                    <input
                                        type="email" name="email" required value={formData.email} onChange={handleChange} readOnly={!!user}
                                        className={`${getInputClass('email')} ${user ? 'bg-gray-100 text-gray-500' : ''}`}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium mb-1">{t('phoneNumber')} <span className="text-red-500">*</span></label>
                                    <input type="tel" name="shipping_phone" required value={formData.shipping_phone} onChange={handleChange} className={getInputClass('shipping_phone')} placeholder={`${COUNTRY_PREFIXES[formData.shipping_country] || '+49'} ...`} />
                                </div>
                            </div>
                            {!user && (
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" name="create_account" className="rounded text-green-600 focus:ring-green-500" checked={createAccount} onChange={e => setCreateAccount(e.target.checked)} />
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-gray-900 group-hover:text-green-700 transition-colors">{t('createAccountFaster')}</span>
                                            <span className="text-xs text-gray-500">{t('createAccountBenefits')}</span>
                                        </div>
                                    </label>
                                    {createAccount && (
                                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-green-50/50 p-6 rounded-xl border border-green-100 animate-in slide-in-from-top-2 duration-300">
                                            <div>
                                                <label className="block text-xs font-bold text-green-800 mb-1 uppercase tracking-wider">{t('password')}</label>
                                                <input type="password" name="password" required value={formData.password} onChange={handleChange} className="w-full border-green-200 focus:border-green-500 focus:ring-green-500 rounded-lg px-3 py-2 text-sm" placeholder="••••••••" />
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
                            {savedAddresses.length > 0 && (
                                <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {savedAddresses.map(addr => (
                                        <button key={addr.id} type="button" onClick={() => handleSelectAddress(addr)} className={`text-left p-3 border-2 rounded-lg ${selectedAddressId === addr.id ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                                            <p className="font-medium text-sm">{addr.street}</p>
                                            <p className="text-gray-500 text-xs">{addr.postalCode} {addr.city}, {addr.country}</p>
                                        </button>
                                    ))}
                                    <button type="button" onClick={() => setSelectedAddressId(null)} className="p-3 border-2 border-dashed rounded-lg text-sm text-gray-500 text-center">{t('newAddress')}</button>
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium mb-1">{t('companyName')}</label>
                                    <input type="text" name="company_name" value={formData.company_name} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
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
                                <input type="text" name="shipping_first_name" required value={formData.shipping_first_name} onChange={handleChange} className={getInputClass('shipping_first_name')} placeholder={t('firstName')} />
                                <input type="text" name="shipping_last_name" required value={formData.shipping_last_name} onChange={handleChange} className={getInputClass('shipping_last_name')} placeholder={t('lastName')} />
                                <div className="md:col-span-2">
                                    <input
                                        ref={shippingRef}
                                        type="text"
                                        name="shipping_street"
                                        required
                                        value={formData.shipping_street}
                                        onChange={handleChange}
                                        className={getInputClass('shipping_street')}
                                        placeholder={t('streetAddress')}
                                    />
                                </div>
                                <input type="text" name="shipping_postal_code" required value={formData.shipping_postal_code} onChange={handleChange} className={getInputClass('shipping_postal_code')} placeholder={t('postalCode')} />
                                <input type="text" name="shipping_city" required value={formData.shipping_city} onChange={handleChange} className={getInputClass('shipping_city')} placeholder={t('city')} />
                                <div className="md:col-span-2">
                                    <select name="shipping_country" value={formData.shipping_country} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white">
                                        {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                                    </select>
                                    {effectiveIsB2B && (
                                        <div className="md:col-span-2 bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-4">
                                            <h3 className="text-sm font-bold text-blue-900 uppercase tracking-wider">Logistics & Access</h3>
                                            <div className="flex flex-col gap-2">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        name="commercial_access"
                                                        checked={formData.commercial_access}
                                                        onChange={e => setFormData(prev => ({ ...prev, commercial_access: e.target.checked }))}
                                                        className="rounded text-blue-600"
                                                    />
                                                    <span className="text-sm font-medium">My delivery location has standard commercial truck access</span>
                                                </label>
                                                <p className="text-[11px] text-gray-500 ml-6">
                                                    Check this if a 12-ton truck can easily access and unload at your site.
                                                </p>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-blue-800 mb-1 uppercase tracking-wider">Truck Access Notes / Working Hours</label>
                                                <textarea
                                                    name="truck_access_notes"
                                                    value={formData.truck_access_notes}
                                                    onChange={e => setFormData(prev => ({ ...prev, truck_access_notes: e.target.value }))}
                                                    className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                                    placeholder="e.g. Ramp available, Forklift on site, Open 8:00 - 16:00..."
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
                                    {shippingRates.map((rate) => (
                                        <label key={rate.id} className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-all ${selectedShippingId === rate.id ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-300'}`}>
                                            <div className="flex items-center gap-3">
                                                <input type="radio" name="shipping_id" value={rate.id} checked={selectedShippingId === rate.id} onChange={() => setSelectedShippingId(rate.id)} className="text-green-600" />
                                                <div>
                                                    <div className="font-bold text-gray-900">{rate.carrier} {rate.service_type === 'pickup' ? '(Pickup)' : 'Standard'}</div>
                                                    <div className="text-xs text-gray-500">{rate.service_type === 'pickup' ? 'Ready in 24h' : '3-5 business days'}</div>
                                                </div>
                                            </div>
                                            <div className="font-bold text-gray-900">{rate.rate_eur === 0 ? 'FREE' : formatPriceGross(rate.rate_eur)}</div>
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm">{t('noShippingMethods')}</div>
                            )}
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <span className="bg-green-100 text-green-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">4</span>
                                {t('billingAddress')}
                            </h2>
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
                                    <input type="text" name="billing_postal_code" required={!billingSame} value={formData.billing_postal_code} onChange={handleChange} className={getInputClass('billing_postal_code')} placeholder={t('postalCode')} />
                                    <input type="text" name="billing_city" required={!billingSame} value={formData.billing_city} onChange={handleChange} className={getInputClass('billing_city')} placeholder={t('city')} />
                                    <div className="md:col-span-2">
                                        <select name="billing_country" value={formData.billing_country} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white">
                                            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                                        </select>
                                    </div>
                                </div>
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
                                            <div className="font-bold text-gray-900">{method.label} {method.id === preferredPayment && <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{t('preferred')}</span>}</div>
                                            <div className="text-xs text-gray-500">{method.desc}</div>
                                        </div>
                                        <div className="text-xl">{method.icon}</div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="lg:col-span-1">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 sticky top-24">
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
                                <div className="flex justify-between text-gray-600"><span>{t('shipping')}</span><span>{currentShippingCost === 0 ? t('free') : formatPriceNet(currentShippingCost)}</span></div>
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
                                                ? "Slovenian B2B: 22% VAT applied (Domestic Sale)."
                                                : "EU B2B Reverse Charge: 0% VAT applied (Intra-Community Sale).")
                                            : t('pricesIncludeVat', { rate: (vatRate * 100).toFixed(0) })}
                                    </p>
                                    {effectiveIsB2B && (
                                        <p className="font-bold text-red-600">
                                            B2B Policy: All sales are final. 14-day return period is not applicable for business customers.
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="mt-4 space-y-3">
                                <label className="flex items-start gap-2 cursor-pointer group">
                                    <input type="checkbox" name="terms_agreement" required className="mt-1 rounded text-green-600 focus:ring-green-500" />
                                    <span className="text-xs text-gray-500 group-hover:text-gray-700 transition">
                                        {t('termsAgree')} <a href="/terms" target="_blank" className="text-green-600 hover:underline">{t('termsConditions')}</a> {t('privacyAcknowledge')} <a href="/privacy" target="_blank" className="text-green-600 hover:underline">{t('privacyPolicy')}</a>.
                                        {effectiveIsB2B
                                            ? " As a business customer, you acknowledge that all sales are final and common consumer return rights do not apply."
                                            : ` ${t('warrantyReturnInfo')}`}
                                    </span>
                                </label>
                                <label className="flex items-start gap-2 cursor-pointer group">
                                    <span className="text-xs text-gray-500 group-hover:text-gray-700 transition">
                                        {t('newsletterSubscribe')}
                                    </span>
                                </label>
                            </div>

                            <div className="mt-4 py-2 flex justify-center">
                                <div ref={recaptchaRef}></div>
                            </div>

                            <button type="submit" disabled={submitting || !recaptchaToken} className="w-full mt-6 bg-green-600 text-white font-bold py-4 rounded-xl hover:bg-green-700 transition shadow-lg disabled:opacity-70 flex items-center justify-center gap-2">
                                {submitting ? t('processing') : t('placeOrder')}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}
