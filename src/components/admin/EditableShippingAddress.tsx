'use client'

import React, { useState } from 'react'
import { adminUpdateOrderShippingAddressAction } from '@/app/actions/admin'
import { useRouter } from 'next/navigation'

interface Address {
    first_name?: string
    last_name?: string
    company?: string
    street: string
    street2?: string
    city: string
    postal_code: string
    country: string
}

interface SavedAddress {
    id: string
    label?: string
    street: string
    street2?: string
    city: string
    postalCode?: string
    postal_code?: string
    country: string
    isViesAddress?: boolean
    isDefaultShipping?: boolean
}

export default function EditableShippingAddress({
    orderId,
    address,
    customerAddresses,
}: {
    orderId: string
    address: Address | null
    customerAddresses?: SavedAddress[]
}) {
    const router = useRouter()
    const [editing, setEditing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState<Address>({
        first_name: address?.first_name || '',
        last_name: address?.last_name || '',
        company: address?.company || '',
        street: address?.street || '',
        street2: address?.street2 || '',
        city: address?.city || '',
        postal_code: address?.postal_code || '',
        country: address?.country || '',
    })

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await adminUpdateOrderShippingAddressAction(orderId, form)
            if (res.success) {
                setEditing(false)
                router.refresh()
            } else {
                alert(res.error || 'Failed to update')
            }
        } finally {
            setSaving(false)
        }
    }

    const selectSavedAddress = (addr: SavedAddress) => {
        setForm({
            first_name: form.first_name,
            last_name: form.last_name,
            company: form.company,
            street: addr.street || '',
            street2: addr.street2 || '',
            city: addr.city || '',
            postal_code: addr.postalCode || addr.postal_code || '',
            country: (addr.country || '').toUpperCase(),
        })
    }

    if (!editing) {
        return (
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-800">Shipping Address</h3>
                    <button
                        onClick={() => setEditing(true)}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wider px-2 py-1 rounded hover:bg-blue-50 transition"
                    >
                        Edit
                    </button>
                </div>
                {address ? (
                    <div className="text-sm text-slate-600 space-y-1">
                        <p className="font-medium text-slate-800">
                            {address.first_name} {address.last_name}
                        </p>
                        {address.company && <p>{address.company}</p>}
                        <p>{address.street}</p>
                        {address.street2 && <p>{address.street2}</p>}
                        <p>{address.postal_code} {address.city}</p>
                        <p className="font-medium">{address.country}</p>
                    </div>
                ) : (
                    <p className="text-slate-400 text-sm">No address</p>
                )}
            </div>
        )
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-800">Shipping Address</h3>
                <div className="flex gap-1">
                    <button onClick={handleSave} disabled={saving}
                        className="text-[10px] font-bold text-amber-600 hover:text-amber-800 uppercase tracking-wider px-2 py-1 rounded hover:bg-amber-50 transition disabled:opacity-50">
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={() => setEditing(false)}
                        className="text-[10px] font-bold text-slate-500 hover:text-slate-700 uppercase tracking-wider px-2 py-1 rounded hover:bg-slate-50 transition">
                        Cancel
                    </button>
                </div>
            </div>

            {customerAddresses && customerAddresses.length > 0 && (
                <div className="mb-3">
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Select from customer addresses</label>
                    <select
                        onChange={e => {
                            const addr = customerAddresses.find(a => a.id === e.target.value)
                            if (addr) selectSavedAddress(addr)
                        }}
                        defaultValue=""
                        className="w-full bg-white px-2 py-1.5 border border-slate-200 rounded text-xs outline-none focus:border-blue-500"
                    >
                        <option value="" disabled>Choose an address...</option>
                        {customerAddresses.map(a => (
                            <option key={a.id} value={a.id}>
                                {a.label || 'Address'}{a.isViesAddress ? ' (VIES)' : ''}{a.isDefaultShipping ? ' *' : ''} — {a.street}, {a.city} {a.postalCode || a.postal_code} {a.country}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">First Name</label>
                        <input type="text" value={form.first_name || ''} onChange={e => setForm({ ...form, first_name: e.target.value })}
                            className="w-full border rounded px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
                    </div>
                    <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Last Name</label>
                        <input type="text" value={form.last_name || ''} onChange={e => setForm({ ...form, last_name: e.target.value })}
                            className="w-full border rounded px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
                    </div>
                </div>
                <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Company</label>
                    <input type="text" value={form.company || ''} onChange={e => setForm({ ...form, company: e.target.value })}
                        className="w-full border rounded px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
                </div>
                <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Street</label>
                    <input type="text" value={form.street} onChange={e => setForm({ ...form, street: e.target.value })}
                        className="w-full border rounded px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
                </div>
                <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Street 2</label>
                    <input type="text" value={form.street2 || ''} onChange={e => setForm({ ...form, street2: e.target.value })}
                        className="w-full border rounded px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Postal Code</label>
                        <input type="text" value={form.postal_code} onChange={e => setForm({ ...form, postal_code: e.target.value })}
                            className="w-full border rounded px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
                    </div>
                    <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">City</label>
                        <input type="text" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                            className="w-full border rounded px-2 py-1.5 text-xs outline-none focus:border-blue-500" />
                    </div>
                    <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">Country</label>
                        <input type="text" value={form.country} onChange={e => setForm({ ...form, country: e.target.value.toUpperCase() })}
                            className="w-full border rounded px-2 py-1.5 text-xs outline-none focus:border-blue-500 uppercase font-mono" />
                    </div>
                </div>
            </div>
        </div>
    )
}
