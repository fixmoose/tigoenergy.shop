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
    file_name?: string
    comment?: string
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
    invoice_url: string | null
    invoice_number: string | null
    total: number
    currency: string
    warehouse_actions: WarehouseAction[] | null
    pickup_payment_proof_required: boolean
    created_at: string
    order_items: OrderItem[]
    // Split shipping virtual fields
    _split_carrier?: string
    _split_part?: number
    _split_total?: number
    _split_carrier_param?: string
    // Delivery (partial dobavnica) virtual fields
    _delivery_id?: string
    _delivery_part?: number
    _delivery_total?: number
    _delivery_status?: 'pending' | 'prepared' | 'completed'
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
    const [completedTotal, setCompletedTotal] = useState(0)
    const [completedOffset, setCompletedOffset] = useState(0)
    const [loadingMore, setLoadingMore] = useState(false)
    const [loading, setLoading] = useState(false)
    const [msgText, setMsgText] = useState('')
    const [msgFile, setMsgFile] = useState<File | null>(null)
    const [msgSending, setMsgSending] = useState(false)
    const [msgStatus, setMsgStatus] = useState<string | null>(null)
    const [expandedCompletedId, setExpandedCompletedId] = useState<string | null>(null)
    const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
    const COMPLETED_PAGE_SIZE = 20

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
            const res = await fetch(`/api/warehouse/orders?email=${encodeURIComponent(email)}&completed_days=30&completed_limit=${COMPLETED_PAGE_SIZE}&completed_offset=0`)
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
            setCompletedTotal(data.completedTotal || 0)
            setCompletedOffset(COMPLETED_PAGE_SIZE)
            setDriverName(data.driverName || '')
        } catch (err) {
            console.error('Failed to fetch orders:', err)
        } finally {
            setLoading(false)
        }
    }, [email])

    const loadMoreCompleted = useCallback(async () => {
        if (!email) return
        setLoadingMore(true)
        try {
            const res = await fetch(`/api/warehouse/orders?email=${encodeURIComponent(email)}&completed_days=30&completed_limit=${COMPLETED_PAGE_SIZE}&completed_offset=${completedOffset}`)
            if (!res.ok) throw new Error('Failed to fetch')
            const data = await res.json()
            setCompletedOrders(prev => [...prev, ...(data.completed || [])])
            setCompletedTotal(data.completedTotal || 0)
            setCompletedOffset(prev => prev + COMPLETED_PAGE_SIZE)
        } catch (err) {
            console.error('Failed to load more:', err)
        } finally {
            setLoadingMore(false)
        }
    }, [email, completedOffset])

    // Auto-refresh every 30s — only after email is confirmed
    useEffect(() => {
        if (!emailConfirmed || !email || !authenticated) return
        fetchOrders()
        const interval = setInterval(fetchOrders, 30000)
        return () => clearInterval(interval)
    }, [emailConfirmed, authenticated, fetchOrders, email])

    const toggleAction = async (orderId: string, actionType: string, currentlyChecked: boolean, deliveryId?: string) => {
        const key = (deliveryId || orderId) + '_' + actionType
        setActionLoading(prev => ({ ...prev, [key]: true }))
        try {
            if (currentlyChecked) {
                // Undo
                await fetch(`/api/warehouse/orders/${orderId}/undo`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, actionType, delivery_id: deliveryId }),
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
                        body: JSON.stringify({ email, delivery_id: deliveryId }),
                    })
                }
            }
            await fetchOrders()
        } finally {
            setActionLoading(prev => ({ ...prev, [key]: false }))
        }
    }

    const uploadDobavnica = async (orderId: string, file: File, deliveryId?: string) => {
        const key = (deliveryId || orderId) + '_upload'
        setActionLoading(prev => ({ ...prev, [key]: true }))
        try {
            const formData = new FormData()
            formData.append('email', email)
            formData.append('file', file)
            if (deliveryId) formData.append('delivery_id', deliveryId)
            const res = await fetch(`/api/warehouse/orders/${orderId}/upload`, {
                method: 'POST',
                body: formData,
            })
            if (!res.ok) {
                let msg = 'Napaka pri nalaganju'
                try { const j = await res.json(); if (j?.error) msg = j.error } catch { /* ignore */ }
                alert(msg)
                return
            }
            await fetchOrders()
        } catch (err) {
            console.error('Upload failed:', err)
            alert('Napaka pri nalaganju')
        } finally {
            setActionLoading(prev => ({ ...prev, [key]: false }))
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

    const markComplete = async (orderId: string, type: 'pickup' | 'dpd', comment?: string, deliveryId?: string) => {
        const loadingKey = (deliveryId || orderId) + '_complete'
        setActionLoading(prev => ({ ...prev, [loadingKey]: true }))
        try {
            await fetch(`/api/warehouse/orders/${orderId}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, type, comment: comment || undefined, delivery_id: deliveryId }),
            })
            await fetchOrders()
        } finally {
            setActionLoading(prev => ({ ...prev, [loadingKey]: false }))
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
                        <p className="text-slate-400 text-sm mt-1">Initra Energija</p>
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
                            key={order._delivery_id || order.id}
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
                            key={order._delivery_id || order.id}
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
                                Zaključena naročila (zadnjih 30 dni)
                            </h2>
                            <span className="text-slate-600 text-xs">({completedOrders.length}{completedTotal > completedOrders.length ? ` / ${completedTotal}` : ''})</span>
                        </div>
                        <div className="space-y-1">
                            {completedOrders.map(order => {
                                const addr = order.shipping_address
                                const customerName = addr
                                    ? `${addr.first_name || ''} ${addr.last_name || ''}`.trim()
                                    : order.customer_email
                                const isPickup = order.shipping_carrier === 'Personal Pick-up'
                                const actions = order.warehouse_actions || []
                                const completedAt = actions.find(a => a.action === 'marked_picked_up' || a.action === 'marked_dpd_picked_up')?.at
                                const isExpanded = expandedCompletedId === order.id
                                const dobavnicaActions = actions.filter(a => a.action === 'uploaded_dobavnica' && a.file_url)
                                const messageActions = actions.filter(a => (a as any).action === 'warehouse_message')
                                // Build downloadable document list. Storage URLs need
                                // ?warehouse_email= for the API to authorise the download.
                                const withAuth = (url: string) => `${url}${url.includes('?') ? '&' : '?'}warehouse_email=${encodeURIComponent(email)}`
                                const docs: { label: string; url: string }[] = []
                                if (order.invoice_url) docs.push({ label: order.invoice_number ? `Račun ${order.invoice_number}` : 'Račun', url: withAuth(order.invoice_url) })
                                if (order.packing_slip_url) docs.push({ label: 'Dobavnica (sistem)', url: withAuth(order.packing_slip_url) })
                                if (order.shipping_label_url) docs.push({ label: 'Etiketa DPD', url: withAuth(order.shipping_label_url) })
                                dobavnicaActions.forEach((a, i) => {
                                    docs.push({ label: dobavnicaActions.length > 1 ? `Podpisana dobavnica ${i + 1}` : 'Podpisana dobavnica', url: withAuth(a.file_url!) })
                                })

                                return (
                                    <div key={order.id} className="bg-slate-800/40 rounded-lg border border-slate-700/30">
                                        <button
                                            type="button"
                                            onClick={() => setExpandedCompletedId(isExpanded ? null : order.id)}
                                            className="w-full flex items-center gap-3 px-3 py-2 text-xs hover:bg-slate-800/60 transition rounded-lg"
                                        >
                                            <svg className={`w-3 h-3 text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                            </svg>
                                            <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                                                isPickup ? 'bg-blue-900/40 text-blue-400' : 'bg-red-900/40 text-red-400'
                                            }`}>
                                                {isPickup ? 'PREVZEM' : 'DPD'}
                                            </span>
                                            <span className="text-orange-400 font-mono font-bold">{order.order_number}</span>
                                            <span className="text-slate-300 truncate flex-1 text-left">{customerName}{order.company_name ? ` (${order.company_name})` : ''}</span>
                                            <span className="text-slate-500">{order.order_items?.length || 0} items</span>
                                            {docs.length > 0 && (
                                                <span className="text-slate-400 bg-slate-700/50 px-1.5 py-0.5 rounded text-[10px]">📎 {docs.length}</span>
                                            )}
                                            {messageActions.length > 0 && (
                                                <span className="text-slate-400 bg-slate-700/50 px-1.5 py-0.5 rounded text-[10px]">💬 {messageActions.length}</span>
                                            )}
                                            {completedAt && (
                                                <span className="text-amber-500/70">
                                                    {new Date(completedAt).toLocaleDateString('sl-SI')} {new Date(completedAt).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            )}
                                            <span className="text-amber-500">✓</span>
                                        </button>
                                        {isExpanded && (
                                            <div className="px-4 pb-3 pt-1 border-t border-slate-700/30 space-y-2">
                                                {docs.length === 0 ? (
                                                    <p className="text-slate-500 text-xs italic">Ni priloženih dokumentov.</p>
                                                ) : (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                                        {docs.map((doc, i) => (
                                                            <a
                                                                key={i}
                                                                href={doc.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-2 px-3 py-2 bg-slate-700/40 hover:bg-slate-700/70 border border-slate-600/30 rounded text-xs text-slate-200 transition"
                                                            >
                                                                <svg className="w-4 h-4 text-orange-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                </svg>
                                                                <span className="truncate">{doc.label}</span>
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                                {/* Sent messages — for worker's record */}
                                                {messageActions.length > 0 && (
                                                    <div className="mt-2 pt-2 border-t border-slate-700/30 space-y-1.5">
                                                        <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Sporočila</div>
                                                        {messageActions.map((m, i) => {
                                                            const msg = m as any
                                                            return (
                                                                <div key={i} className="bg-slate-700/30 border border-slate-600/30 rounded px-2.5 py-1.5">
                                                                    <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                                                                        <span>{msg.by_name}</span>
                                                                        <span>{new Date(msg.at).toLocaleString('sl-SI', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                                                    </div>
                                                                    {msg.comment && <p className="text-[11px] text-slate-200 whitespace-pre-wrap break-words">{msg.comment}</p>}
                                                                    {msg.file_url && (
                                                                        <a
                                                                            href={withAuth(msg.file_url)}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="inline-flex items-center gap-1 text-blue-400 hover:underline text-[10px] mt-1"
                                                                        >
                                                                            📎 {msg.file_name || 'priloga'}
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}

                                                {/* Show order item summary */}
                                                {order.order_items && order.order_items.length > 0 && (
                                                    <div className="text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-700/30">
                                                        {order.order_items.map(it => (
                                                            <div key={it.id} className="flex gap-2">
                                                                <span className="text-slate-500">{it.quantity}×</span>
                                                                <span className="font-mono text-slate-500 text-[10px]">{it.sku}</span>
                                                                <span className="truncate">{it.product_name}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                        {completedTotal > completedOrders.length && (
                            <button
                                onClick={loadMoreCompleted}
                                disabled={loadingMore}
                                className="w-full mt-3 py-2.5 bg-slate-800 border border-slate-700 text-slate-400 rounded-lg text-xs font-medium hover:bg-slate-700 hover:text-slate-300 transition disabled:opacity-50"
                            >
                                {loadingMore ? 'Nalagam...' : `Prikaži več (${completedTotal - completedOrders.length} preostalih)`}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ── Message to Admin ── */}
            <div className="px-4 pb-6 max-w-7xl mx-auto">
                <div className="border-t border-slate-700 pt-4 mt-2">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-3 h-3 bg-orange-500 rounded-full" />
                        <h2 className="text-white font-bold text-sm uppercase tracking-wide">
                            Sporočilo za admina
                        </h2>
                    </div>
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 space-y-3">
                        <textarea
                            value={msgText}
                            onChange={e => setMsgText(e.target.value)}
                            placeholder="Napiši sporočilo adminu..."
                            rows={3}
                            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                        />
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 cursor-pointer transition">
                                <input
                                    type="file"
                                    className="hidden"
                                    onChange={e => setMsgFile(e.target.files?.[0] || null)}
                                />
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                </svg>
                                {msgFile ? (
                                    <span className="text-orange-400 font-medium truncate max-w-[200px]">{msgFile.name}</span>
                                ) : (
                                    'Priloži dokument'
                                )}
                            </label>
                            <div className="flex-1" />
                            <button
                                onClick={async () => {
                                    if (!msgText.trim() && !msgFile) return
                                    setMsgSending(true)
                                    setMsgStatus(null)
                                    try {
                                        const fd = new FormData()
                                        fd.append('email', email)
                                        if (msgText.trim()) fd.append('message', msgText.trim())
                                        if (msgFile) fd.append('file', msgFile)
                                        const res = await fetch('/api/warehouse/message', { method: 'POST', body: fd })
                                        const data = await res.json()
                                        if (data.success) {
                                            setMsgText('')
                                            setMsgFile(null)
                                            setMsgStatus('✓ Poslano')
                                            setTimeout(() => setMsgStatus(null), 5000)
                                        } else {
                                            setMsgStatus('✗ Napaka: ' + (data.error || ''))
                                        }
                                    } catch {
                                        setMsgStatus('✗ Napaka pri pošiljanju')
                                    } finally {
                                        setMsgSending(false)
                                    }
                                }}
                                disabled={msgSending || (!msgText.trim() && !msgFile)}
                                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-lg transition disabled:opacity-50"
                            >
                                {msgSending ? 'Pošiljam...' : 'Pošlji'}
                            </button>
                        </div>
                        {msgStatus && (
                            <p className={`text-xs font-medium ${msgStatus.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                                {msgStatus}
                            </p>
                        )}
                    </div>
                </div>
            </div>
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
    onToggleAction: (id: string, actionType: string, currentlyChecked: boolean, deliveryId?: string) => void
    onUpload: (id: string, file: File, deliveryId?: string) => void
    onComplete: (id: string, type: 'pickup' | 'dpd', comment?: string, deliveryId?: string) => void
}) {
    const [showMsgForm, setShowMsgForm] = useState(false)
    const [msgText, setMsgText] = useState('')
    const [msgFile, setMsgFile] = useState<File | null>(null)
    const [msgSending, setMsgSending] = useState(false)
    const [msgStatus, setMsgStatus] = useState<string | null>(null)
    const isPrepared = hasAction(order, 'marked_prepared')
    const isPaymentVerified = hasAction(order, 'payment_verified')
    const dobavnica = getUploadedDobavnica(order)
    const priorMessages = (order.warehouse_actions || []).filter(a => a.action === 'warehouse_message')
    const addr = order.shipping_address
    const customerName = addr
        ? `${addr.first_name || ''} ${addr.last_name || ''}`.trim()
        : order.customer_email

    const sendOrderMessage = async () => {
        if (!msgText.trim() && !msgFile) return
        setMsgSending(true)
        setMsgStatus(null)
        try {
            const fd = new FormData()
            fd.append('email', email)
            fd.append('order_id', order.id)
            if (order._delivery_id) fd.append('delivery_id', order._delivery_id)
            if (msgText.trim()) fd.append('message', msgText.trim())
            if (msgFile) fd.append('file', msgFile)
            const res = await fetch('/api/warehouse/message', { method: 'POST', body: fd })
            const data = await res.json()
            if (data.success) {
                setMsgText('')
                setMsgFile(null)
                setMsgStatus('✓ Poslano')
                setTimeout(() => setMsgStatus(null), 4000)
            } else {
                setMsgStatus('✗ Napaka: ' + (data.error || ''))
            }
        } catch {
            setMsgStatus('✗ Napaka pri pošiljanju')
        } finally {
            setMsgSending(false)
        }
    }

    // Can finalize? Prepared must be checked. Payment must be verified if required.
    const canFinalize = isPrepared && (!order.pickup_payment_proof_required || isPaymentVerified)

    return (
        <div className={`bg-slate-800 rounded-xl border mb-3 overflow-hidden transition-all ${
            isPrepared ? 'border-amber-600/50' : 'border-slate-700'
        }`}>
            {/* Payment proof warning */}
            {order.pickup_payment_proof_required && !isPaymentVerified && (
                <div className="bg-red-900/60 border-b border-red-700/50 px-4 py-2 text-center">
                    <p className="text-red-200 text-xs font-bold">
                        OBVEZNO PREVERI DOKAZ O PLAČILU PRED IZDAJO BLAGA
                    </p>
                </div>
            )}

            {/* Split shipping badge */}
            {order._split_part && order._split_total && (
                <div className="bg-purple-900/60 border-b border-purple-700/50 px-4 py-1.5 flex items-center gap-2">
                    <span className="text-purple-200 text-[10px] font-bold uppercase tracking-wider">Deljeno naročilo</span>
                    <span className="bg-purple-700 text-purple-100 text-[10px] font-bold px-2 py-0.5 rounded">
                        {order._split_part}/{order._split_total}
                    </span>
                    <span className="text-purple-300 text-[10px]">{order._split_carrier}</span>
                </div>
            )}

            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-700/50">
                <div className="flex items-center justify-between">
                    <div>
                        <span className="text-orange-400 font-mono font-bold text-sm">
                            {order.order_number}
                            {order._delivery_part ? ` — Dobavnica ${order._delivery_part}/${order._delivery_total}` : (order._split_part ? ` (${order._split_part}/${order._split_total})` : '')}
                        </span>
                        <span className="text-slate-500 text-xs ml-2">
                            {new Date(order.created_at).toLocaleDateString('sl-SI')}
                        </span>
                    </div>
                </div>
                <p className="text-white text-sm mt-1">{customerName}{order.company_name ? ` (${order.company_name})` : ''}</p>
                {type === 'dpd' && addr && (
                    <p className="text-slate-400 text-xs mt-0.5">
                        {addr.street}, {addr.postal_code} {addr.city}, {addr.country}
                    </p>
                )}
            </div>

            {/* Items — honour any ?exclude= on the order's packing_slip_url so
                already-delivered items in a partial-delivery scenario aren't
                shown to the warehouse worker prepping the next pickup. */}
            <div className="px-4 py-2 border-b border-slate-700/30">
                {(() => {
                    let visibleItems = order.order_items || []
                    const excludedIds = new Set<string>()
                    if (order.packing_slip_url) {
                        try {
                            const u = new URL(order.packing_slip_url, 'https://x')
                            const exclude = u.searchParams.get('exclude')
                            if (exclude) exclude.split(',').forEach(id => excludedIds.add(id.trim()))
                        } catch { /* ignore malformed url */ }
                    }
                    if (excludedIds.size > 0) {
                        visibleItems = visibleItems.filter(it => !excludedIds.has(it.id))
                    }
                    return visibleItems.map(item => (
                        <div key={item.id} className="flex justify-between text-xs py-0.5">
                            <span className="text-slate-300">{item.product_name}</span>
                            <span className="text-slate-400 font-mono">x{item.quantity}</span>
                        </div>
                    ))
                })()}
            </div>

            {/* Actions */}
            <div className="px-4 py-3 space-y-2.5">
                {/* Download packing slip — prefer the order's packing_slip_url
                    if set (carries any ?exclude= or ?part= overrides for
                    partial deliveries), otherwise fall back to the default
                    route. */}
                {(() => {
                    let slipUrl = order.packing_slip_url
                        ? (order.packing_slip_url.startsWith('http') ? new URL(order.packing_slip_url).pathname + new URL(order.packing_slip_url).search : order.packing_slip_url)
                        : `/api/orders/${order.id}/packing-slip`
                    if (order._split_carrier_param && order._split_part && order._split_total && !slipUrl.includes('carrier=')) {
                        slipUrl += `${slipUrl.includes('?') ? '&' : '?'}carrier=${order._split_carrier_param}&part=${order._split_part}&totalParts=${order._split_total}`
                    }
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
                    isPrepared ? 'bg-amber-900/30 border border-amber-700/40' : 'bg-slate-700/40 border border-slate-600/30 hover:bg-slate-700/60'
                }`}>
                    <input
                        type="checkbox"
                        checked={isPrepared}
                        disabled={actionLoading[(order._delivery_id || order.id) + '_marked_prepared']}
                        onChange={() => onToggleAction(order.id, 'marked_prepared', isPrepared, order._delivery_id)}
                        className="w-6 h-6 rounded border-2 border-slate-500 text-amber-500 focus:ring-amber-500 bg-slate-700 cursor-pointer"
                    />
                    <span className={`font-bold text-sm ${isPrepared ? 'text-amber-400' : 'text-slate-300'}`}>
                        {actionLoading[(order._delivery_id || order.id) + '_marked_prepared'] ? 'Shranjujem...' : isPrepared ? 'Pripravljeno' : 'Označi kot pripravljeno'}
                    </span>
                </label>

                {/* Upload dobavnica — drag & drop, browse, or phone camera via QR */}
                {dobavnica ? (
                    <div className="p-2.5 rounded-lg border bg-amber-900/20 border-amber-700/30">
                        <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-amber-400 text-sm font-medium">Dobavnica naložena</span>
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
                        loading={actionLoading[(order._delivery_id || order.id) + '_upload']}
                        onFile={(file) => onUpload(order.id, file, order._delivery_id)}
                    />
                )}

                {/* Payment verification checkbox — toggleable (only for payment-proof-required orders) */}
                {order.pickup_payment_proof_required && (
                    <label className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition ${
                        isPaymentVerified
                            ? 'bg-amber-900/30 border border-amber-700/40'
                            : 'bg-red-900/20 border border-red-700/30 hover:bg-red-900/30'
                    }`}>
                        <input
                            type="checkbox"
                            checked={isPaymentVerified}
                            disabled={actionLoading[(order._delivery_id || order.id) + '_payment_verified']}
                            onChange={() => onToggleAction(order.id, 'payment_verified', isPaymentVerified, order._delivery_id)}
                            className="w-6 h-6 rounded border-2 border-red-500 text-amber-500 focus:ring-amber-500 bg-slate-700 cursor-pointer"
                        />
                        <span className={`font-bold text-sm ${isPaymentVerified ? 'text-amber-400' : 'text-red-300'}`}>
                            {actionLoading[(order._delivery_id || order.id) + '_payment_verified'] ? 'Shranjujem...' : isPaymentVerified ? 'Plačilo preverjeno' : 'Preveri dokazilo o plačilu'}
                        </span>
                    </label>
                )}

                {/* Per-order messages to admin — multiple sends over time */}
                <div className="border-t border-slate-700/30 pt-2.5 space-y-2">
                    {priorMessages.length > 0 && (
                        <div className="space-y-1.5">
                            {priorMessages.map((m, i) => (
                                <div key={i} className="bg-slate-700/30 border border-slate-600/30 rounded-lg px-3 py-2 text-xs">
                                    <div className="flex items-center justify-between text-slate-500 mb-0.5">
                                        <span>{m.by_name}</span>
                                        <span>{new Date(m.at).toLocaleString('sl-SI', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    {m.comment && <p className="text-slate-200 whitespace-pre-wrap break-words">{m.comment}</p>}
                                    {m.file_url && (
                                        <a
                                            href={`${m.file_url}${m.file_url.includes('?') ? '&' : '?'}warehouse_email=${encodeURIComponent(email)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-blue-400 hover:underline text-[11px] mt-1"
                                        >
                                            📎 {m.file_name || 'priloga'}
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {!showMsgForm ? (
                        <button
                            type="button"
                            onClick={() => setShowMsgForm(true)}
                            className="w-full flex items-center justify-center gap-2 py-2 bg-slate-700/40 hover:bg-slate-700/70 border border-slate-600/40 rounded-lg text-sm text-slate-300 transition"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            {priorMessages.length > 0 ? 'Pošlji novo sporočilo' : 'Pošlji sporočilo adminu'}
                        </button>
                    ) : (
                        <div className="bg-slate-700/30 border border-slate-600/40 rounded-lg p-2.5 space-y-2">
                            <textarea
                                value={msgText}
                                onChange={e => setMsgText(e.target.value)}
                                placeholder="Sporočilo o tem naročilu..."
                                rows={2}
                                autoFocus
                                className="w-full bg-slate-800/60 border border-slate-600/50 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500/50 resize-none"
                            />
                            <div className="flex items-center gap-2">
                                <label className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer transition">
                                    <input
                                        type="file"
                                        className="hidden"
                                        onChange={e => setMsgFile(e.target.files?.[0] || null)}
                                    />
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                    </svg>
                                    {msgFile ? (
                                        <span className="text-orange-400 truncate max-w-[140px]">{msgFile.name}</span>
                                    ) : (
                                        'Priloži'
                                    )}
                                </label>
                                <div className="flex-1" />
                                <button
                                    type="button"
                                    onClick={() => { setShowMsgForm(false); setMsgText(''); setMsgFile(null); setMsgStatus(null) }}
                                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
                                >
                                    Prekliči
                                </button>
                                <button
                                    type="button"
                                    onClick={sendOrderMessage}
                                    disabled={msgSending || (!msgText.trim() && !msgFile)}
                                    className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
                                >
                                    {msgSending ? 'Pošiljam...' : 'Pošlji'}
                                </button>
                            </div>
                            {msgStatus && (
                                <p className={`text-xs font-medium ${msgStatus.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                                    {msgStatus}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Zaključi naročilo button */}
                <button
                    disabled={!canFinalize || actionLoading[(order._delivery_id || order.id) + '_complete']}
                    onClick={() => {
                        const label = type === 'pickup' ? 'prevzeto s strani stranke' : 'prevzeto s strani DPD'
                        if (confirm(`Zaključi naročilo #${order.order_number} kot ${label}?\n\nTo dejanje ni mogoče razveljaviti.`)) {
                            onComplete(order.id, type, undefined, order._delivery_id)
                        }
                    }}
                    className={`w-full py-3 rounded-lg font-bold text-sm transition ${
                        canFinalize
                            ? 'bg-orange-500 hover:bg-orange-600 text-white cursor-pointer'
                            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                >
                    {actionLoading[(order._delivery_id || order.id) + '_complete']
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
