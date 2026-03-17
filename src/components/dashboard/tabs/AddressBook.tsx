'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Customer } from '@/types/database'
import { useAddressAutocomplete } from '@/hooks/useAddressAutocomplete'
import { useTranslations } from 'next-intl'
import { MARKETS } from '@/lib/constants/markets'

// Client-side country normalizer
const COUNTRY_LOOKUP: Record<string, string> = Object.fromEntries(
    Object.values(MARKETS).flatMap(c => [
        [c.countryName.toUpperCase(), c.country],
        [c.country.toUpperCase(), c.country],
    ])
)
function normalizeCountry(val: string): string {
    if (!val) return val
    return COUNTRY_LOOKUP[val.toUpperCase()] || val
}

interface Props {
    customer: Customer
}

interface Address {
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

export default function AddressBook({ customer }: Props) {
    const supabase = createClient()
    const [addresses, setAddresses] = useState<Address[]>(customer.addresses || [])
    const [showForm, setShowForm] = useState(false)
    const [newAddress, setNewAddress] = useState<Partial<Address>>({})
    const t = useTranslations('dashboard')

    const { inputRef: addressInputRef } = useAddressAutocomplete((parsed) => {
        setNewAddress(prev => ({
            ...prev,
            street: parsed.street,
            city: parsed.city,
            postalCode: parsed.postal_code,
            country: normalizeCountry(parsed.country)
        }))
    })

    const handleSaveAddress = async () => {
        const address: Address = {
            id: Math.random().toString(36).substr(2, 9),
            street: newAddress.street || '',
            city: newAddress.city || '',
            postalCode: newAddress.postalCode || '',
            country: normalizeCountry(newAddress.country || 'SI'),
            isDefaultShipping: addresses.length === 0,
            isDefaultBilling: addresses.length === 0
        }

        const updatedAddresses = [...addresses, address]

        // Save to DB
        const { error } = await supabase
            .from('customers')
            .update({
                addresses: updatedAddresses,
                updated_at: new Date().toISOString()
            })
            .eq('id', customer.id)

        if (!error) {
            setAddresses(updatedAddresses)
            setShowForm(false)
            setNewAddress({})
        } else {
            alert('Error saving address')
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm(t('areYouSure'))) return

        const updatedAddresses = addresses.filter(a => a.id !== id)
        const { error } = await supabase
            .from('customers')
            .update({ addresses: updatedAddresses })
            .eq('id', customer.id)

        if (!error) setAddresses(updatedAddresses)
    }

    const handleSetDefaultShipping = async (id: string) => {
        const target = addresses.find(a => a.id === id)
        if (target?.isViesAddress) return // VIES addresses cannot be default shipping
        const updatedAddresses = addresses.map(a => ({
            ...a,
            isDefaultShipping: a.id === id && !a.isViesAddress,
        }))
        const { error } = await supabase
            .from('customers')
            .update({ addresses: updatedAddresses, updated_at: new Date().toISOString() })
            .eq('id', customer.id)

        if (!error) setAddresses(updatedAddresses)
    }

    const handleSetDefaultBilling = async (id: string) => {
        const updatedAddresses = addresses.map(a => ({
            ...a,
            isDefaultBilling: a.id === id,
        }))
        const { error } = await supabase
            .from('customers')
            .update({ addresses: updatedAddresses, updated_at: new Date().toISOString() })
            .eq('id', customer.id)

        if (!error) setAddresses(updatedAddresses)
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">{t('addressBookTitle')}</h2>
                <button
                    onClick={() => setShowForm(true)}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700 transition flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    {t('addAddress')}
                </button>
            </div>

            {/* Address Grid */}
            <div className="grid md:grid-cols-2 gap-4">
                {addresses.map((addr) => (
                    <div key={addr.id} className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm relative group hover:border-green-500 transition-colors">
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                            <button onClick={() => handleDelete(addr.id)} className="text-red-500 hover:text-red-700 p-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>

                        {/* Label / VIES badge */}
                        {(addr.label || addr.isViesAddress) && (
                            <div className="mb-3">
                                {addr.isViesAddress && (
                                    <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-semibold border border-blue-100">{t('viesRegistered')}</span>
                                )}
                                {addr.label && !addr.isViesAddress && (
                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{addr.label}</span>
                                )}
                            </div>
                        )}

                        <div className="flex items-start gap-3">
                            <div className="mt-1 text-gray-400">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </div>
                            <div>
                                <p className="font-semibold text-gray-900">{addr.street}</p>
                                <p className="text-gray-600 text-sm">{addr.postalCode} {addr.city}</p>
                                <p className="text-gray-500 text-sm mt-1 uppercase tracking-wide text-xs">{addr.country}</p>
                            </div>
                        </div>

                        <div className="mt-4 flex gap-2 flex-wrap">
                            {!addr.isViesAddress && (
                            <button
                                onClick={() => handleSetDefaultShipping(addr.id)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                                    addr.isDefaultShipping
                                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                        : 'bg-gray-50 text-gray-400 border border-gray-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'
                                }`}
                                title={addr.isDefaultShipping ? t('defaultShipping') : t('setAsDefaultShipping')}
                            >
                                {addr.isDefaultShipping ? (
                                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                ) : (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2" /></svg>
                                )}
                                {t('defaultShipping')}
                            </button>
                            )}
                            <button
                                onClick={() => handleSetDefaultBilling(addr.id)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                                    addr.isDefaultBilling
                                        ? 'bg-gray-200 text-gray-700 border border-gray-300'
                                        : 'bg-gray-50 text-gray-400 border border-gray-200 hover:bg-gray-100 hover:text-gray-600 hover:border-gray-300'
                                }`}
                                title={addr.isDefaultBilling ? t('billing') : t('setAsDefaultBilling')}
                            >
                                {addr.isDefaultBilling ? (
                                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                ) : (
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2" /></svg>
                                )}
                                {t('billing')}
                            </button>
                        </div>
                    </div>
                ))}

                {addresses.length === 0 && !showForm && (
                    <div className="col-span-2 text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                        <p className="text-gray-500 mb-2">{t('noAddresses')}</p>
                        <button onClick={() => setShowForm(true)} className="text-green-600 font-medium hover:underline">{t('addFirstAddress')}</button>
                    </div>
                )}
            </div>

            {/* Add Address Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in zoom-in-95">
                        <h3 className="text-lg font-bold mb-4">{t('addNewAddress')}</h3>
                        <div className="space-y-4">
                            <input
                                ref={addressInputRef}
                                placeholder={t('streetAddress')}
                                className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                                value={newAddress.street || ''}
                                onChange={e => setNewAddress({ ...newAddress, street: e.target.value })}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <input
                                    placeholder={t('city')}
                                    className="border p-2.5 rounded-lg"
                                    value={newAddress.city || ''}
                                    onChange={e => setNewAddress({ ...newAddress, city: e.target.value })}
                                />
                                <input
                                    placeholder={t('postalCode')}
                                    className="border p-2.5 rounded-lg"
                                    value={newAddress.postalCode || ''}
                                    onChange={e => setNewAddress({ ...newAddress, postalCode: e.target.value })}
                                />
                            </div>
                            <select className="w-full border p-2.5 rounded-lg" onChange={e => setNewAddress({ ...newAddress, country: e.target.value })} defaultValue="SI">
                                <option value="SI">Slovenia</option>
                                <option value="DE">Germany</option>
                                <option value="AT">Austria</option>
                                <option value="IT">Italy</option>
                                <option value="HR">Croatia</option>
                            </select>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" className="rounded text-green-600" checked />
                                <span className="text-sm text-gray-600">{t('useDefaultShipping')}</span>
                            </label>

                            <div className="flex gap-3 justify-end pt-4">
                                <button onClick={() => setShowForm(false)} className="px-4 py-2 hover:bg-gray-100 rounded-lg text-gray-600">{t('cancel')}</button>
                                <button onClick={handleSaveAddress} className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-medium">{t('saveAddress')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
