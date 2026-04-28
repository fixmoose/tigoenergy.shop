'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface DeliveryItem {
    order_item_id: string
    qty: number
    product_name?: string
    sku?: string
}

interface Delivery {
    id: string
    part_number: number
    total_parts: number
    items: DeliveryItem[] | string
    carrier: string | null
    status: 'pending' | 'prepared' | 'completed'
    notes: string | null
    prepared_at: string | null
    delivered_at: string | null
    created_at: string
}

interface OrderItem {
    id: string
    product_name: string
    sku: string
    quantity: number
    unit_price: number
    allocated: number
    remaining: number
}

interface Props {
    orderId: string
}

const CARRIER_OPTIONS = ['Personal Pick-up', 'DPD', 'InterEuropa', 'Other']

const STATUS_BADGE: Record<string, string> = {
    pending: 'bg-slate-100 text-slate-600',
    prepared: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
}

function parseItems(items: DeliveryItem[] | string): DeliveryItem[] {
    if (typeof items === 'string') { try { return JSON.parse(items) } catch { return [] } }
    return items || []
}

export default function OrderDeliveriesPanel({ orderId }: Props) {
    const router = useRouter()
    const [deliveries, setDeliveries] = useState<Delivery[]>([])
    const [items, setItems] = useState<OrderItem[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [showForm, setShowForm] = useState(false)
    const [formQtys, setFormQtys] = useState<Record<string, string>>({})
    const [formCarrier, setFormCarrier] = useState('Personal Pick-up')
    const [formNotes, setFormNotes] = useState('')
    const [error, setError] = useState<string | null>(null)

    const fetchDeliveries = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/orders/${orderId}/deliveries`)
            const data = await res.json()
            if (data.success) {
                setDeliveries(data.data.deliveries || [])
                setItems(data.data.items || [])
            }
        } catch { /* ignore */ }
        setLoading(false)
    }, [orderId])

    useEffect(() => { fetchDeliveries() }, [fetchDeliveries])

    function openForm() {
        // Default each row to its remaining qty so admin can just submit to
        // create a delivery covering everything left, or edit numbers to split.
        const defaults: Record<string, string> = {}
        for (const it of items) {
            defaults[it.id] = String(it.remaining)
        }
        setFormQtys(defaults)
        setFormNotes('')
        setShowForm(true)
        setError(null)
    }

    async function submitDelivery() {
        setCreating(true)
        setError(null)
        try {
            const lineItems = items
                .map(it => ({ order_item_id: it.id, qty: parseInt(formQtys[it.id] || '0') || 0 }))
                .filter(li => li.qty > 0)
            if (lineItems.length === 0) {
                setError('Add at least one item with qty > 0')
                setCreating(false)
                return
            }
            const res = await fetch(`/api/admin/orders/${orderId}/deliveries`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: lineItems, carrier: formCarrier, notes: formNotes || null }),
            })
            const data = await res.json()
            if (!data.success) { setError(data.error || 'Create failed'); setCreating(false); return }
            setShowForm(false)
            await fetchDeliveries()
            router.refresh()
        } catch (err: any) {
            setError(err?.message || 'Create failed')
        } finally {
            setCreating(false)
        }
    }

    async function removeDelivery(id: string, partNumber: number) {
        if (!confirm(`Remove dobavnica part ${partNumber}? This cannot be undone.`)) return
        try {
            const res = await fetch(`/api/admin/orders/${orderId}/deliveries?delivery_id=${id}`, { method: 'DELETE' })
            const data = await res.json()
            if (!data.ok) { alert(data.error || 'Failed'); return }
            await fetchDeliveries()
            router.refresh()
        } catch { alert('Failed') }
    }

    const totalRemaining = items.reduce((s, it) => s + it.remaining, 0)
    const hasUnallocated = totalRemaining > 0

    if (loading) {
        return <div className="text-sm text-gray-400 p-4">Loading deliveries…</div>
    }

    // If there are no deliveries and no need for them yet, show a compact
    // promo to split into multiple dobavnicas.
    if (deliveries.length === 0 && !showForm) {
        return (
            <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Deliveries / Dobavnice</h3>
                        <p className="text-sm font-bold text-gray-900 mt-0.5">Split into multiple pickups or shipments</p>
                    </div>
                    <button onClick={openForm} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700 transition">
                        + Split into deliveries
                    </button>
                </div>
                <div className="px-8 py-4 text-xs text-gray-500">
                    Single dobavnica covers the whole order today. Click <strong>Split into deliveries</strong> if the customer wants partial pickups (e.g. 100 pcs now, 170 pcs later).
                </div>
            </section>
        )
    }

    return (
        <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                <div>
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Deliveries / Dobavnice</h3>
                    <p className="text-sm font-bold text-gray-900 mt-0.5">
                        {deliveries.length} dobavnica{deliveries.length === 1 ? '' : 's'} · {totalRemaining > 0 ? `${totalRemaining} pcs unallocated` : 'all qty allocated'}
                    </p>
                </div>
                {hasUnallocated && (
                    <button onClick={openForm} className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700 transition">
                        + Add delivery
                    </button>
                )}
            </div>

            {/* Existing deliveries */}
            <div className="divide-y divide-gray-100">
                {deliveries.map(d => {
                    const dItems = parseItems(d.items)
                    return (
                        <div key={d.id} className="p-6">
                            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <span className="text-base font-black text-gray-900">Dobavnica {d.part_number}/{d.total_parts}</span>
                                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${STATUS_BADGE[d.status]}`}>{d.status}</span>
                                    {d.carrier && <span className="text-xs text-gray-500">{d.carrier}</span>}
                                    {d.delivered_at && <span className="text-[10px] text-green-600">Delivered {new Date(d.delivered_at).toLocaleDateString('sl-SI')}</span>}
                                </div>
                                {d.status !== 'completed' && (
                                    <button onClick={() => removeDelivery(d.id, d.part_number)} className="text-xs text-red-500 hover:text-red-700 font-bold">
                                        Remove
                                    </button>
                                )}
                            </div>
                            <div className="space-y-1">
                                {dItems.map((it, i) => (
                                    <div key={i} className="flex justify-between text-sm">
                                        <span className="text-gray-700">{it.product_name}</span>
                                        <span className="font-mono font-bold text-gray-900">×{it.qty}</span>
                                    </div>
                                ))}
                            </div>
                            {d.notes && <p className="text-xs text-gray-500 mt-2 italic">{d.notes}</p>}
                            <a
                                href={`/api/orders/${orderId}/packing-slip?delivery=${d.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block mt-3 text-xs text-blue-600 hover:underline font-bold"
                            >
                                Download dobavnica PDF →
                            </a>
                        </div>
                    )
                })}
            </div>

            {/* Create form */}
            {showForm && (
                <div className="border-t border-amber-100 bg-amber-50/30 p-6">
                    <h4 className="text-sm font-bold text-gray-900 mb-3">New dobavnica</h4>
                    <div className="space-y-2 mb-4">
                        {items.map(it => (
                            <div key={it.id} className="flex items-center gap-3 text-sm">
                                <div className="flex-1">
                                    <div className="text-gray-800 font-medium">{it.product_name}</div>
                                    <div className="text-[10px] text-gray-400 font-mono">{it.sku} · ordered {it.quantity} · already in deliveries {it.allocated} · remaining <strong>{it.remaining}</strong></div>
                                </div>
                                <input
                                    type="number"
                                    min="0"
                                    max={it.remaining}
                                    value={formQtys[it.id] ?? ''}
                                    onChange={e => setFormQtys(prev => ({ ...prev, [it.id]: e.target.value }))}
                                    className="w-24 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-right font-mono"
                                    placeholder="0"
                                />
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div>
                            <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Carrier</label>
                            <select value={formCarrier} onChange={e => setFormCarrier(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                                {CARRIER_OPTIONS.map(c => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Notes (optional)</label>
                            <input type="text" value={formNotes} onChange={e => setFormNotes(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" placeholder="e.g. customer's truck arrives Friday" />
                        </div>
                    </div>
                    {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs mb-3">{error}</div>}
                    <div className="flex gap-3">
                        <button onClick={() => setShowForm(false)} disabled={creating} className="flex-1 py-2 border border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-50">Cancel</button>
                        <button onClick={submitDelivery} disabled={creating} className="flex-1 py-2 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700 disabled:opacity-50">
                            {creating ? 'Creating…' : 'Create dobavnica'}
                        </button>
                    </div>
                </div>
            )}
        </section>
    )
}
