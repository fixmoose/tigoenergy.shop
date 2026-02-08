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
        company: customer.company_name || ''
    })

    useEffect(() => {
        loadContacts()
    }, [])

    const loadContacts = async () => {
        const data = await getCustomerContacts(customer.id)
        setContacts(data as Contact[])
    }

    const handleSave = async () => {
        setLoading(true)
        setSuccess('')

        const { error } = await supabase
            .from('customers')
            .update({
                first_name: formData.firstName,
                last_name: formData.lastName,
                company_name: formData.company,
                updated_at: new Date().toISOString()
            })
            .eq('id', customer.id)

        setLoading(false)

        if (error) {
            console.error(error)
            alert('Failed to update profile.')
        } else {
            setSuccess('Profile updated successfully!')
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

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                Personal Details
            </h2>

            <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                        <input
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.firstName}
                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
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
                            <h3 className="text-sm font-bold text-gray-900">Email Addresses</h3>
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
                            <h3 className="text-sm font-bold text-gray-900">Phone Numbers</h3>
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
                                    {verificationStep ? 'Verify ' : 'Add '} {showAddContact === 'email' ? 'Email' : 'Phone'}
                                </h3>
                                <p className="text-sm text-gray-500 mb-6">
                                    {verificationStep
                                        ? `We sent a code to ${newContactValue}`
                                        : `Enter your new ${showAddContact} and we'll send a code.`}
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
                                            <button onClick={() => setShowAddContact(null)} className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition">Cancel</button>
                                            <button
                                                onClick={handleAddContact}
                                                disabled={loading || !newContactValue}
                                                className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition disabled:opacity-50"
                                            >
                                                {loading ? 'Sending...' : 'Send Code'}
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
                                            <button onClick={() => { setVerificationStep(false); setVerificationCode('') }} className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition">Back</button>
                                            <button
                                                onClick={handleVerifyContact}
                                                disabled={loading || verificationCode.length < 6}
                                                className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition disabled:opacity-50"
                                            >
                                                {loading ? 'Verifying...' : 'Verify'}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {customer.is_b2b && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                        <input
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.company}
                            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        />
                    </div>
                )}

                <div className="pt-6 border-t mt-2">
                    <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" /></svg>
                        Regional Settings
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
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
                                    ? 'Used for all price displays across the store.'
                                    : `Currency is set by your market (${market.countryName}).`}
                            </p>
                        </div>

                        {/* Language — editable only for picker markets */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
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
                                    ? 'Selected language will be used for emails and documents.'
                                    : `Language is set by your market (${market.countryName}).`}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="pt-2 border-t mt-2">
                    <p className="text-xs text-gray-500 mb-4">Account Security & Actions</p>
                    <div className="flex flex-wrap gap-4 items-center">
                        <button className="text-sm font-medium text-blue-600 hover:underline">Change Email</button>
                        <span className="text-gray-300">|</span>
                        <button className="text-sm font-medium text-blue-600 hover:underline">Change Password</button>
                        <span className="text-gray-300">|</span>
                        <button
                            onClick={async () => {
                                if (confirm('Are you sure you want to delete your account?')) {
                                    if (confirm('This action cannot be undone. All your data will be permanently removed. Are you REALLY sure?')) {
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
                            Delete Account
                        </button>
                    </div>
                </div>

                <div className="pt-4 flex items-center gap-4">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="bg-gray-900 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-black transition disabled:opacity-50"
                    >
                        {loading ? 'Saving...' : 'Update Profile'}
                    </button>
                    {success && <span className="text-green-600 font-medium text-sm animate-in fade-in">{success}</span>}
                </div>
            </div>
            {/* Hidden reCAPTCHA badge container */}
            <div ref={recaptchaRef}></div>
        </div>
    )
}
