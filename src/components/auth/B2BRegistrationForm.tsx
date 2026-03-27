'use client'

import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useRecaptcha } from '@/hooks/useRecaptcha'
import { registerB2BUserAction } from '@/app/actions/auth'
import { useAddressAutocomplete } from '@/hooks/useAddressAutocomplete'
import { getMarketKeyFromHostname, getDomainForMarket } from '@/lib/constants/markets'
import { createClient } from '@/lib/supabase/client'
import React, { useState, useEffect, useRef } from 'react'

/** Parse the raw VIES address string into structured parts */
function parseViesAddress(raw: string): { street: string; postalCode: string; city: string } {
    const cleaned = raw.replace(/\r/g, '').trim()
    const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean)

    if (lines.length >= 2) {
        const street = lines[0]
        const lastLine = lines[lines.length - 1]
        // Match "1234 CITY" or "1234-56 CITY" or "12345 CITY"
        const m = lastLine.match(/^(\d[\d\s\-]{1,7}\d)\s+(.+)$/)
        if (m) return { street, postalCode: m[1].replace(/\s/g, ''), city: m[2].replace(/\s+/g, ' ').trim() }
        return { street, postalCode: '', city: lastLine }
    }

    // Single line — try "STREET, POSTAL CITY"
    const m = cleaned.match(/^(.+?),?\s+(\d[\d\s\-]{1,7}\d)\s+(.+)$/)
    if (m) return { street: m[1].trim(), postalCode: m[2].replace(/\s/g, ''), city: m[3].trim() }

    return { street: cleaned, postalCode: '', city: '' }
}

const MARKET_PHONE_CODES: Record<string, string> = {
    SI: '+386',
    DE: '+49',
    AT: '+43',
    IT: '+39',
    FR: '+33',
    ES: '+34',
    HR: '+385',
    CH: '+41',
    PL: '+48',
    CZ: '+420',
    SK: '+421',
    HU: '+36',
    RO: '+40',
    BE: '+32',
    NL: '+31',
    GB: '+44',
    SE: '+46',
    DK: '+45',
    NO: '+47',
    PT: '+351',
    RS: '+381',
    MK: '+389',
    ME: '+382',
    BG: '+359',
    LV: '+371',
    LT: '+370',
    EE: '+372',
}

/** Find which known prefix (if any) the phone value starts with, longest match first */
function detectPhonePrefix(phone: string): string | null {
    const sorted = Object.values(MARKET_PHONE_CODES).sort((a, b) => b.length - a.length)
    return sorted.find(p => phone.startsWith(p)) || null
}


