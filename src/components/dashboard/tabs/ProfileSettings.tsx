'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Customer } from '@/types/database'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useMarket } from '@/contexts/MarketContext'
import { SORTED_CURRENCIES } from '@/lib/constants/currencies'
import { LANGUAGES } from '@/lib/constants/languages'

interface Props {
    customer: Customer
}

export default function ProfileSettings({ customer }: Props) {
    const supabase = createClient()
    const { currentCurrency, setCurrency } = useCurrency()
    const { market, currentLanguage, setLanguage } = useMarket()
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState('')
    const [formData, setFormData] = useState({
        firstName: customer.first_name || '',
        lastName: customer.last_name || '',
        phone: customer.phone || '',
        company: customer.company_name || ''
    })

    const handleSave = async () => {
        setLoading(true)
        setSuccess('')

        const { error } = await supabase
            .from('customers')
            .update({
                first_name: formData.firstName,
                last_name: formData.lastName,
                phone: formData.phone,
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

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                    <input
                        type="tel"
                        className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                </div>

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
        </div>
    )
}
