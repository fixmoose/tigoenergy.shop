'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface OrderItem {
    id: string
    product_name: string
    quantity: number
    sku: string
}

interface WarehouseAction {
    action: string
    by_email: string
    by_name: string
    at: string
    file_url?: string
}

interface WarehouseOrder {
    id: string
    order_number: string
    customer_email: string
    company_name: string | null
    shipping_address: any
    shipping_carrier: string
    shipping_method: string
    packing_slip_url: string | null
    shipping_label_url: string | null
    total: number
    currency: string
    warehouse_actions: WarehouseAction[] | null
    pickup_payment_proof_required: boolean
    created_at: string
    order_items: OrderItem[]
}

export default function WarehousePortal() {
    const [authenticated, setAuthenticated] = useState(false)
    const [password, setPassword] = useState('')
    const [email, setEmail] = useState('')
    const [driverName, setDriverName] = useState('')
    const [emailConfirmed, setEmailConfirmed] = useState(false)
    const [pickupOrders, setPickupOrders] = useState<WarehouseOrder[]>([])
    const [deliveryOrders, setDeliveryOrders] = useState<WarehouseOrder[]>([])
    const [completedOrders, setCompletedOrders] = useState<WarehouseOrder[]>([])
    const [loading, setLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

    // On mount, pre-fill email from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('warehouse_email')
        if (saved) setEmail(saved)
    }, [])

    const handleLogin = () => {
        if (password !== '123456') {
            alert('Napačno geslo')
            return
        }
        if (!email.trim()) {
            alert('Vnesite e-poštni naslov')
            return
        }
        localStorage.setItem('warehouse_email', email.trim())
        setAuthenticated(true)
        setEmailConfirmed(true)
    }

    const fetchOrders = useCallback(async () => {
        if (!email) return
        setLoading(true)
        try {
            const res = await fetch(`/api/warehouse/orders?email=${encodeURIComponent(email)}`)
            if (!res.ok) {
                if (res.status === 401) {
                    setEmailConfirmed(false)
                    setEmail('')
                    localStorage.removeItem('warehouse_email')
                    alert('E-pošta ni pooblaščena za dostop do skladišča. Preverite Admin → Nastavitve → Vozniki.')
                    return
                }
                throw new Error('Failed to fetch')
            }
            const data = await res.json()
            setPickupOrders(data.pickup || [])
            setDeliveryOrders(data.delivery || [])
            setCompletedOrders(data.completed || [])
            setDriverName(data.driverName || '')
        } catch (err) {
            console.error('Failed to fetch orders:', err)
        } finally {
            setLoading(false)
        }
    }, [email])

    // Auto-refresh every 30s — only after email is confirmed
    useEffect(() => {
        if (!emailConfirmed || !email || !authenticated) return
        fetchOrders()
        const interval = setInterval(fetchOrders, 30000)
        return () => clearInterval(interval)
    }, [emailConfirmed, authenticated, fetchOrders, email])

    const toggleAction = async (orderId: string, actionType: string, currentlyChecked: boolean) => {
        const key = orderId + '_' + actionType
        setActionLoading(prev => ({ ...prev, [key]: true }))
        try {
            if (currentlyChecked) {
                // Undo
                await fetch(`/api/warehouse/orders/${orderId}/undo`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, actionType }),
                })
            } else {
                // Do
                const routeMap: Record<string, string> = {
                    marked_prepared: 'prepare',
                    payment_verified: 'verify-payment',
                }
                const route = routeMap[actionType]
                if (route) {
                    await fetch(`/api/warehouse/orders/${orderId}/${route}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email }),
                    })
                }
            }
            await fetchOrders()
        } finally {
            setActionLoading(prev => ({ ...prev, [key]: false }))
        }
    }

    const markPrepared = async (orderId: string) => {
        setActionLoading(prev => ({ ...prev, [orderId + '_prep']: true }))
        try {
            await fetch(`/api/warehouse/orders/${orderId}/prepare`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            })
            await fetchOrders()
        } finally {
            setActionLoading(prev => ({ ...prev, [orderId + '_prep']: false }))
        }
    }

    const uploadDobavnica = async (orderId: string, file: File) => {
        setActionLoading(prev => ({ ...prev, [orderId + '_upload']: true }))
        try {
            const formData = new FormData()
            formData.append('email', email)
            formData.append('file', file)
            await fetch(`/api/warehouse/orders/${orderId}/upload`, {
                method: 'POST',
                body: formData,
            })
            await fetchOrders()
        } finally {
            setActionLoading(prev => ({ ...prev, [orderId + '_upload']: false }))
        }
    }

    const verifyPayment = async (orderId: string) => {
        if (!confirm('Potrditi, da je dokazilo o plačilu preverjeno?')) return
        setActionLoading(prev => ({ ...prev, [orderId + '_payment']: true }))
        try {
            await fetch(`/api/warehouse/orders/${orderId}/verify-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            })
            await fetchOrders()
        } finally {
            setActionLoading(prev => ({ ...prev, [orderId + '_payment']: false }))
        }
    }

    const markComplete = async (orderId: string, type: 'pickup' | 'dpd') => {
        const label = type === 'pickup' ? 'prevzeto s strani stranke' : 'prevzeto s strani DPD'
        if (!confirm(`Označiti naročilo kot ${label}? Naročilo bo odstranjeno s seznama.`)) return
        setActionLoading(prev => ({ ...prev, [orderId + '_complete']: true }))
        try {
            await fetch(`/api/warehouse/orders/${orderId}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, type }),
            })
            await fetchOrders()
        } finally {
            setActionLoading(prev => ({ ...prev, [orderId + '_complete']: false }))
        }
    }

    // Helper: check if action exists
    const hasAction = (order: WarehouseOrder, actionType: string) => {
        return (order.warehouse_actions || []).some(a => a.action === actionType)
    }

    const getUploadedDobavnica = (order: WarehouseOrder) => {
        return (order.warehouse_actions || []).find(a => a.action === 'uploaded_dobavnica')
    }

    // ── Login screen (email + password together) ──
    if (!authenticated || !emailConfirmed) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="bg-slate-800 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
                    <div className="text-center mb-6">
                        <div className="w-14 h-14 bg-orange-500 rounded-xl flex items-center justify-center mx-auto mb-3">
                            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
                            </svg>
                        </div>
                        <h1 className="text-xl font-bold text-white">Skladišče</h1>
                        <p className="text-slate-400 text-sm mt-1">Tigo Energy</p>
                    </div>
                    <input
                        type="email"
                        placeholder="E-poštni naslov"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleLogin()}
                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 mb-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <input
                        type="password"
                        placeholder="Geslo"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleLogin()}
                        className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 mb-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <button onClick={handleLogin} className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg transition">
                        Vstopi
                    </button>
                </div>
            </div>
        )
    }

    // ── Dashboard ──
    return (
        <div className="min-h-screen bg-slate-900">
            {/* Header */}
            <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-white font-bold text-sm">Skladišče</h1>
                        <p className="text-slate-400 text-xs">{driverName || email}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={fetchOrders} disabled={loading}
                        className="text-xs px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition disabled:opacity-50">
                        {loading ? 'Nalagam...' : 'Osveži'}
                    </button>
                    <button onClick={() => { setAuthenticated(false); setEmail(''); setPassword(''); setEmailConfirmed(false) }}
                        className="text-xs px-3 py-1.5 bg-slate-700 text-slate-400 rounded-lg hover:bg-slate-600 transition">
                        Odjava
                    </button>
                </div>
            </div>

            {/* Two columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 max-w-7xl mx-auto">
                {/* Pickup column */}
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-3 h-3 bg-blue-500 rounded-full" />
                        <h2 className="text-white font-bold text-sm uppercase tracking-wide">
                            Lastni prevzem
                        </h2>
                        <span className="text-slate-500 text-xs">({pickupOrders.length})</span>
                    </div>
                    {pickupOrders.length === 0 ? (
                        <div className="text-slate-500 text-sm text-center py-8 bg-slate-800/50 rounded-xl border border-slate-700/50">
                            Ni naročil za prevzem
                        </div>
                    ) : pickupOrders.map(order => (
                        <OrderCard
                            key={order.id}
                            order={order}
                            type="pickup"
                            email={email}
                            actionLoading={actionLoading}
                            hasAction={hasAction}
                            getUploadedDobavnica={getUploadedDobavnica}
                            onToggleAction={toggleAction}
                            onUpload={uploadDobavnica}
                            onComplete={markComplete}
                        />
                    ))}
                </div>

                {/* DPD column */}
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-3 h-3 bg-red-500 rounded-full" />
                        <h2 className="text-white font-bold text-sm uppercase tracking-wide">
                            DPD Dostava
                        </h2>
                        <span className="text-slate-500 text-xs">({deliveryOrders.length})</span>
                    </div>
                    {deliveryOrders.length === 0 ? (
                        <div className="text-slate-500 text-sm text-center py-8 bg-slate-800/50 rounded-xl border border-slate-700/50">
                            Ni naročil za dostavo
                        </div>
                    ) : deliveryOrders.map(order => (
                        <OrderCard
                            key={order.id}
                            order={order}
                            type="dpd"
                            email={email}
                            actionLoading={actionLoading}
                            hasAction={hasAction}
                            getUploadedDobavnica={getUploadedDobavnica}
                            onToggleAction={toggleAction}
                            onUpload={uploadDobavnica}
                            onComplete={markComplete}
                        />
                    ))}
                </div>
            </div>

            {/* Completed orders — reference list */}
            {completedOrders.length > 0 && (
                <div className="px-4 pb-6 max-w-7xl mx-auto">
                    <div className="border-t border-slate-700 pt-4 mt-2">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-3 h-3 bg-slate-500 rounded-full" />
                            <h2 className="text-slate-400 font-bold text-sm uppercase tracking-wide">
                                Zaključena naročila (zadnjih 7 dni)
                            </h2>
                            <span className="text-slate-600 text-xs">({completedOrders.length})</span>
                        </div>
                        <div className="space-y-1">
                            {completedOrders.map(order => {
                                const addr = order.shipping_address
                                const customerName = addr
                                    ? `${addr.first_name || ''} ${addr.last_name || ''}`.trim()
                                    : order.customer_email
                                const isPickup = order.shipping_carrier === 'Personal Pick-up'
                                const actions = order.warehouse_actions || []
                                const preparedAt = actions.find(a => a.action === 'marked_prepared')?.at
                                const completedAt = actions.find(a => a.action === 'marked_picked_up' || a.action === 'marked_dpd_picked_up')?.at

                                return (
                                    <div key={order.id} className="flex items-center gap-3 px-3 py-2 bg-slate-800/40 rounded-lg border border-slate-700/30 text-xs">
                                        <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                                            isPickup ? 'bg-blue-900/40 text-blue-400' : 'bg-red-900/40 text-red-400'
                                        }`}>
                                            {isPickup ? 'PREVZEM' : 'DPD'}
                                        </span>
                                        <span className="text-orange-400 font-mono font-bold">{order.order_number}</span>
                                        <span className="text-slate-300 truncate flex-1">{customerName}{order.company_name ? ` (${order.company_name})` : ''}</span>
                                        <span className="text-slate-500">EUR {order.total?.toFixed(2)}</span>
                                        {completedAt && (
                                            <span className="text-green-500/70">
                                                {new Date(completedAt).toLocaleDateString('sl-SI')} {new Date(completedAt).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        )}
                                        <span className="text-green-500">✓</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Order Card ──
function OrderCard({
    order, type, email, actionLoading, hasAction, getUploadedDobavnica,
    onToggleAction, onUpload, onComplete,
}: {
    order: WarehouseOrder
    type: 'pickup' | 'dpd'
    email: string
    actionLoading: Record<string, boolean>
    hasAction: (order: WarehouseOrder, action: string) => boolean
    getUploadedDobavnica: (order: WarehouseOrder) => WarehouseAction | undefined
    onToggleAction: (id: string, actionType: string, currentlyChecked: boolean) => void
    onUpload: (id: string, file: File) => void
    onComplete: (id: string, type: 'pickup' | 'dpd') => void
}) {
    const isPrepared = hasAction(order, 'marked_prepared')
    const isPaymentVerified = hasAction(order, 'payment_verified')
    const dobavnica = getUploadedDobavnica(order)
    const addr = order.shipping_address
    const customerName = addr
        ? `${addr.first_name || ''} ${addr.last_name || ''}`.trim()
        : order.customer_email

    // Can finalize? Prepared must be checked. Payment must be verified if required.
    const canFinalize = isPrepared && (!order.pickup_payment_proof_required || isPaymentVerified)

    return (
        <div className={`bg-slate-800 rounded-xl border mb-3 overflow-hidden transition-all ${
            isPrepared ? 'border-green-600/50' : 'border-slate-700'
        }`}>
            {/* Payment proof warning */}
            {order.pickup_payment_proof_required && !isPaymentVerified && (
                <div className="bg-red-900/60 border-b border-red-700/50 px-4 py-2 text-center">
                    <p className="text-red-200 text-xs font-bold">
                        OBVEZNO PREVERI DOKAZ O PLAČILU PRED IZDAJO BLAGA
                    </p>
                </div>
            )}

            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-700/50">
                <div className="flex items-center justify-between">
                    <div>
                        <span className="text-orange-400 font-mono font-bold text-sm">{order.order_number}</span>
                        <span className="text-slate-500 text-xs ml-2">
                            {new Date(order.created_at).toLocaleDateString('sl-SI')}
                        </span>
                    </div>
                    <span className="text-white font-bold text-sm">EUR {order.total?.toFixed(2)}</span>
                </div>
                <p className="text-white text-sm mt-1">{customerName}{order.company_name ? ` (${order.company_name})` : ''}</p>
                {type === 'dpd' && addr && (
                    <p className="text-slate-400 text-xs mt-0.5">
                        {addr.street}, {addr.postal_code} {addr.city}, {addr.country}
                    </p>
                )}
            </div>

            {/* Items */}
            <div className="px-4 py-2 border-b border-slate-700/30">
                {order.order_items?.map(item => (
                    <div key={item.id} className="flex justify-between text-xs py-0.5">
                        <span className="text-slate-300">{item.product_name}</span>
                        <span className="text-slate-400 font-mono">x{item.quantity}</span>
                    </div>
                ))}
            </div>

            {/* Actions */}
            <div className="px-4 py-3 space-y-2.5">
                {/* Download packing slip */}
                {(() => {
                    const slipUrl = order.packing_slip_url || `/api/orders/${order.id}/packing-slip`
                    return (
                    <a
                        href={`${slipUrl}${slipUrl.includes('?') ? '&' : '?'}warehouse_email=${encodeURIComponent(email)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-medium transition"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Prenesi dobavnico
                    </a>
                    )
                })()}

                {/* Download shipping label (DPD) */}
                {type === 'dpd' && order.shipping_label_url && (
                    <a
                        href={`${order.shipping_label_url}${order.shipping_label_url.includes('?') ? '&' : '?'}warehouse_email=${encodeURIComponent(email)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-medium transition"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        Prenesi nalepko za pošiljko
                    </a>
                )}

                {/* Prepared checkbox — toggleable */}
                <label className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition ${
                    isPrepared ? 'bg-green-900/30 border border-green-700/40' : 'bg-slate-700/40 border border-slate-600/30 hover:bg-slate-700/60'
                }`}>
                    <input
                        type="checkbox"
                        checked={isPrepared}
                        disabled={actionLoading[order.id + '_marked_prepared']}
                        onChange={() => onToggleAction(order.id, 'marked_prepared', isPrepared)}
                        className="w-6 h-6 rounded border-2 border-slate-500 text-green-500 focus:ring-green-500 bg-slate-700 cursor-pointer"
                    />
                    <span className={`font-bold text-sm ${isPrepared ? 'text-green-400' : 'text-slate-300'}`}>
                        {actionLoading[order.id + '_marked_prepared'] ? 'Shranjujem...' : isPrepared ? 'Pripravljeno' : 'Označi kot pripravljeno'}
                    </span>
                </label>

                {/* Upload dobavnica — drag & drop, browse, or phone camera via QR */}
                {dobavnica ? (
                    <div className="p-2.5 rounded-lg border bg-green-900/20 border-green-700/30">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-green-400 text-sm font-medium">Dobavnica naložena</span>
                            {dobavnica.file_url && (
                                <a
                                    href={`${dobavnica.file_url}${dobavnica.file_url.includes('?') ? '&' : '?'}warehouse_email=${encodeURIComponent(email)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 text-xs hover:underline ml-auto"
                                >
                                    Poglej
                                </a>
                            )}
                        </div>
                    </div>
                ) : (
                    <DropZone
                        orderId={order.id}
                        orderNumber={order.order_number}
                        email={email}
                        loading={actionLoading[order.id + '_upload']}
                        onFile={(file) => onUpload(order.id, file)}
                    />
                )}

                {/* Payment verification checkbox — toggleable (only for payment-proof-required orders) */}
                {order.pickup_payment_proof_required && (
                    <label className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition ${
                        isPaymentVerified
                            ? 'bg-green-900/30 border border-green-700/40'
                            : 'bg-red-900/20 border border-red-700/30 hover:bg-red-900/30'
                    }`}>
                        <input
                            type="checkbox"
                            checked={isPaymentVerified}
                            disabled={actionLoading[order.id + '_payment_verified']}
                            onChange={() => onToggleAction(order.id, 'payment_verified', isPaymentVerified)}
                            className="w-6 h-6 rounded border-2 border-red-500 text-green-500 focus:ring-green-500 bg-slate-700 cursor-pointer"
                        />
                        <span className={`font-bold text-sm ${isPaymentVerified ? 'text-green-400' : 'text-red-300'}`}>
                            {actionLoading[order.id + '_payment_verified'] ? 'Shranjujem...' : isPaymentVerified ? 'Plačilo preverjeno' : 'Preveri dokazilo o plačilu'}
                        </span>
                    </label>
                )}

                {/* Zaključi naročilo button */}
                <button
                    disabled={!canFinalize || actionLoading[order.id + '_complete']}
                    onClick={() => {
                        const label = type === 'pickup' ? 'prevzeto s strani stranke' : 'prevzeto s strani DPD'
                        if (confirm(`Zaključi naročilo #${order.order_number} kot ${label}?\n\nTo dejanje ni mogoče razveljaviti.`)) {
                            onComplete(order.id, type)
                        }
                    }}
                    className={`w-full py-3 rounded-lg font-bold text-sm transition ${
                        canFinalize
                            ? 'bg-orange-500 hover:bg-orange-600 text-white cursor-pointer'
                            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                >
                    {actionLoading[order.id + '_complete']
                        ? 'Zaključujem...'
                        : type === 'pickup'
                            ? 'Zaključi naročilo'
                            : 'Zaključi naročilo'
                    }
                </button>
                {!canFinalize && (
                    <p className="text-slate-500 text-[10px] text-center">
                        {!isPrepared ? 'Najprej označi kot pripravljeno' : 'Najprej preveri dokazilo o plačilu'}
                    </p>
                )}
            </div>
        </div>
    )
}

// ── Drag & Drop Upload Zone with QR phone option ──
function DropZone({ orderId, orderNumber, email, loading, onFile }: {
    orderId: string; orderNumber: string; email: string; loading: boolean; onFile: (file: File) => void
}) {
    const [dragging, setDragging] = useState(false)
    const [showQR, setShowQR] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files?.[0]
        if (file && !loading) onFile(file)
    }

    const uploadUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/warehouse/upload?order=${orderId}&email=${encodeURIComponent(email)}&num=${encodeURIComponent(orderNumber)}`
        : ''
    const qrSrc = uploadUrl
        ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(uploadUrl)}`
        : ''

    return (
        <div className="space-y-2">
            <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => !loading && inputRef.current?.click()}
                className={`p-4 rounded-lg border-2 border-dashed text-center cursor-pointer transition ${
                    loading
                        ? 'border-slate-600 bg-slate-700/30 cursor-wait'
                        : dragging
                            ? 'border-orange-400 bg-orange-900/20'
                            : 'border-slate-600 bg-slate-700/20 hover:border-slate-500 hover:bg-slate-700/40'
                }`}
            >
                <input
                    ref={inputRef}
                    type="file"
                    className="hidden"
                    disabled={loading}
                    onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) onFile(file)
                        e.target.value = ''
                    }}
                />
                {loading ? (
                    <p className="text-slate-400 text-sm font-medium">Nalagam...</p>
                ) : (
                    <>
                        <svg className="w-6 h-6 text-slate-400 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <p className="text-slate-300 text-sm font-medium">Podpisano dobavnico naloži tukaj</p>
                        <p className="text-slate-500 text-xs mt-0.5">povleci datoteko ali klikni za izbiro</p>
                    </>
                )}
            </div>
            {/* Phone camera via QR */}
            <button
                type="button"
                onClick={() => setShowQR(!showQR)}
                className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-xs transition w-full justify-center"
            >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3" />
                </svg>
                {showQR ? 'Skrij QR kodo' : 'ali fotografiraj s telefona'}
            </button>
            {showQR && qrSrc && (
                <div className="bg-white rounded-xl p-4 text-center">
                    <img src={qrSrc} alt="QR" className="mx-auto w-[140px] h-[140px]" />
                    <p className="text-slate-700 text-xs font-bold mt-2">Skeniraj s telefonom</p>
                    <p className="text-slate-500 text-[10px]">Odpre kamero za fotografiranje dobavnice</p>
                </div>
            )}
        </div>
    )
}