export default function B2BRegistrationForm() {
    const t = useTranslations('auth.register')
    const router = useRouter()
    const searchParams = useSearchParams()

    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const { recaptchaRef, resetRecaptcha, execute: executeRecaptcha } = useRecaptcha()
    const { inputRef: addressInputRef } = useAddressAutocomplete((parsed) => {
        setFormData(prev => ({
            ...prev,
            address: parsed.street,
            city: parsed.city,
            postalCode: parsed.postal_code,
            country: parsed.country
        }))
    })

    // Form State
    const [formData, setFormData] = useState({
        // Company
        vatNumber: '',
        companyName: '',
        address: '', // Changed from companyAddress
        companyAddress2: '',
        city: '',
        postalCode: '',
        country: '',
        website: '',
        businessType: '', // 'installer', 'distributor', 'reseller'
        employees: '',

        // Shipping
        commercialAccess: false,
        preferredCarrier: '',

        // Contact Person
        firstName: '',
        lastName: '',
        jobTitle: '',
        email: '',
        phone: '',

        // Verification
        emailCode: '',
        phoneCode: '',

        // Security
        password: '',
        confirmPassword: '',

        // Agreements
        terms: false,
        privacy: false,
        authorized: false, // New field
        legitimate: false, // New field, replaced legitimateBusiness
        newsletter: false, // New field
        marketing: false // New field
    })

    // VIES-locked address (non-editable, used for invoicing)
    const [viesAddress, setViesAddress] = useState<{ street: string; postalCode: string; city: string; country: string } | null>(null)

    // Optional extra addresses
    const [addShipping, setAddShipping] = useState(false)
    const [addBilling, setAddBilling] = useState(false)
    const [shippingAddr, setShippingAddr] = useState({ street: '', city: '', postalCode: '', country: '' })
    const [billingAddr, setBillingAddr] = useState({ street: '', city: '', postalCode: '', country: '' })

    const shippingRef = useRef<HTMLInputElement>(null)
    const billingRef = useRef<HTMLInputElement>(null)

    // VAT country mismatch notification
    const [vatMismatch, setVatMismatch] = useState<{ vatCountry: string; targetDomain: string; redirectUrl: string } | null>(null)

    // Verification States
    const [vatVerified, setVatVerified] = useState(false)
    const [emailVerified, setEmailVerified] = useState(false)
    const [phoneVerified, setPhoneVerified] = useState(false)
    const [emailCodeSent, setEmailCodeSent] = useState(false)
    const [phoneCodeSent, setPhoneCodeSent] = useState(false)

    // Check for VAT in URL
    useEffect(() => {
        const vatParam = searchParams.get('vat')
        if (vatParam && !formData.vatNumber) {
            setFormData(prev => ({ ...prev, vatNumber: vatParam.toUpperCase() }))
        }
    }, [searchParams])

    // Auto-prefill phone code based on market or detected company country
    useEffect(() => {
        let targetCountry = formData.country

        // Fallback to market if no country detected yet
        if (!targetCountry && typeof window !== 'undefined') {
            targetCountry = getMarketKeyFromHostname(window.location.hostname)
        }

        if (targetCountry) {
            const code = MARKET_PHONE_CODES[targetCountry]
            if (code) {
                setFormData(prev => {
                    const currentPhone = prev.phone.trim()
                    // If empty or just an old prefix, update it
                    const isPrefixOnly = Object.values(MARKET_PHONE_CODES).some(p => currentPhone === p)
                    if (!currentPhone || isPrefixOnly) {
                        return { ...prev, phone: code + ' ' }
                    }
                    return prev
                })
            }
        }
    }, [formData.country])

    // --- HANDLERS ---

    // STEP 1: VAT Validation
    const handleValidateVat = async () => {
        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/validate/vat', {
                method: 'POST', body: JSON.stringify({ vatNumber: formData.vatNumber })
            })
            const data = await res.json()
            setLoading(false)

            if (data.valid) {
                // DOMAIN ENFORCEMENT
                const currentMarket = getMarketKeyFromHostname(window.location.hostname)
                const vatCountry = data.countryCode // "SI", "HR", "DE", etc.

                // SI can only register on .si, HR only on .hr, etc.
                // If it's a generic .shop, allow any? User said "reroute to .shop if we dont have that domain to match"
                // Actually, if I'm on .si and enter DE VAT, I must be rerouted.

                if (vatCountry !== currentMarket && currentMarket !== 'SHOP') {
                    const targetDomain = getDomainForMarket(vatCountry)
                    const redirectUrl = `https://${targetDomain}/auth/register?type=b2b&vat=${formData.vatNumber.toUpperCase()}`
                    setVatMismatch({ vatCountry, targetDomain, redirectUrl })
                    return
                }

                setVatVerified(true)
                // Parse VIES raw address into structured parts
                const parsed = data.address ? parseViesAddress(data.address) : { street: '', postalCode: '', city: '' }
                const viesCountry = data.countryCode || ''
                setViesAddress({ ...parsed, country: viesCountry })
                setFormData(prev => ({
                    ...prev,
                    companyName: data.name || prev.companyName,
                    address: parsed.street,
                    city: parsed.city,
                    postalCode: parsed.postalCode,
                    country: viesCountry,
                }))
                // Auto-advance
                setStep(2)
            } else {
                setError(data.error || t('errors.vatValidationFailed'))
            }
        } catch (e) {
            setLoading(false)
            setError(t('errors.connectionError'))
        }
    }

    // STEP 4: Email/Phone (Reused logic from B2C)
    const handleSendEmailCode = async () => {
        setLoading(true); setError('')
        try {
            const token = await executeRecaptcha('REGISTRATION')
            const res = await fetch('/api/validate/email', {
                method: 'POST', body: JSON.stringify({ email: formData.email, recaptchaToken: token })
            })
            const data = await res.json()
            setLoading(false)
            if (data.success) {
                setEmailCodeSent(true)
            } else {
                setError(data.error)
                resetRecaptcha()
            }
        } catch (err: any) {
            setLoading(false)
            setError(t('errors.verificationFailed'))
            resetRecaptcha()
        }
    }

    const handleVerifyEmail = async () => {
        setLoading(true); setError('')
        try {
            const res = await fetch('/api/validate/email/verify', {
                method: 'POST',
                body: JSON.stringify({ email: formData.email, code: formData.emailCode })
            })
            const data = await res.json()
            if (data.success) setEmailVerified(true)
            else setError(data.error || t('errors.invalidCode'))
        } catch (err) {
            setError(t('errors.verificationFailed'))
        } finally {
            setLoading(false)
        }
    }

    // Normalize phone: prepend market prefix if user typed a local number (e.g. 051766308 → +386 51766308)
    const normalizePhone = (raw: string): string => {
        let phone = raw.trim()
        if (phone.startsWith('+')) return phone
        if (phone.startsWith('0')) phone = phone.slice(1)
        const marketKey = typeof window !== 'undefined' ? getMarketKeyFromHostname(window.location.hostname) : ''
        const code = MARKET_PHONE_CODES[marketKey] || MARKET_PHONE_CODES[formData.country]
        if (code) return code + ' ' + phone
        return raw
    }

    const handleSendPhoneCode = async () => {
        setLoading(true); setError('')
        const normalized = normalizePhone(formData.phone)
        if (normalized !== formData.phone) {
            setFormData(prev => ({ ...prev, phone: normalized }))
        }
        const res = await fetch('/api/validate/phone', { method: 'POST', body: JSON.stringify({ phone: normalized }) })
        const data = await res.json()
        setLoading(false)
        if (data.success) {
            setPhoneCodeSent(true)
        } else setError(data.error)
    }

    const handleVerifyPhone = async () => {
        setLoading(true); setError('')
        try {
            const res = await fetch('/api/validate/phone/verify', {
                method: 'POST',
                body: JSON.stringify({ phone: formData.phone, code: formData.phoneCode })
            })
            const data = await res.json()
            if (data.success) setPhoneVerified(true)
            else setError(data.error || t('errors.invalidCode'))
        } catch (err) {
            setError(t('errors.verificationFailed'))
        } finally {
            setLoading(false)
        }
    }

    // FINAL SUBMIT (Real Auth)
    const handleSubmit = async () => {
        setLoading(true)
        setError('')

        try {
            const result = await registerB2BUserAction({
                ...formData,
                extraShippingAddress: addShipping ? shippingAddr : null,
                extraBillingAddress: addBilling ? billingAddr : null,
            })
            if (!result.success) throw new Error(result.error)

            // Auto sign-in so the customer is logged in immediately after registration
            const supabase = createClient()
            await supabase.auth.signInWithPassword({ email: formData.email, password: formData.password })

            router.push('/auth/welcome')
        } catch (err: any) {
            setError(err.message || t('errors.registrationFailed'))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto py-6">
            <div className="text-center mb-10">
                <h2 className="text-4xl font-extrabold text-gray-900 tracking-tight">{t('b2bTitle')}</h2>
                <p className="mt-2 text-gray-500 font-medium">{t('b2bSubtitle')}</p>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-6 text-sm flex items-center gap-2">⚠️ {error}</div>}

            {/* VAT country mismatch notification */}
            {vatMismatch && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 mb-6 space-y-3">
                    <div className="flex items-start gap-3">
                        <span className="text-2xl">🌍</span>
                        <div>
                            <p className="font-bold text-amber-900 text-sm">
                                This VAT number is registered in <strong>{vatMismatch.vatCountry}</strong>, not on this domain.
                            </p>
                            <p className="text-amber-700 text-xs mt-1">
                                This domain (<strong>{typeof window !== 'undefined' ? window.location.hostname : ''}</strong>) is exclusively for companies with a VAT registration in this country.
                                Your <strong>{vatMismatch.vatCountry}</strong> VAT number must be registered on the correct regional store.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <a
                            href={vatMismatch.redirectUrl}
                            className="flex-1 text-center bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 px-4 rounded-lg text-sm transition-colors"
                        >
                            Go to {vatMismatch.targetDomain} →
                        </a>
                        <button
                            type="button"
                            onClick={() => setVatMismatch(null)}
                            className="flex-1 text-center bg-white border border-amber-300 text-amber-700 font-medium py-2.5 px-4 rounded-lg text-sm hover:bg-amber-50 transition-colors"
                        >
                            Enter a different VAT number
                        </button>
                    </div>
                    <p className="text-[10px] text-amber-600 italic">
                        If your country is not listed as a separate domain, <a href={`https://tigoenergy.shop/auth/register?type=b2b&vat=${vatMismatch.vatCountry ? formData.vatNumber : ''}`} className="underline font-semibold">register on tigoenergy.shop</a> — our international store that accepts all EU VAT numbers.
                    </p>
                </div>
            )}

            {/* STEP 1: VAT */}
            <StepCard number={1} title={t('steps.vat')} isActive={step === 1} isCompleted={step > 1} setStep={setStep}>
                <div className="space-y-4">
                    <p className="text-sm text-gray-500 italic pb-2">
                        {t('messages.euNote')}
                    </p>
                    <div className="flex gap-2">
                        <input
                            id="reg-vat"
                            name="vatNumber"
                            type="text"
                            placeholder={t('placeholders.vat')}
                            value={formData.vatNumber}
                            onChange={e => { setFormData({ ...formData, vatNumber: e.target.value.toUpperCase() }); setVatMismatch(null) }}
                            className="flex-1 border p-2.5 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none font-mono"
                        />
                        <button
                            type="button"
                            onClick={handleValidateVat}
                            disabled={loading || !formData.vatNumber}
                            className="bg-gray-900 text-white px-4 rounded-lg hover:bg-black disabled:opacity-50 transition-colors"
                        >
                            {loading ? t('buttons.sending') : t('buttons.verifyVat')}
                        </button>
                    </div>
                    <p className="text-[10px] text-gray-400">
                        {t('messages.vatFormat')}
                    </p>
                    <div className="pt-4 border-t">
                        <button type="button" onClick={() => setStep(2)} className="text-xs text-blue-600 hover:underline">
                            {t('messages.nonEu')}
                        </button>
                        <p className="text-[10px] text-gray-400 mt-1 italic">
                            {t('messages.vatFallback')}
                        </p>
                    </div>
                </div>
            </StepCard>

            {/* STEP 2: Company Details */}
            <StepCard number={2} title={t('steps.company')} isActive={step === 2} isCompleted={step > 2} setStep={setStep}>
                <div className="space-y-4">
                    {!vatVerified && (
                        <div className="bg-yellow-50 p-3 rounded border border-yellow-100 mb-4">
                            <p className="text-[11px] text-yellow-700">
                                {t('messages.nonEuNote')}
                            </p>
                        </div>
                    )}
                    <div>
                        <label htmlFor="reg-company" className="block text-xs font-medium text-gray-500 mb-1">{t('labels.companyName')}</label>
                        <input id="reg-company" name="companyName" className="w-full border p-2.5 rounded-lg" value={formData.companyName} onChange={e => setFormData({ ...formData, companyName: e.target.value })} />
                    </div>
                    {!vatVerified && (
                        <div>
                            <label htmlFor="reg-taxid" className="block text-xs font-medium text-gray-500 mb-1">Tax ID / Registration #</label>
                            <input id="reg-taxid" name="vatNumber" placeholder={t('placeholders.taxId')} className="w-full border p-2.5 rounded-lg" value={formData.vatNumber} onChange={e => setFormData({ ...formData, vatNumber: e.target.value })} />
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="reg-website" className="block text-xs font-medium text-gray-500 mb-1">{t('labels.website')}</label>
                            <input id="reg-website" name="website" placeholder="https://..." className="w-full border p-2.5 rounded-lg" value={formData.website} onChange={e => setFormData({ ...formData, website: e.target.value })} />
                        </div>
                        <div>
                            <label htmlFor="reg-employees" className="block text-xs font-medium text-gray-500 mb-1">{t('labels.employees')}</label>
                            <select id="reg-employees" name="employees" className="w-full border p-2.5 rounded-lg bg-white" value={formData.employees} onChange={e => setFormData({ ...formData, employees: e.target.value })}>
                                <option value="">{t('placeholders.select')}</option>
                                <option value="1-5">1-5</option>
                                <option value="6-20">6-20</option>
                                <option value="21-100">21-100</option>
                                <option value="100+">100+</option>
                            </select>
                        </div>
                    </div>

                    {/* VIES Registered Address — locked */}
                    <div className="pt-2">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-bold text-gray-700">{t('labels.address')}</h4>
                            {vatVerified && (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                    🔒 VIES Verified
                                </span>
                            )}
                        </div>

                        {vatVerified && viesAddress ? (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1">
                                <p className="text-[10px] text-gray-400 mb-2">{t('messages.viesLocked')}</p>
                                <p className="text-sm font-medium text-gray-800">{viesAddress.street || '—'}</p>
                                <p className="text-sm text-gray-600">{[viesAddress.postalCode, viesAddress.city].filter(Boolean).join(' ')}</p>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{viesAddress.country}</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <input
                                    ref={addressInputRef}
                                    placeholder={t('labels.address')}
                                    className="w-full border p-2.5 rounded-lg"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                />
                                <div className="flex gap-3">
                                    <input placeholder={t('labels.city')} className="flex-1 border p-2.5 rounded-lg" value={formData.city} onChange={e => setFormData({ ...formData, city: e.target.value })} />
                                    <input placeholder={t('labels.zip')} className="w-24 border p-2.5 rounded-lg" value={formData.postalCode} onChange={e => setFormData({ ...formData, postalCode: e.target.value })} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Optional: Separate Shipping Address */}
                    <div className="border rounded-lg overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setAddShipping(v => !v)}
                            className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                            <span>📦 {t('messages.addShipping')}</span>
                            <span className="text-gray-400">{addShipping ? '▲' : '▼'}</span>
                        </button>
                        {addShipping && (
                            <div className="p-4 space-y-3 bg-white">
                                <input
                                    ref={shippingRef}
                                    placeholder="Street address"
                                    className="w-full border p-2.5 rounded-lg text-sm"
                                    value={shippingAddr.street}
                                    onChange={e => setShippingAddr(a => ({ ...a, street: e.target.value }))}
                                />
                                <div className="flex gap-3">
                                    <input placeholder="City" className="flex-1 border p-2.5 rounded-lg text-sm" value={shippingAddr.city} onChange={e => setShippingAddr(a => ({ ...a, city: e.target.value }))} />
                                    <input placeholder="ZIP" className="w-24 border p-2.5 rounded-lg text-sm" value={shippingAddr.postalCode} onChange={e => setShippingAddr(a => ({ ...a, postalCode: e.target.value }))} />
                                    <input placeholder="Country" className="w-24 border p-2.5 rounded-lg text-sm uppercase" value={shippingAddr.country} onChange={e => setShippingAddr(a => ({ ...a, country: e.target.value.toUpperCase() }))} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Optional: Separate Billing Address */}
                    <div className="border rounded-lg overflow-hidden">
                        <button
                            type="button"
                            onClick={() => setAddBilling(v => !v)}
                            className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                            <span>🧾 {t('messages.addBilling')}</span>
                            <span className="text-gray-400">{addBilling ? '▲' : '▼'}</span>
                        </button>
                        {addBilling && (
                            <div className="p-4 space-y-3 bg-white">
                                <input
                                    ref={billingRef}
                                    placeholder="Street address"
                                    className="w-full border p-2.5 rounded-lg text-sm"
                                    value={billingAddr.street}
                                    onChange={e => setBillingAddr(a => ({ ...a, street: e.target.value }))}
                                />
                                <div className="flex gap-3">
                                    <input placeholder="City" className="flex-1 border p-2.5 rounded-lg text-sm" value={billingAddr.city} onChange={e => setBillingAddr(a => ({ ...a, city: e.target.value }))} />
                                    <input placeholder="ZIP" className="w-24 border p-2.5 rounded-lg text-sm" value={billingAddr.postalCode} onChange={e => setBillingAddr(a => ({ ...a, postalCode: e.target.value }))} />
                                    <input placeholder="Country" className="w-24 border p-2.5 rounded-lg text-sm uppercase" value={billingAddr.country} onChange={e => setBillingAddr(a => ({ ...a, country: e.target.value.toUpperCase() }))} />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-50 p-3 rounded-lg border">
                        <p className="text-xs font-medium mb-2">{t('labels.commercialAccess')}</p>
                        <p className="text-[10px] text-gray-500 mb-3">
                            {t('labels.truckAccess')}
                        </p>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, commercialAccess: true })}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold border-2 transition-all ${formData.commercialAccess === true ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}
                            >
                                {t('labels.truckYes')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, commercialAccess: false })}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold border-2 transition-all ${formData.commercialAccess === false ? 'border-red-400 bg-red-50 text-red-600' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}
                            >
                                {t('labels.truckNo')}
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setStep(1)} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-200 border">{t('buttons.back')}</button>
                        <button type="button" onClick={() => setStep(3)} className="flex-[2] bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 transition-all shadow-sm">{t('buttons.continue')}</button>
                    </div>
                </div>
            </StepCard>

            {/* STEP 3: Business Type & Logistics */}
            <StepCard number={3} title={t('steps.business')} isActive={step === 3} isCompleted={step > 3} setStep={setStep}>
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium mb-2">{t('labels.businessType')}</label>
                        <div className="grid grid-cols-2 gap-3">
                            {(['installer', 'reseller', 'distributor', 'other'] as const).map(type => (
                                <label key={type} className={`border rounded-lg p-3 cursor-pointer flex items-center gap-2 hover:bg-gray-50 ${formData.businessType === type ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}>
                                    <input type="radio" name="businessType" className="w-4 h-4" checked={formData.businessType === type} onChange={() => setFormData(prev => ({ ...prev, businessType: type }))} />
                                    <span className="text-sm font-medium">{t(`businessTypes.${type}`)}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button type="button" onClick={() => setStep(2)} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition-colors border">{t('buttons.back')}</button>
                        <button type="button" onClick={() => setStep(4)} className="flex-[2] bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700">{t('buttons.nextStep')}</button>
                    </div>
                </div>
            </StepCard>

            {/* STEP 4: Contact Verification (Simplified for brevity as logic is same as B2C) */}
            <StepCard number={4} title={t('steps.contact')} isActive={step === 4} isCompleted={step > 4} setStep={setStep}>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="b2b-fname" className="block text-xs font-medium text-gray-500 mb-1">{t('labels.firstName')}</label>
                            <input id="b2b-fname" placeholder={t('labels.firstName')} className="w-full border p-2.5 rounded-lg" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} />
                        </div>
                        <div>
                            <label htmlFor="b2b-lname" className="block text-xs font-medium text-gray-500 mb-1">{t('labels.lastName')}</label>
                            <input id="b2b-lname" placeholder={t('labels.lastName')} className="w-full border p-2.5 rounded-lg" value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="b2b-job" className="block text-xs font-medium text-gray-500 mb-1">{t('labels.jobTitle')}</label>
                        <input id="b2b-job" placeholder={t('labels.jobTitle')} className="w-full border p-2.5 rounded-lg" value={formData.jobTitle} onChange={e => setFormData({ ...formData, jobTitle: e.target.value })} />
                    </div>
                    <div>
                        <label htmlFor="b2b-email" className="block text-xs font-medium text-gray-500 mb-1">{t('labels.email')}</label>
                        <div className="flex gap-2">
                            <input id="b2b-email" type="email" placeholder={t('placeholders.email')} className="flex-1 border p-2.5 rounded-lg" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                            <button type="button" onClick={handleSendEmailCode} disabled={loading} className="bg-gray-900 text-white px-4 rounded-lg text-sm">
                                {emailCodeSent ? t('buttons.resendEmail') : t('buttons.sendCode')}
                            </button>
                        </div>
                    </div>

                    <div className="py-2">
                        <div ref={recaptchaRef}></div>
                    </div>
                    {emailCodeSent && !emailVerified && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 space-y-3">
                            <span className="text-xs font-medium text-blue-800 block italic">{t('messages.checkEmailCode')}</span>
                            <div className="flex gap-2 items-center">
                                <label htmlFor="email-verify-code" className="sr-only">{t('labels.code')}</label>
                                <input id="email-verify-code" name="emailCode" maxLength={6} placeholder="000000" className="w-32 border p-2.5 rounded-lg text-center font-mono tracking-widest" value={formData.emailCode} onChange={e => setFormData(prev => ({ ...prev, emailCode: e.target.value }))} />
                                <button type="button" onClick={handleVerifyEmail} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium">{t('buttons.verifyEmail')}</button>
                            </div>
                        </div>
                    )}
                    {emailVerified && <div className="text-amber-600 text-sm font-medium">✓ {t('messages.emailVerified')}</div>}

                    <div className="space-y-2">
                        <label htmlFor="contact-phone" className="text-xs font-medium text-gray-500">{t('labels.mobilePhone')}</label>
                        <div className="flex gap-2">
                            <input
                                id="contact-phone"
                                name="phone"
                                type="tel"
                                placeholder={t('placeholders.mobilePhone')}
                                className="flex-1 border p-2.5 rounded-lg"
                                value={formData.phone}
                                onChange={e => {
                                    let val = e.target.value
                                    const prefix = detectPhonePrefix(val)
                                    if (prefix) {
                                        const rest = val.slice(prefix.length).trim()
                                        if (rest.startsWith('0')) {
                                            val = prefix + ' ' + rest.slice(1)
                                        }
                                    }
                                    setFormData(prev => ({ ...prev, phone: val }))
                                }}
                            />
                            <button type="button" onClick={handleSendPhoneCode} disabled={loading || !formData.phone} className="bg-gray-900 text-white px-4 rounded-lg text-sm">
                                {phoneCodeSent ? t('buttons.resendSms') : t('buttons.sendSms')}
                            </button>
                        </div>
                    </div>
                    {phoneCodeSent && !phoneVerified && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 space-y-3">
                            <span className="text-xs font-medium text-blue-800 block italic">{t('messages.checkPhoneCode')}</span>
                            <div className="flex gap-2 items-center">
                                <label htmlFor="phone-verify-code" className="sr-only">{t('labels.code')}</label>
                                <input id="phone-verify-code" name="phoneCode" maxLength={6} placeholder="000000" className="w-32 border p-2.5 rounded-lg text-center font-mono tracking-widest" value={formData.phoneCode} onChange={e => setFormData(prev => ({ ...prev, phoneCode: e.target.value }))} />
                                <button type="button" onClick={handleVerifyPhone} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium">{t('buttons.verifyPhone')}</button>
                            </div>
                        </div>
                    )}
                    {phoneVerified && <div className="text-amber-600 text-sm font-medium">✓ {t('messages.phoneVerified')}</div>}

                    {(emailVerified && phoneVerified) && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-1 mt-4">
                            <div className="flex gap-3">
                                <button type="button" onClick={() => setStep(3)} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-200 transition-colors border">{t('buttons.back')}</button>
                                <button
                                    type="button"
                                    onClick={() => setStep(5)}
                                    className="flex-[2] bg-amber-600 text-white py-2.5 rounded-lg font-bold hover:bg-amber-700 transition-all shadow-sm"
                                >
                                    {t('buttons.continueToFinalStep')}
                                </button>
                            </div>
                        </div>
                    )}
                    {(!emailVerified || !phoneVerified) && (
                        <div className="pt-2">
                            <button type="button" onClick={() => setStep(3)} className="w-full text-xs text-gray-500 hover:text-gray-900 flex items-center justify-center gap-1 mt-2">
                                ← {t('buttons.backToBusinessType')}
                            </button>
                        </div>
                    )}
                </div>
            </StepCard>

            {/* STEP 5: Security & Submit */}
            <StepCard number={5} title={t('steps.security')} isActive={step === 5} isCompleted={step > 5} setStep={setStep}>
                <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label htmlFor="reg-password" className="text-xs font-medium text-gray-500">{t('labels.password')}</label>
                            <input id="reg-password" name="password" type="password" autoComplete="new-password" placeholder={t('placeholders.password')} className="w-full border p-2.5 rounded-lg" value={formData.password} onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                            <label htmlFor="reg-confirm" className="text-xs font-medium text-gray-500">{t('labels.confirmPassword')}</label>
                            <input id="reg-confirm" name="confirmPassword" type="password" autoComplete="new-password" placeholder={t('placeholders.confirmPassword')} className="w-full border p-2.5 rounded-lg" value={formData.confirmPassword} onChange={e => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))} />
                        </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-600 space-y-3">
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input type="checkbox" className="mt-1 w-4 h-4 text-blue-600 rounded" checked={formData.legitimate} onChange={e => setFormData(prev => ({ ...prev, legitimate: e.target.checked }))} />
                            <span className="font-bold text-gray-800">{t('agreements.legitimate')}</span>
                        </label>
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input type="checkbox" className="mt-1 w-4 h-4 text-blue-600 rounded" checked={formData.terms} onChange={e => setFormData(prev => ({ ...prev, terms: e.target.checked }))} />
                            <span>{t.rich('agreements.terms', { terms: (chunks) => <a href="/terms" target="_blank" className="text-blue-600 underline hover:text-blue-800">{chunks}</a>, aup: (chunks) => <a href="/terms#acceptable-use" target="_blank" className="text-blue-600 underline hover:text-blue-800">{chunks}</a> })}</span>
                        </label>
                        <label className="flex items-start gap-3 cursor-pointer">
                            <input type="checkbox" className="mt-1 w-4 h-4 text-blue-600 rounded" checked={formData.privacy} onChange={e => setFormData(prev => ({ ...prev, privacy: e.target.checked }))} />
                            <span>{t.rich('agreements.privacy', { privacy: (chunks) => <a href="/privacy" target="_blank" className="text-blue-600 underline hover:text-blue-800">{chunks}</a> })}</span>
                        </label>
                        <div className="border-t pt-2 mt-2">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input type="checkbox" className="mt-1 w-4 h-4 text-blue-600 rounded" checked={formData.newsletter} onChange={e => setFormData(prev => ({ ...prev, newsletter: e.target.checked }))} />
                                <span>{t('agreements.newsletter')}</span>
                            </label>
                            <label className="flex items-start gap-3 cursor-pointer mt-2">
                                <input type="checkbox" className="mt-1 w-4 h-4 text-blue-600 rounded" checked={formData.marketing} onChange={e => setFormData(prev => ({ ...prev, marketing: e.target.checked }))} />
                                <span>{t('agreements.marketing')}</span>
                            </label>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            type="button"
                            onClick={() => setStep(6)} // Changed to go to review step
                            disabled={!formData.terms || !formData.privacy || !formData.legitimate || loading}
                            className="w-full bg-blue-800 text-white py-3.5 rounded-xl font-bold text-lg hover:bg-blue-900 shadow-md transition-all disabled:opacity-50"
                        >
                            {t('buttons.continueToReview')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setStep(4)}
                            className="w-full py-2 text-sm text-gray-500 hover:text-gray-900 border border-transparent hover:border-gray-200 rounded-lg transition-all"
                        >
                            ← {t('buttons.backToContactPerson')}
                        </button>
                    </div>
                </div>
            </StepCard>

            {/* STEP 6: Review & Final Submit */}
            <StepCard number={6} title={t('steps.review')} isActive={step === 6} isCompleted={false} setStep={setStep}>
                <div className="space-y-6">
                    {/* B2B REVIEW SUMMARY */}
                    <div className="bg-gray-50 rounded-xl p-4 border text-[11px] space-y-3">
                        <h4 className="font-bold text-gray-700 border-b pb-2 uppercase tracking-wider">{t('agreements.reviewInfo')}</h4>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                            <div>
                                <span className="block text-gray-400 font-medium">{t('steps.company')}</span>
                                <span className="font-bold text-gray-800">{formData.companyName}</span>
                                <span className="block text-gray-500">{formData.vatNumber}</span>
                            </div>
                            <div>
                                <span className="block text-gray-400 font-medium">{t('steps.contact')}</span>
                                <span className="font-bold text-gray-800">{formData.firstName} {formData.lastName}</span>
                                <span className="block text-gray-500">{formData.email}</span>
                            </div>
                            <div>
                                <span className="block text-gray-400 font-medium">{t('labels.address')}</span>
                                {viesAddress ? (
                                    <>
                                        <span className="text-gray-700 block">{viesAddress.street}</span>
                                        <span className="text-gray-500 block">{[viesAddress.postalCode, viesAddress.city].filter(Boolean).join(' ')}, {viesAddress.country}</span>
                                    </>
                                ) : (
                                    <span className="text-gray-700">{formData.address}, {formData.city}, {formData.postalCode}</span>
                                )}
                            </div>
                            <div>
                                <span className="block text-gray-400 font-medium">{t('steps.business')}</span>
                                <span className="text-gray-700 font-bold">{formData.businessType}</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 rounded-xl text-xs text-gray-600 space-y-3 bg-blue-50/30 border border-blue-100">
                        <label className="flex items-start gap-3 cursor-pointer group">
                            <input id="b2b-terms" name="terms" type="checkbox" className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300" checked={formData.terms} onChange={e => setFormData(prev => ({ ...prev, terms: e.target.checked }))} />
                            <span className="group-hover:text-gray-900 transition-colors">{t.rich('agreements.terms', { terms: (chunks) => <a href="/terms" target="_blank" className="text-blue-600 underline hover:text-blue-800">{chunks}</a>, aup: (chunks) => <a href="/terms#acceptable-use" target="_blank" className="text-blue-600 underline hover:text-blue-800">{chunks}</a> })}</span>
                        </label>
                        <label className="flex items-start gap-3 cursor-pointer group">
                            <input id="b2b-privacy" name="privacy" type="checkbox" className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300" checked={formData.privacy} onChange={e => setFormData(prev => ({ ...prev, privacy: e.target.checked }))} />
                            <span className="group-hover:text-gray-900 transition-colors">{t.rich('agreements.privacy', { privacy: (chunks) => <a href="/privacy" target="_blank" className="text-blue-600 underline hover:text-blue-800">{chunks}</a> })}</span>
                        </label>
                        <label className="flex items-start gap-3 cursor-pointer group">
                            <input id="b2b-auth" name="authorized" type="checkbox" className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300" checked={formData.authorized} onChange={e => setFormData(prev => ({ ...prev, authorized: e.target.checked }))} />
                            <span className="group-hover:text-gray-900 transition-colors">{t('agreements.authorized')}</span>
                        </label>
                        <label className="flex items-start gap-3 cursor-pointer group">
                            <input id="b2b-legit" name="legitimate" type="checkbox" className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300" checked={formData.legitimate} onChange={e => setFormData(prev => ({ ...prev, legitimate: e.target.checked }))} />
                            <span className="group-hover:text-gray-900 transition-colors">{t('agreements.legitimate')}</span>
                        </label>
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!formData.terms || !formData.privacy || !formData.authorized || !formData.legitimate || loading}
                            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-100 transition-all transform hover:-translate-y-0.5"
                        >
                            {loading ? t('agreements.creating') : t('agreements.confirmCreate')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setStep(5)}
                            className="w-full py-2 text-sm text-gray-500 hover:text-gray-900 flex items-center justify-center gap-2"
                        >
                            ← {t('buttons.back')}
                        </button>
                    </div>
                </div>
            </StepCard>

        </div>
    )
}

// DEFINED OUTSIDE TO PREVENT RE-RENDERS LOSING FOCUS
const StepCard = ({ number, title, isActive, isCompleted, children, setStep }: any) => (
    <div className={`border rounded-xl mb-4 transition-all duration-300 ${isActive ? 'ring-2 ring-blue-600 shadow-lg bg-white' : 'bg-gray-50 opacity-70'}`}>
        <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => isCompleted && setStep(number)}>
            <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${isCompleted ? 'bg-blue-800 text-white' : isActive ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-500'}`}>
                    {isCompleted ? '✓' : number}
                </div>
                <h3 className={`font-semibold ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>{title}</h3>
            </div>
        </div>
        {isActive && <div className="p-4 pt-0">{children}</div>}
    </div>
)
