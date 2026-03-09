'use client'
import React, { useEffect, useState } from 'react'
import type { Cart } from '@/types/database'
import Link from 'next/link'

interface CustomerInfo {
    id?: string
    first_name?: string | null
    last_name?: string | null
    email?: string | null
    company_name?: string | null
    is_b2b?: boolean
    addresses?: any[] | null
}

function countryToFlag(code: string) {
    const upper = (code || '').toUpperCase()
    if (upper.length !== 2) return '🌍'
    return String.fromCodePoint(...upper.split('').map(c => 0x1F1E6 - 65 + c.charCodeAt(0)))
}

function getCustomerCountry(customer?: CustomerInfo | null): string {
    if (!customer) return ''
    const addrs = customer.addresses ?? []
    const def = addrs.find((a: any) => a.isDefaultShipping) || addrs[0]
    return def?.country || ''
}

export default function CartEditor({ cart, customer }: { cart: Cart | null; customer?: CustomerInfo | null }) {
    const [localCart, setLocalCart] = useState<Cart | null>(cart ?? null)
    const [saving, setSaving] = useState(false)

    useEffect(() => setLocalCart(cart ?? null), [cart])

    if (!localCart) return (
        <div className="p-12 text-center text-slate-400">
            <p className="text-4xl mb-3">🛒</p>
            <p className="font-medium">Select a cart to view details</p>
        </div>
    )

    const items: any[] = localCart.items ?? []
    const subtotal = items.reduce((sum, it) => sum + Number(it.total_price ?? (it.unit_price * it.quantity) ?? 0), 0)
    const country = getCustomerCountry(customer)
    const flag = country ? countryToFlag(country) : ''

    async function updateItem(index: number, quantity: number) {
        if (!localCart) return
        const updated = [...items]
        updated[index] = { ...updated[index], quantity, total_price: updated[index].unit_price * quantity }
        setLocalCart({ ...localCart, items: updated })
    }

    async function save() {
        if (!localCart) return
        setSaving(true)
        const res = await fetch(`/api/admin/customers/${localCart.user_id ?? localCart.id}/carts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update', cartId: localCart.id, items: localCart.items }),
        })
        setSaving(false)
        if (!res.ok) alert('Failed to save cart')
    }

    async function deleteCart() {
        if (!localCart) return
        if (!confirm('Delete this cart permanently?')) return
        setSaving(true)
        const res = await fetch(`/api/admin/customers/${localCart.user_id ?? localCart.id}/carts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', cartId: localCart.id }),
        })
        setSaving(false)
        if (res.ok) { window.location.href = '/admin/carts' } else { alert('Failed to delete cart') }
    }

    async function convert() {
        if (!localCart) return
        setSaving(true)
        const res = await fetch(`/api/admin/customers/${localCart.user_id ?? localCart.id}/carts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'convert', cartId: localCart.id }),
        })
        const data = await res.json()
        setSaving(false)
        if (res.ok) {
            const orderNum = data.order?.order_number
            if (confirm(`Order ${orderNum} created. Open order now?`)) {
                window.location.href = `/admin/orders/${data.order?.id}`
            }
        } else {
            alert(`Error: ${data.error}`)
        }
    }

    return (
        <div className="space-y-6">
            {/* Customer info banner */}
            {customer && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-2xl font-black text-slate-400">
                            {(customer.first_name?.[0] || customer.email?.[0] || '?').toUpperCase()}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <p className="font-black text-slate-900">
                                    {customer.first_name} {customer.last_name}
                                    {customer.company_name && <span className="text-slate-500 font-medium"> · {customer.company_name}</span>}
                                </p>
                                {customer.is_b2b && (
                                    <span className="text-[9px] font-black px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full uppercase">B2B</span>
                                )}
                            </div>
                            <p className="text-sm text-slate-500">{customer.email}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {country && (
                            <div className="text-center">
                                <p className="text-2xl">{flag}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">{country}</p>
                            </div>
                        )}
                        {customer.id && (
                            <Link
                                href={`/admin/customers/${customer.id}`}
                                className="text-xs font-bold text-blue-600 hover:underline px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-100"
                            >
                                View Customer
                            </Link>
                        )}
                    </div>
                </div>
            )}

            {/* Cart items table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                    <div>
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Cart Contents</h3>
                        <p className="text-sm font-bold text-slate-900 mt-0.5">{items.length} item{items.length !== 1 ? 's' : ''}</p>
                    </div>
                    <p className="text-xs text-slate-400 font-mono">
                        ID: {localCart.id.slice(0, 8)}…
                    </p>
                </div>

                {items.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        <p className="text-3xl mb-2">📦</p>
                        <p className="font-medium">Empty cart</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="text-left px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Product</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider hidden sm:table-cell">SKU</th>
                                    <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Qty</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider hidden sm:table-cell">Unit Price</th>
                                    <th className="text-right px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {items.map((it: any, i: number) => {
                                    const lineTotal = Number(it.total_price ?? (it.unit_price * it.quantity) ?? 0)
                                    const unitPrice = Number(it.unit_price ?? 0)
                                    const name = it.product_name || it.name || it.sku || 'Unknown Product'
                                    return (
                                        <tr key={i} className="hover:bg-slate-50/50 transition">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    {it.image_url && (
                                                        <img src={it.image_url} alt={name} className="w-10 h-10 rounded-lg object-cover border border-slate-100 flex-shrink-0" />
                                                    )}
                                                    <span className="font-bold text-slate-900">{name}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-slate-500 font-mono text-xs hidden sm:table-cell">{it.sku || '—'}</td>
                                            <td className="px-4 py-4 text-center">
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={it.quantity || 1}
                                                    onChange={e => updateItem(i, Math.max(1, Number(e.target.value)))}
                                                    className="w-16 text-center border border-slate-200 rounded-lg px-2 py-1 text-sm font-bold focus:outline-none focus:border-blue-400"
                                                />
                                            </td>
                                            <td className="px-4 py-4 text-right text-slate-500 hidden sm:table-cell">€{unitPrice.toFixed(2)}</td>
                                            <td className="px-6 py-4 text-right font-bold text-slate-900">€{lineTotal.toFixed(2)}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                                <tr>
                                    <td colSpan={3} className="px-6 py-4 text-right text-xs font-black text-slate-400 uppercase tracking-widest">Cart Subtotal</td>
                                    <td className="hidden sm:table-cell" />
                                    <td className="px-6 py-4 text-right text-lg font-black text-slate-900">€{subtotal.toFixed(2)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
                <button
                    onClick={save}
                    disabled={saving}
                    className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black transition disabled:opacity-50 shadow-sm"
                >
                    {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button
                    onClick={convert}
                    disabled={saving}
                    className="px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition disabled:opacity-50 shadow-sm"
                >
                    Convert to Order
                </button>
                <button
                    onClick={deleteCart}
                    disabled={saving}
                    className="px-5 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-bold hover:bg-red-100 transition disabled:opacity-50 ml-auto"
                >
                    Delete Cart
                </button>
            </div>

            {/* Metadata */}
            <p className="text-[10px] text-slate-400 font-mono">
                Created: {localCart.created_at ? new Date(localCart.created_at).toLocaleString() : '—'}
                {localCart.updated_at && localCart.updated_at !== localCart.created_at && (
                    <> · Updated: {new Date(localCart.updated_at).toLocaleString()}</>
                )}
            </p>
        </div>
    )
}
