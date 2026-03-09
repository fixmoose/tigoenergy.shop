'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminUpdateCustomerAction } from '@/app/actions/admin'

interface Address {
    id: string
    street: string
    street2?: string
    city: string
    postalCode: string
    country: string
    isDefaultShipping?: boolean
    isDefaultBilling?: boolean
}

interface AdminAddressEditorProps {
    customerId: string
    addresses: Address[]
}

const EMPTY_FORM: Omit<Address, 'id'> = {
    street: '',
    street2: '',
    city: '',
    postalCode: '',
    country: '',
    isDefaultShipping: false,
    isDefaultBilling: false,
}

export default function AdminAddressEditor({ customerId, addresses: initial }: AdminAddressEditorProps) {
    const router = useRouter()
    const [addresses, setAddresses] = useState<Address[]>(initial ?? [])
    const [editingId, setEditingId] = useState<string | null>(null)
    const [addingNew, setAddingNew] = useState(false)
    const [form, setForm] = useState<Omit<Address, 'id'>>(EMPTY_FORM)
    const [saving, setSaving] = useState(false)

    async function save(updated: Address[]) {
        setSaving(true)
        const res = await adminUpdateCustomerAction(customerId, { addresses: updated })
        setSaving(false)
        if (res.success) {
            setAddresses(updated)
            router.refresh()
        } else {
            alert('Failed to save: ' + res.error)
        }
    }

    function startEdit(addr: Address) {
        setEditingId(addr.id)
        setAddingNew(false)
        setForm({
            street: addr.street,
            street2: addr.street2 || '',
            city: addr.city,
            postalCode: addr.postalCode,
            country: addr.country,
            isDefaultShipping: addr.isDefaultShipping ?? false,
            isDefaultBilling: addr.isDefaultBilling ?? false,
        })
    }

    async function saveEdit() {
        if (!editingId) return
        const updated = addresses.map(a =>
            a.id === editingId ? { ...a, ...form } : a
        )
        await save(updated)
        setEditingId(null)
    }

    async function saveNew() {
        const newAddr: Address = {
            id: Math.random().toString(36).substr(2, 9),
            ...form,
        }
        const updated = [...addresses, newAddr]
        await save(updated)
        setAddingNew(false)
        setForm(EMPTY_FORM)
    }

    async function deleteAddress(id: string) {
        if (!confirm('Delete this address?')) return
        const updated = addresses.filter(a => a.id !== id)
        await save(updated)
    }

    async function setDefault(id: string, type: 'shipping' | 'billing') {
        const updated = addresses.map(a => ({
            ...a,
            isDefaultShipping: type === 'shipping' ? a.id === id : a.isDefaultShipping,
            isDefaultBilling: type === 'billing' ? a.id === id : a.isDefaultBilling,
        }))
        await save(updated)
    }

    const isEditing = (id: string) => editingId === id

    return (
        <aside className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                <div>
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Addresses</h3>
                    <p className="text-sm font-bold text-gray-900">{addresses.length} saved address{addresses.length !== 1 ? 'es' : ''}</p>
                </div>
                {!addingNew && editingId === null && (
                    <button
                        onClick={() => { setAddingNew(true); setForm(EMPTY_FORM) }}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-sm"
                    >
                        + Add
                    </button>
                )}
            </div>

            <div className="p-6 space-y-4">
                {addresses.length === 0 && !addingNew && (
                    <p className="text-sm text-gray-400 text-center py-4">No addresses saved yet.</p>
                )}

                {addresses.map(addr => (
                    <div key={addr.id} className="border border-gray-100 rounded-2xl overflow-hidden">
                        {isEditing(addr.id) ? (
                            <AddressForm
                                form={form}
                                onChange={setForm}
                                onSave={saveEdit}
                                onCancel={() => setEditingId(null)}
                                saving={saving}
                            />
                        ) : (
                            <div className="p-4">
                                <div className="flex gap-1.5 mb-2 flex-wrap">
                                    {addr.isDefaultShipping && (
                                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-full">Default Shipping</span>
                                    )}
                                    {addr.isDefaultBilling && (
                                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-green-50 text-green-600 border border-green-100 rounded-full">Default Billing</span>
                                    )}
                                </div>
                                <p className="text-sm font-bold text-gray-900">{addr.street}</p>
                                {addr.street2 && <p className="text-sm text-gray-600">{addr.street2}</p>}
                                <p className="text-sm text-gray-600">{addr.postalCode} {addr.city}</p>
                                <p className="text-sm text-gray-600">{addr.country}</p>

                                <div className="flex gap-2 mt-3 flex-wrap">
                                    <button
                                        onClick={() => startEdit(addr)}
                                        className="text-[10px] font-bold px-2 py-1 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200"
                                    >
                                        Edit
                                    </button>
                                    {!addr.isDefaultShipping && (
                                        <button
                                            onClick={() => setDefault(addr.id, 'shipping')}
                                            disabled={saving}
                                            className="text-[10px] font-bold px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-100 disabled:opacity-50"
                                        >
                                            Set Shipping Default
                                        </button>
                                    )}
                                    {!addr.isDefaultBilling && (
                                        <button
                                            onClick={() => setDefault(addr.id, 'billing')}
                                            disabled={saving}
                                            className="text-[10px] font-bold px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg border border-green-100 disabled:opacity-50"
                                        >
                                            Set Billing Default
                                        </button>
                                    )}
                                    <button
                                        onClick={() => deleteAddress(addr.id)}
                                        disabled={saving}
                                        className="text-[10px] font-bold px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-100 disabled:opacity-50 ml-auto"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {addingNew && (
                    <div className="border border-blue-100 rounded-2xl overflow-hidden bg-blue-50/30">
                        <div className="px-4 pt-4 pb-1">
                            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">New Address</p>
                        </div>
                        <AddressForm
                            form={form}
                            onChange={setForm}
                            onSave={saveNew}
                            onCancel={() => setAddingNew(false)}
                            saving={saving}
                        />
                    </div>
                )}
            </div>
        </aside>
    )
}

function AddressForm({
    form,
    onChange,
    onSave,
    onCancel,
    saving,
}: {
    form: Omit<Address, 'id'>
    onChange: (f: Omit<Address, 'id'>) => void
    onSave: () => void
    onCancel: () => void
    saving: boolean
}) {
    const field = (label: string, key: keyof Omit<Address, 'id' | 'isDefaultShipping' | 'isDefaultBilling'>) => (
        <div>
            <label className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</label>
            <input
                type="text"
                value={form[key] as string}
                onChange={e => onChange({ ...form, [key]: e.target.value })}
                className="w-full text-sm font-medium text-gray-900 border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-400"
            />
        </div>
    )

    return (
        <div className="p-4 space-y-3">
            {field('Street', 'street')}
            {field('Street 2 (optional)', 'street2')}
            <div className="grid grid-cols-2 gap-3">
                {field('Postal Code', 'postalCode')}
                {field('City', 'city')}
            </div>
            {field('Country', 'country')}

            <div className="flex gap-4 pt-1">
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={form.isDefaultShipping ?? false}
                        onChange={e => onChange({ ...form, isDefaultShipping: e.target.checked })}
                        className="rounded"
                    />
                    Default Shipping
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={form.isDefaultBilling ?? false}
                        onChange={e => onChange({ ...form, isDefaultBilling: e.target.checked })}
                        className="rounded"
                    />
                    Default Billing
                </label>
            </div>

            <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button
                    onClick={onCancel}
                    className="px-3 py-1.5 text-xs font-bold text-gray-400 hover:text-gray-600"
                >
                    Cancel
                </button>
                <button
                    onClick={onSave}
                    disabled={saving || !form.street || !form.city}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50 ml-auto shadow-sm"
                >
                    {saving ? 'Saving...' : 'Save Address'}
                </button>
            </div>
        </div>
    )
}
