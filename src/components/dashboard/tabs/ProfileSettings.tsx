'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Customer } from '@/types/database'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useMarket } from '@/contexts/MarketContext'
import { SORTED_CURRENCIES } from '@/lib/constants/currencies'
import { LANGUAGES } from '@/lib/constants/languages'
import { getCustomerContacts, setDefaultContact, removeContact } from '@/app/actions/contacts'
import { CheckCircleIcon, PlusIcon, TrashIcon, StarIcon } from '@heroicons/react/24/solid'
import { StarIcon as StarOutlineIcon } from '@heroicons/react/24/outline'
import { useRecaptcha } from '@/hooks/useRecaptcha'
import { useTranslations } from 'next-intl'

interface Contact {
    id: string
    type: 'email' | 'phone'
    value: string
    is_default: boolean
    verified_at: string | null
}

interface Props {
    customer: Customer
}

export default function ProfileSettings({ customer }: Props) {
    const tGdpr = useTranslations('gdpr')
    const t = useTranslations('dashboard')
    const supabase = createClient()
    const { currentCurrency, setCurrency } = useCurrency()
    const { market, currentLanguage, setLanguage } = useMarket()
    const { recaptchaRef, execute: executeRecaptcha, resetRecaptcha } = useRecaptcha()
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState('')
    const [contacts, setContacts] = useState<Contact[]>([])
    const [showAddContact, setShowAddContact] = useState<'email' | 'phone' | null>(null)
    const [newContactValue, setNewContactValue] = useState('')
    const [verificationStep, setVerificationStep] = useState(false)
    const [verificationCode, setVerificationCode] = useState('')
    const [formData, setFormData] = useState({
        firstName: customer.first_name || '',
        lastName: customer.last_name || '',
        company: customer.company_name || '',
        website: '',
        employees: '',
    })
    // Password change state
    const [pwStep, setPwStep] = useState<'idle' | 'form' | 'code' | 'done'>('idle')
    const [pwCurrentPassword, setPwCurrentPassword] = useState('')
    const [pwNewPassword, setPwNewPassword] = useState('')
    const [pwConfirmPassword, setPwConfirmPassword] = useState('')
    const [pwCode, setPwCode] = useState('')
    const [pwLoading, setPwLoading] = useState(false)
    const [pwError, setPwError] = useState('')

    useEffect(() => {
        loadContacts()
        // Load website/employees from user_metadata
        supabase.auth.getUser().then(({ data }) => {
            if (data?.user?.user_metadata) {
                const m = data.user.user_metadata
                setFormData(prev => ({
                    ...prev,
                    website: m.website || '',
                    employees: m.employees || '',
                }))
            }
        })
    }, [])

    const loadContacts = async () => {
        const data = await getCustomerContacts(customer.id)
        setContacts(data as Contact[])
    }

    const handleSave = async () => {
        setLoading(true)
        setSuccess('')

        const [profileResult, metaResult] = await Promise.all([
            supabase
                .from('customers')
                .update({
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    company_name: formData.company,
                    updated_at: new Date().toISOString()
                })
                .eq('id', customer.id),
            supabase.auth.updateUser({
                data: {
                    website: formData.website || null,
                    employees: formData.employees || null,
                }
            })
        ])

        setLoading(false)

        if (profileResult.error || metaResult.error) {
            console.error(profileResult.error || metaResult.error)
            alert('Failed to update profile.')
        } else {
            setSuccess(t('profileUpdated'))
            setTimeout(() => setSuccess(''), 3000)
        }
    }

    const handleAddContact = async () => {
        if (!newContactValue) return
        setLoading(true)
        try {
            const token = showAddContact === 'email' ? await executeRecaptcha('REGISTRATION') : null
            const endpoint = showAddContact === 'email' ? '/api/validate/email' : '/api/validate/phone'
            const body = showAddContact === 'email'
                ? { email: newContactValue, recaptchaToken: token }
                : { phone: newContactValue }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })
            const data = await res.json()
            if (data.success) {
                setVerificationStep(true)
            } else {
                alert(data.error || 'Failed to send verification code')
                if (showAddContact === 'email') resetRecaptcha()
            }
        } catch (err) {
            alert('Error adding contact')
            if (showAddContact === 'email') resetRecaptcha()
        } finally {
            setLoading(false)
        }
    }

    const handleVerifyContact = async () => {
        if (!verificationCode) return
        setLoading(true)
        try {
            const endpoint = showAddContact === 'email' ? '/api/validate/email/verify' : '/api/validate/phone/verify'
            const body = showAddContact === 'email'
                ? { email: newContactValue, code: verificationCode }
                : { phone: newContactValue, code: verificationCode }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })
            const data = await res.json()

            if (data.success) {
                // Now permanently add to customer_contacts
                const { error } = await supabase.from('customer_contacts').insert({
                    customer_id: customer.id,
                    type: showAddContact,
                    value: newContactValue,
                    verified_at: new Date().toISOString(),
                    is_default: contacts.filter(c => c.type === showAddContact).length === 0
                })

                if (error) throw error

                await loadContacts()
                setShowAddContact(null)
                setNewContactValue('')
                setVerificationStep(false)
                setVerificationCode('')
                setSuccess(`${showAddContact === 'email' ? 'Email' : 'Phone'} added successfully!`)
            } else {
                alert(data.error || 'Verification failed')
            }
        } catch (err) {
            alert('Error during verification')
        } finally {
            setLoading(false)
        }
    }

    const handlePasswordSendCode = async () => {
        setPwError('')
        if (pwNewPassword.length < 8) {
            setPwError(t('pwMinLength') || 'Password must be at least 8 characters')
            return
        }
        if (pwNewPassword !== pwConfirmPassword) {
            setPwError(t('pwMismatch') || 'Passwords do not match')
            return
        }
        setPwLoading(true)
        try {
            const res = await fetch('/api/account/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'send-code' }),
            })
            const data = await res.json()
            if (data.success) {
                setPwStep('code')
            } else {
                setPwError(data.error || 'Failed to send code')
            }
        } catch {
            setPwError('Network error')
        } finally {
            setPwLoading(false)
        }
    }

    const handlePasswordVerifyAndChange = async () => {
        setPwError('')
        if (!pwCode || pwCode.length !== 6) {
            setPwError(t('pwInvalidCode') || 'Enter the 6-digit code')
            return
        }
        setPwLoading(true)
        try {
            const res = await fetch('/api/account/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'verify-and-change',
                    code: pwCode,
                    currentPassword: pwCurrentPassword || undefined,
                    newPassword: pwNewPassword,
                }),
            })
            const data = await res.json()
            if (data.success) {
                setPwStep('done')
                setPwCurrentPassword('')
                setPwNewPassword('')
                setPwConfirmPassword('')
                setPwCode('')
            } else {
                setPwError(data.error || 'Failed to change password')
            }
        } catch {
            setPwError('Network error')
        } finally {
            setPwLoading(false)
        }
    }

    const resetPasswordFlow = () => {
        setPwStep('idle')
        setPwCurrentPassword('')
        setPwNewPassword('')
        setPwConfirmPassword('')
        setPwCode('')
        setPwError('')
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                {t('personalDetails')}
            </h2>

            <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('firstName')}</label>
                        <input
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.firstName}
                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('lastName')}</label>
                        <input
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.lastName}
                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        />
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8 py-6 border-t border-gray-100">
                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-gray-900">{t('emailAddresses')}</h3>
                            {contacts.filter(c => c.type === 'email').length < 2 && (
                                <button onClick={() => setShowAddContact('email')} className="text-green-600 hover:text-green-700 p-1 rounded-full hover:bg-green-50 transition">
                                    <PlusIcon className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                        <div className="space-y-3">
                            {contacts.filter(c => c.type === 'email').map(contact => (
                                <div key={contact.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-sm font-medium text-gray-700 truncate">{contact.value}</span>
                                        {contact.verified_at && <CheckCircleIcon className="w-4 h-4 text-green-500 shrink-0" />}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setDefaultContact(customer.id, contact.id, 'email').then(() => loadContacts())}
                                            className={`p-1.5 rounded-lg transition ${contact.is_default ? 'text-orange-500' : 'text-gray-400 hover:text-orange-400'}`}
                                            title={contact.is_default ? "Default Email" : "Set as Default"}
                                        >
                                            {contact.is_default ? <StarIcon className="w-5 h-5" /> : <StarOutlineIcon className="w-5 h-5" />}
                                        </button>
                                        {!contact.is_default && (
                                            <button
                                                onClick={() => removeContact(customer.id, contact.id).then(() => loadContacts())}
                                                className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition"
                                            >
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-gray-900">{t('phoneNumbers')}</h3>
                            {contacts.filter(c => c.type === 'phone').length < 2 && (
                                <button onClick={() => setShowAddContact('phone')} className="text-green-600 hover:text-green-700 p-1 rounded-full hover:bg-green-50 transition">
                                    <PlusIcon className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                        <div className="space-y-3">
                            {contacts.filter(c => c.type === 'phone').map(contact => (
                                <div key={contact.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-sm font-medium text-gray-700 truncate">{contact.value}</span>
                                        {contact.verified_at && <CheckCircleIcon className="w-4 h-4 text-green-500 shrink-0" />}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setDefaultContact(customer.id, contact.id, 'phone').then(() => loadContacts())}
                                            className={`p-1.5 rounded-lg transition ${contact.is_default ? 'text-orange-500' : 'text-gray-400 hover:text-orange-400'}`}
                                            title={contact.is_default ? "Default Phone" : "Set as Default"}
                                        >
                                            {contact.is_default ? <StarIcon className="w-5 h-5" /> : <StarOutlineIcon className="w-5 h-5" />}
                                        </button>
                                        {!contact.is_default && (
                                            <button
                                                onClick={() => removeContact(customer.id, contact.id).then(() => loadContacts())}
                                                className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition"
                                            >
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Add Contact Modal/Overlay */}
                {showAddContact && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-8">
                                <h3 className="text-xl font-bold text-gray-900 mb-2">
                                    {verificationStep ? t('verifyContact', { type: showAddContact === 'email' ? t('addEmail') : t('addPhone') }) : t('addContact', { type: showAddContact === 'email' ? t('addEmail') : t('addPhone') })}
                                </h3>
                                <p className="text-sm text-gray-500 mb-6">
                                    {verificationStep
                                        ? t('codeSentTo', { value: newContactValue })
                                        : t('enterNewContact', { type: showAddContact || '' })}
                                </p>

                                {!verificationStep ? (
                                    <div className="space-y-4">
                                        <input
                                            type={showAddContact === 'email' ? 'email' : 'tel'}
                                            placeholder={showAddContact === 'email' ? 'new@email.com' : '+00 000 000 000'}
                                            className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
                                            value={newContactValue}
                                            onChange={(e) => setNewContactValue(e.target.value)}
                                        />
                                        <div className="flex gap-3 pt-2">
                                            <button onClick={() => setShowAddContact(null)} className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition">{t('cancel')}</button>
                                            <button
                                                onClick={handleAddContact}
                                                disabled={loading || !newContactValue}
                                                className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition disabled:opacity-50"
                                            >
                                                {loading ? t('sending') : t('sendCode')}
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <input
                                            maxLength={6}
                                            placeholder="000000"
                                            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest outline-none focus:ring-2 focus:ring-green-500"
                                            value={verificationCode}
                                            onChange={(e) => setVerificationCode(e.target.value)}
                                        />
                                        <div className="flex gap-3 pt-2">
                                            <button onClick={() => { setVerificationStep(false); setVerificationCode('') }} className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition">{t('back')}</button>
                                            <button
                                                onClick={handleVerifyContact}
                                                disabled={loading || verificationCode.length < 6}
                                                className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition disabled:opacity-50"
                                            >
                                                {loading ? t('verifying') : t('verify')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {customer.is_b2b && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('companyName')}</label>
                            <input
                                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.company}
                                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                            />
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('companyWebsite')}</label>
                                <input
                                    type="url"
                                    placeholder="https://..."
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                                    value={formData.website}
                                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t('numEmployees')}</label>
                                <select
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    value={formData.employees}
                                    onChange={(e) => setFormData({ ...formData, employees: e.target.value })}
                                >
                                    <option value="">{t('select')}</option>
                                    <option value="1-5">1–5</option>
                                    <option value="6-20">6–20</option>
                                    <option value="21-100">21–100</option>
                                    <option value="100+">100+</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}

                <div className="pt-6 border-t mt-2">
                    <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" /></svg>
                        {t('regionalSettings')}
                    </h3>

                    {/* Market info (always shown) */}
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span className="text-lg">{market.flag}</span>
                            <span className="font-medium">{market.countryName}</span>
                            <span className="text-gray-400">|</span>
                            <span>VAT {(market.vatRate * 100).toFixed(1)}%</span>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Currency — editable only for picker markets */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('currency')}</label>
                            {market.hasCurrencyPicker ? (
                                <select
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    value={currentCurrency.code}
                                    onChange={(e) => setCurrency(e.target.value)}
                                >
                                    {SORTED_CURRENCIES.map(curr => (
                                        <option key={curr.code} value={curr.code}>
                                            {curr.flag} {curr.code} - {curr.name} ({curr.symbol})
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <div className="w-full border border-gray-200 rounded-lg px-4 py-2.5 bg-gray-50 text-gray-600">
                                    {currentCurrency.flag} {currentCurrency.code} - {currentCurrency.name} ({currentCurrency.symbol})
                                </div>
                            )}
                            <p className="mt-2 text-xs text-gray-500">
                                {market.hasCurrencyPicker
                                    ? t('currencyDesc')
                                    : t('currencyLockedDesc', { market: market.countryName })}
                            </p>
                        </div>

                        {/* Language — editable only for picker markets */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t('language')}</label>
                            {market.hasLanguagePicker ? (
                                <select
                                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    value={currentLanguage.code}
                                    onChange={(e) => setLanguage(e.target.value)}
                                >
                                    {market.availableLanguages.map(code => {
                                        const lang = LANGUAGES[code]
                                        if (!lang) return null
                                        return (
                                            <option key={code} value={code}>
                                                {lang.flag} {lang.nativeName} ({lang.name})
                                            </option>
                                        )
                                    })}
                                </select>
                            ) : (
                                <div className="w-full border border-gray-200 rounded-lg px-4 py-2.5 bg-gray-50 text-gray-600">
                                    {currentLanguage.flag} {currentLanguage.nativeName} ({currentLanguage.name})
                                </div>
                            )}
                            <p className="mt-2 text-xs text-gray-500">
                                {market.hasLanguagePicker
                                    ? t('languageDesc')
                                    : t('languageLockedDesc', { market: market.countryName })}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="pt-2 border-t mt-2">
                    <p className="text-xs font-bold text-gray-500 mb-4 uppercase tracking-wider">{t('accountSecurity')}</p>

                    {/* Change Password Section */}
                    <div className="mb-6">
                        {pwStep === 'idle' && (
                            <button
                                onClick={() => setPwStep('form')}
                                className="text-sm font-medium text-blue-600 hover:underline"
                            >
                                {t('changePassword')}
                            </button>
                        )}

                        {pwStep === 'form' && (
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-3 max-w-md">
                                <p className="text-sm font-bold text-gray-800">{t('changePassword')}</p>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">{t('pwCurrent') || 'Current Password'}</label>
                                    <input
                                        type="password"
                                        value={pwCurrentPassword}
                                        onChange={e => setPwCurrentPassword(e.target.value)}
                                        placeholder={t('pwCurrentPlaceholder') || 'Leave blank if set by admin'}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-0.5">{t('pwCurrentHint') || 'Leave blank if your account was created by admin'}</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">{t('pwNew') || 'New Password'}</label>
                                    <input
                                        type="password"
                                        value={pwNewPassword}
                                        onChange={e => setPwNewPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">{t('pwConfirm') || 'Confirm New Password'}</label>
                                    <input
                                        type="password"
                                        value={pwConfirmPassword}
                                        onChange={e => setPwConfirmPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                {pwError && <p className="text-xs text-red-600 font-medium">{pwError}</p>}
                                <div className="flex gap-2 pt-1">
                                    <button
                                        onClick={handlePasswordSendCode}
                                        disabled={pwLoading || !pwNewPassword || !pwConfirmPassword}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition disabled:opacity-50"
                                    >
                                        {pwLoading ? '...' : t('pwSendCode') || 'Send Verification Code'}
                                    </button>
                                    <button
                                        onClick={resetPasswordFlow}
                                        className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50"
                                    >
                                        {t('cancel') || 'Cancel'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {pwStep === 'code' && (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3 max-w-md">
                                <p className="text-sm font-bold text-blue-800">{t('pwEnterCode') || 'Enter Verification Code'}</p>
                                <p className="text-xs text-blue-600">{t('pwCodeSent') || 'A 6-digit code has been sent to your email. Enter it below to confirm the password change.'}</p>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={pwCode}
                                    onChange={e => setPwCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="000000"
                                    className="w-full px-4 py-3 border border-blue-300 rounded-lg text-center text-2xl font-mono tracking-[0.5em] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    autoFocus
                                />
                                {pwError && <p className="text-xs text-red-600 font-medium">{pwError}</p>}
                                <div className="flex gap-2 pt-1">
                                    <button
                                        onClick={handlePasswordVerifyAndChange}
                                        disabled={pwLoading || pwCode.length !== 6}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition disabled:opacity-50"
                                    >
                                        {pwLoading ? '...' : t('pwVerifyChange') || 'Verify & Change Password'}
                                    </button>
                                    <button
                                        onClick={handlePasswordSendCode}
                                        disabled={pwLoading}
                                        className="px-4 py-2 border border-blue-300 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100"
                                    >
                                        {t('pwResend') || 'Resend Code'}
                                    </button>
                                    <button
                                        onClick={resetPasswordFlow}
                                        className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50"
                                    >
                                        {t('cancel') || 'Cancel'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {pwStep === 'done' && (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-5 max-w-md">
                                <p className="text-sm font-bold text-green-800">{t('pwChanged') || 'Password changed successfully!'}</p>
                                <p className="text-xs text-green-600 mt-1">{t('pwChangedHint') || 'Your new password is now active. Use it next time you sign in.'}</p>
                                <button
                                    onClick={resetPasswordFlow}
                                    className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition"
                                >
                                    {t('done') || 'Done'}
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-4 items-center">
                        <button className="text-sm font-medium text-blue-600 hover:underline">{t('changeEmail')}</button>
                        <span className="text-gray-300">|</span>
                        <button
                            onClick={async () => {
                                if (confirm(t('deleteConfirm'))) {
                                    if (confirm(t('deleteConfirmFinal'))) {
                                        const { deleteAccount } = await import('@/app/actions/user')
                                        const res = await deleteAccount()
                                        if (res?.success) {
                                            await supabase.auth.signOut()
                                            window.location.href = '/'
                                        }
                                    }
                                }
                            }}
                            className="text-sm font-bold text-red-600 hover:text-red-800 hover:underline"
                        >
                            {t('deleteAccount')}
                        </button>
                    </div>

                    <div className="mt-6 p-4 rounded-xl bg-gray-50 border border-gray-100">
                        <p className="text-xs font-bold text-gray-700 mb-1">{tGdpr('title')}</p>
                        <p className="text-[11px] text-gray-500 mb-3">
                            {tGdpr('description')}
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <a
                                href="/api/gdpr/export"
                                download
                                className="text-xs font-bold px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-100 transition shadow-sm"
                            >
                                {tGdpr('downloadData')}
                            </a>
                        </div>
                    </div>
                </div>

                <div className="pt-4 flex items-center gap-4">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="bg-gray-900 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-black transition disabled:opacity-50"
                    >
                        {loading ? t('saving') : t('updateProfile')}
                    </button>
                    {success && <span className="text-green-600 font-medium text-sm animate-in fade-in">{success}</span>}
                </div>
            </div>
            {/* Hidden reCAPTCHA badge container */}
            <div ref={recaptchaRef}></div>
        </div>
    )
}
