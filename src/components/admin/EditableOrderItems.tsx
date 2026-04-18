'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { adminUpdateOrderItem, adminRemoveOrderItem, adminAddOrderItem, adminUpdateShippingCost } from '@/app/actions/order-modify'
import { searchProductsAction, getOrderedQuantities } from '@/app/actions/products'
import type { OrderItem } from '@/types/database'

function formatCurrency(amount: number | null | undefined) {
    if (amount == null) return '€0.00'
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)
}

function formatWeight(kg: number | null | undefined) {
    if (kg == null) return '0 kg'
    return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3 }).format(kg) + ' kg'
}

const CARRIER_OPTIONS = [
    { value: '', label: 'Order default' },
    { value: 'Personal Pick-up', label: 'Personal Pick-up' },
    { value: 'DPD', label: 'DPD' },
    { value: 'InterEuropa', label: 'InterEuropa' },
]

interface EditableOrderItemsProps {
    orderId: string
    items: OrderItem[]
    subtotal: number
    shippingCost: number
    vatRate: number
    vatAmount: number
    total: number
    invoiceIssued: boolean
    orderShippingCarrier?: string | null
}

export default function EditableOrderItems({ orderId, items, subtotal, shippingCost, vatRate, vatAmount, total, invoiceIssued, orderShippingCarrier }: EditableOrderItemsProps) {
    const router = useRouter()
    const [editingItem, setEditingItem] = useState<string | null>(null)
    const [editQty, setEditQty] = useState('')
    const [editPrice, setEditPrice] = useState('')
    const [saving, setSaving] = useState(false)
    const [showAddProduct, setShowAddProduct] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [searching, setSearching] = useState(false)
    const [addQty, setAddQty] = useState('1')
    const [addPrice, setAddPrice] = useState('')
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null)
    const [editingShipping, setEditingShipping] = useState(false)
    const [editShippingCost, setEditShippingCost] = useState('')
    const [itemCarriers, setItemCarriers] = useState<Record<string, string>>(() => {
        const map: Record<string, string> = {}
        for (const item of items) map[item.id] = item.shipping_carrier || ''
        return map
    })
    const [savingCarriers, setSavingCarriers] = useState(false)
    const [orderedQty, setOrderedQty] = useState<Record<string, number>>({})

    useEffect(() => {
        getOrderedQuantities().then(res => {
            if (res.success && res.data) setOrderedQty(res.data)
        })
    }, [])

    const hasCarrierChanges = items.some(item => (itemCarriers[item.id] || '') !== (item.shipping_carrier || ''))

    const saveItemCarriers = async () => {
        setSavingCarriers(true)
        try {
            const res = await fetch(`/api/admin/orders/${orderId}/item-carriers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ carriers: itemCarriers }),
            })
            if (res.ok) router.refresh()
            else alert('Failed to save carriers')
        } finally {
            setSavingCarriers(false)
        }
    }

    const startEdit = (item: OrderItem) => {
        setEditingItem(item.id)
        setEditQty(String(item.quantity))
        setEditPrice(String(item.unit_price))
    }

    const cancelEdit = () => {
        setEditingItem(null)
    }

    const saveEdit = async (itemId: string) => {
        const qty = parseInt(editQty)
        const price = parseFloat(editPrice)
        if (qty === 0 || isNaN(qty) || isNaN(price) || price < 0) {
            alert('Invalid quantity or price')
            return
        }
        setSaving(true)
        try {
            const res = await adminUpdateOrderItem(itemId, orderId, { quantity: qty, unit_price: price })
            if (res.success) {
                setEditingItem(null)
                router.refresh()
            } else {
                alert('Failed: ' + res.error)
            }
        } finally {
            setSaving(false)
        }
    }

    const removeItem = async (itemId: string, name: string) => {
        if (!confirm(`Remove "${name}" from this order?`)) return
        setSaving(true)
        try {
            const res = await adminRemoveOrderItem(itemId, orderId)
            if (res.success) {
                router.refresh()
            } else {
                alert('Failed: ' + res.error)
            }
        } finally {
            setSaving(false)
        }
    }

    useEffect(() => {
        if (searchQuery.length < 2) {
            setSearchResults([])
            return
        }
        const timeout = setTimeout(async () => {
            setSearching(true)
            const res = await searchProductsAction(searchQuery)
            if (res.success && res.data) {
                setSearchResults(res.data)
            }
            setSearching(false)
        }, 300)
        return () => clearTimeout(timeout)
    }, [searchQuery])

    const selectProduct = (product: any) => {
        setSelectedProduct(product)
        setAddPrice(String(product.b2b_price_eur || product.price_eur || 0))
        setAddQty('1')
        setSearchQuery('')
        setSearchResults([])
    }

    const addProduct = async () => {
        if (!selectedProduct) return
        const qty = parseInt(addQty)
        const price = parseFloat(addPrice)
        if (qty === 0 || isNaN(qty) || isNaN(price) || price < 0) {
            alert('Invalid quantity or price')
            return
        }
        setSaving(true)
        try {
            const res = await adminAddOrderItem(orderId, selectedProduct.id, qty, price)
            if (res.success) {
                setSelectedProduct(null)
                setShowAddProduct(false)
                setSearchQuery('')
                router.refresh()
            } else {
                alert('Failed: ' + res.error)
            }
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="px-6 py-4 border-b bg-slate-50 flex items-center justify-between">
                <h2 className="font-semibold text-slate-800">Items</h2>
                <div className="flex items-center gap-3">
                    {hasCarrierChanges && (
                        <button
                            onClick={saveItemCarriers}
                            disabled={savingCarriers}
                            className="text-xs font-bold text-amber-600 hover:text-amber-800 px-3 py-1 bg-amber-50 rounded-lg border border-amber-200 disabled:opacity-50"
                        >
                            {savingCarriers ? 'Saving...' : 'Save Carrier Assignments'}
                        </button>
                    )}
                    {!invoiceIssued && (
                        <button
                            onClick={() => setShowAddProduct(!showAddProduct)}
                            className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                            {showAddProduct ? 'Cancel' : '+ Add Product'}
                        </button>
                    )}
                </div>
            </div>

            {showAddProduct && (
                <div className="px-6 py-4 bg-blue-50 border-b space-y-3">
                    {!selectedProduct ? (
                        <div>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search by product name or SKU..."
                                className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-blue-400"
                                autoFocus
                            />
                            {searching && <p className="text-xs text-blue-500 mt-1">Searching...</p>}
                            {searchResults.length > 0 && (
                                <div className="mt-2 max-h-48 overflow-y-auto border border-blue-200 rounded-lg bg-white divide-y">
                                    {searchResults.map(p => (
                                        <button
                                            key={p.id}
                                            onClick={() => selectProduct(p)}
                                            className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between"
                                        >
                                            <div>
                                                <div className="text-sm font-medium text-slate-800">{p.name_en}</div>
                                                <div className="text-xs text-slate-500">{p.sku}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-medium text-slate-800">{formatCurrency(p.b2b_price_eur || p.price_eur)}</div>
                                                {(() => {
                                                    const total = p.stock_quantity ?? 0
                                                    const ordered = orderedQty[p.id] || 0
                                                    const available = total - ordered
                                                    return (
                                                        <div className="text-xs text-slate-400">
                                                            {total} stk{ordered > 0 && <> / <span className="text-orange-500">{ordered} ord</span> / <span className={available < 5 ? 'text-red-500 font-bold' : 'text-green-600'}>{available} avl</span></>}
                                                        </div>
                                                    )
                                                })()}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <div className="text-sm font-medium text-slate-800">{selectedProduct.name_en}</div>
                                <div className="text-xs text-slate-500">{selectedProduct.sku}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div>
                                    <label className="text-[9px] text-slate-500 font-bold uppercase block">Qty</label>
                                    <input
                                        type="number"
                                        value={addQty}
                                        onChange={e => setAddQty(e.target.value)}
                                        className="w-16 border rounded px-2 py-1.5 text-sm text-right"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] text-slate-500 font-bold uppercase block">Unit Price</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={addPrice}
                                        onChange={e => setAddPrice(e.target.value)}
                                        className="w-24 border rounded px-2 py-1.5 text-sm text-right"
                                    />
                                </div>
                                <div className="pt-3">
                                    <button
                                        onClick={addProduct}
                                        disabled={saving}
                                        className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        {saving ? '...' : 'Add'}
                                    </button>
                                </div>
                                <div className="pt-3">
                                    <button
                                        onClick={() => setSelectedProduct(null)}
                                        className="px-2 py-1.5 text-slate-500 hover:text-slate-700 text-sm"
                                    >
                                        Change
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <table className="w-full">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                    <tr>
                        <th className="text-left px-6 py-3">Product</th>
                        <th className="text-right px-4 py-3">Qty</th>
                        <th className="text-right px-4 py-3">Unit Price</th>
                        <th className="text-right px-4 py-3">Total</th>
                        <th className="text-center px-4 py-3">Ship via</th>
                        <th className="text-center px-4 py-3">Compliance</th>
                        <th className="text-center px-2 py-3 w-20">Edit</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {items.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4">
                                <div className="font-medium text-slate-800">{item.product_name}</div>
                                <div className="text-xs text-slate-500">{item.sku}</div>
                                {item.cn_code && <div className="text-xs text-slate-400 font-mono">CN: {item.cn_code}</div>}
                            </td>
                            <td className={`text-right px-4 py-4 ${item.quantity < 0 ? 'text-red-600 font-medium' : 'text-slate-800'}`}>
                                {editingItem === item.id ? (
                                    <input
                                        type="number"
                                        value={editQty}
                                        onChange={e => setEditQty(e.target.value)}
                                        className="w-16 border rounded px-2 py-1 text-sm text-right"
                                    />
                                ) : (
                                    item.quantity
                                )}
                            </td>
                            <td className="text-right px-4 py-4 text-slate-600">
                                {editingItem === item.id ? (
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={editPrice}
                                        onChange={e => setEditPrice(e.target.value)}
                                        className="w-24 border rounded px-2 py-1 text-sm text-right"
                                    />
                                ) : (
                                    <>
                                        {item.b2c_unit_price && item.b2c_unit_price > item.unit_price && (
                                            <div className="text-[10px] text-slate-400 line-through">
                                                {formatCurrency(item.b2c_unit_price)}
                                            </div>
                                        )}
                                        {formatCurrency(item.unit_price)}
                                    </>
                                )}
                            </td>
                            <td className={`text-right px-4 py-4 font-medium ${(item.total_price ?? 0) < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                                {editingItem === item.id
                                    ? formatCurrency((parseInt(editQty) || 0) * (parseFloat(editPrice) || 0))
                                    : formatCurrency(item.total_price)
                                }
                            </td>
                            <td className="px-4 py-4 text-center">
                                <select
                                    value={itemCarriers[item.id] || ''}
                                    onChange={e => setItemCarriers(prev => ({ ...prev, [item.id]: e.target.value }))}
                                    className="text-xs border border-slate-200 rounded px-1.5 py-1 bg-white text-slate-700 max-w-[110px]"
                                >
                                    {CARRIER_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </td>
                            <td className="px-4 py-4">
                                <div className="flex flex-col items-center gap-1">
                                    {item.applies_trod_fee && (
                                        <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
                                            eTROD-{item.trod_category_code}
                                        </span>
                                    )}
                                    {item.packaging_data && Object.keys(item.packaging_data).length > 0 ? (
                                        <div className="flex flex-wrap justify-center gap-1">
                                            {Object.entries(item.packaging_data).map(([mat, w]) => (
                                                <span key={mat} className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-100 whitespace-nowrap">
                                                    {mat}: {formatWeight(w as number)}
                                                </span>
                                            ))}
                                        </div>
                                    ) : item.applies_packaging_fee && item.packaging_weight_kg ? (
                                        <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
                                            {formatWeight(item.packaging_weight_kg)}
                                        </span>
                                    ) : null}
                                    {!item.applies_trod_fee && !item.applies_packaging_fee && (
                                        <span className="text-xs text-slate-400">-</span>
                                    )}
                                </div>
                            </td>
                            <td className="px-2 py-4 text-center">
                                    {editingItem === item.id ? (
                                        <div className="flex items-center justify-center gap-1">
                                            <button
                                                onClick={() => saveEdit(item.id)}
                                                disabled={saving}
                                                className="text-amber-600 hover:text-amber-800 font-bold text-xs disabled:opacity-50"
                                            >
                                                {saving ? '...' : 'Save'}
                                            </button>
                                            <button
                                                onClick={cancelEdit}
                                                className="text-slate-400 hover:text-slate-600 text-xs ml-1"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => startEdit(item)}
                                                className="text-blue-500 hover:text-blue-700"
                                                title="Edit quantity / price"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => removeItem(item.id, item.product_name)}
                                                className="text-red-400 hover:text-red-600"
                                                title="Remove"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    )}
                                </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t">
                    <tr>
                        <td className="px-6 py-3 text-slate-500">Subtotal</td>
                        <td colSpan={5} className="text-right px-4 py-3 font-medium text-slate-800">
                            {formatCurrency(subtotal)}
                        </td>
                        <td></td>
                    </tr>
                    <tr>
                        <td className="px-6 py-3 text-slate-500">Shipping</td>
                        <td colSpan={5} className="text-right px-4 py-3 text-slate-600">
                            {editingShipping ? (
                                <div className="flex items-center justify-end gap-2">
                                    <span className="text-slate-400 text-sm">&euro;</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={editShippingCost}
                                        onChange={e => setEditShippingCost(e.target.value)}
                                        className="w-24 border rounded px-2 py-1 text-sm text-right"
                                        autoFocus
                                    />
                                    <button
                                        onClick={async () => {
                                            const cost = parseFloat(editShippingCost)
                                            if (isNaN(cost) || cost < 0) { alert('Invalid shipping cost'); return }
                                            setSaving(true)
                                            try {
                                                const res = await adminUpdateShippingCost(orderId, cost)
                                                if (res.success) { setEditingShipping(false); router.refresh() }
                                                else { alert('Failed: ' + res.error) }
                                            } finally { setSaving(false) }
                                        }}
                                        disabled={saving}
                                        className="text-amber-600 hover:text-amber-800 font-bold text-xs disabled:opacity-50"
                                    >{saving ? '...' : 'Save'}</button>
                                    <button onClick={() => setEditingShipping(false)} className="text-slate-400 hover:text-slate-600 text-xs">Cancel</button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-end gap-2">
                                    {formatCurrency(shippingCost)}
                                    <button
                                        onClick={() => { setEditShippingCost(String(shippingCost)); setEditingShipping(true) }}
                                        className="text-blue-500 hover:text-blue-700"
                                        title="Edit shipping cost"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                    </button>
                                </div>
                            )}
                        </td>
                        <td></td>
                    </tr>
                    <tr>
                        <td className="px-6 py-3 text-slate-500">VAT ({vatRate}%)</td>
                        <td colSpan={5} className="text-right px-4 py-3 text-slate-600">
                            {formatCurrency(vatAmount)}
                        </td>
                        <td></td>
                    </tr>
                    <tr className="font-bold text-lg">
                        <td className="px-6 py-4 text-slate-800">Total</td>
                        <td colSpan={5} className="text-right px-4 py-4 text-slate-800">
                            {formatCurrency(total)}
                        </td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    )
}
