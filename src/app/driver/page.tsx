'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Delivery {
    id: string
    token: string
    order_id: string
    driver_email: string
    expires_at: string
    signed_at: string | null
    recipient_name: string | null
    created_at: string
    orders: {
        order_number: string
        customer_email: string
        company_name: string | null
        shipping_address: any
        total: number
        currency: string
        status: string
    }
}

export default function DriverPortal() {
    const [authenticated, setAuthenticated] = useState(false)
    const [password, setPassword] = useState('')
    const [driverEmail, setDriverEmail] = useState('')
    const [deliveries, setDeliveries] = useState<Delivery[]>([])
    const [loading, setLoading] = useState(false)
    const [activeDelivery, setActiveDelivery] = useState<Delivery | null>(null)
    const [signing, setSigning] = useState(false)
    const [recipientName, setRecipientName] = useState('')
    const [signatureDone, setSignatureDone] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const isDrawing = useRef(false)
    const lastPoint = useRef<{ x: number; y: number } | null>(null)

    const handleLogin = () => {
        if (password === '123456') {
            setAuthenticated(true)
            const saved = localStorage.getItem('driver_email')
            if (saved) {
                setDriverEmail(saved)
            }
        } else {
            alert('Wrong password')
        }
    }

    const fetchDeliveries = async () => {
        if (!driverEmail) return
        setLoading(true)
        localStorage.setItem('driver_email', driverEmail)
        try {
            const res = await fetch(`/api/driver/deliveries?email=${encodeURIComponent(driverEmail)}`)
            const data = await res.json()
            setDeliveries(data.deliveries || [])
        } catch {
            alert('Failed to load deliveries')
        } finally {
            setLoading(false)
        }
    }

    const openDelivery = (d: Delivery) => {
        setActiveDelivery(d)
        setSigning(false)
        setSignatureDone(false)
        setRecipientName('')
    }

    const startSigning = () => {
        setSigning(true)
        setTimeout(() => {
            initCanvas()
            // Auto scroll to signature area
            const el = document.getElementById('signature-area')
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
    }

    const initCanvas = useCallback(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Set canvas size to match display size
        const rect = canvas.getBoundingClientRect()
        canvas.width = rect.width * 2
        canvas.height = rect.height * 2
        ctx.scale(2, 2)
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.strokeStyle = '#1a2b3c'

        // Light guide line
        ctx.setLineDash([5, 5])
        ctx.strokeStyle = '#e5e7eb'
        ctx.beginPath()
        ctx.moveTo(20, rect.height - 30)
        ctx.lineTo(rect.width - 20, rect.height - 30)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.strokeStyle = '#1a2b3c'
    }, [])

    const getPoint = (e: React.TouchEvent | React.MouseEvent) => {
        const canvas = canvasRef.current
        if (!canvas) return null
        const rect = canvas.getBoundingClientRect()
        if ('touches' in e) {
            const touch = e.touches[0]
            return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
        }
        return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
    }

    const onPointerDown = (e: React.TouchEvent | React.MouseEvent) => {
        e.preventDefault()
        isDrawing.current = true
        lastPoint.current = getPoint(e)
        setSignatureDone(true)
    }

    const onPointerMove = (e: React.TouchEvent | React.MouseEvent) => {
        e.preventDefault()
        if (!isDrawing.current) return
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!ctx || !canvas) return

        const point = getPoint(e)
        if (!point || !lastPoint.current) return

        ctx.beginPath()
        ctx.moveTo(lastPoint.current.x, lastPoint.current.y)
        ctx.lineTo(point.x, point.y)
        ctx.stroke()
        lastPoint.current = point
    }

    const onPointerUp = () => {
        isDrawing.current = false
        lastPoint.current = null
    }

    const clearSignature = () => {
        setSignatureDone(false)
        initCanvas()
    }

    const submitSignature = async () => {
        if (!activeDelivery || !canvasRef.current) return
        setSubmitting(true)
        try {
            const signatureData = canvasRef.current.toDataURL('image/png')
            const res = await fetch('/api/driver/sign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: activeDelivery.token,
                    signatureData,
                    recipientName: recipientName || null,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed')

            alert('Delivery confirmed! Signature recorded.')
            setActiveDelivery(null)
            setSigning(false)
            fetchDeliveries()
        } catch (err: any) {
            alert('Error: ' + err.message)
        } finally {
            setSubmitting(false)
        }
    }

    // Password gate
    if (!authenticated) {
        return (
            <>
                <meta name="robots" content="noindex, nofollow" />
                <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                            </div>
                            <h1 className="text-xl font-bold text-slate-800">Driver Portal</h1>
                            <p className="text-sm text-slate-500 mt-1">Tigo Energy SHOP</p>
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); handleLogin() }} className="space-y-4">
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Enter password"
                                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-center text-lg tracking-widest focus:ring-2 focus:ring-green-500 outline-none"
                                autoFocus
                            />
                            <button type="submit" className="w-full py-3 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 transition">
                                Enter
                            </button>
                        </form>
                    </div>
                </div>
            </>
        )
    }

    // Delivery detail view with signature
    if (activeDelivery) {
        const order = activeDelivery.orders
        const addr = order.shipping_address || {}
        const isSigned = !!activeDelivery.signed_at

        return (
            <>
                <meta name="robots" content="noindex, nofollow" />
                <div className="min-h-screen bg-slate-50">
                    {/* Header */}
                    <div className="bg-slate-800 text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
                        <button onClick={() => setActiveDelivery(null)} className="p-1">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <div>
                            <p className="font-bold text-sm">#{order.order_number}</p>
                            <p className="text-xs text-slate-400">Delivery Note</p>
                        </div>
                    </div>

                    <div className="p-4 space-y-4 max-w-lg mx-auto">
                        {/* Delivery Info Card */}
                        <div className="bg-white rounded-xl border p-4 shadow-sm">
                            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Deliver To</h2>
                            <p className="font-bold text-lg text-slate-800">
                                {addr.first_name} {addr.last_name}
                            </p>
                            {order.company_name && <p className="text-sm text-slate-600">{order.company_name}</p>}
                            <p className="text-sm text-slate-600 mt-1">{addr.street}</p>
                            <p className="text-sm text-slate-600">{addr.postal_code} {addr.city}</p>
                            <p className="text-sm text-slate-500 uppercase">{addr.country}</p>
                            {addr.phone && (
                                <a href={`tel:${addr.phone}`} className="inline-flex items-center gap-2 mt-3 text-sm text-green-700 font-semibold bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                    Call {addr.phone}
                                </a>
                            )}
                        </div>

                        {/* View Dobavnica PDF */}
                        <a
                            href={`/api/orders/${activeDelivery.order_id}/delivery-note`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full py-3 bg-slate-700 text-white rounded-xl font-bold text-center hover:bg-slate-800 transition"
                        >
                            View Delivery Note (PDF)
                        </a>

                        {/* Signature Section */}
                        {isSigned ? (
                            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                                <svg className="w-12 h-12 text-green-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <p className="font-bold text-green-800">Signed & Confirmed</p>
                                <p className="text-xs text-green-600 mt-1">
                                    {activeDelivery.recipient_name && `by ${activeDelivery.recipient_name} — `}
                                    {new Date(activeDelivery.signed_at!).toLocaleString()}
                                </p>
                            </div>
                        ) : !signing ? (
                            <button
                                onClick={startSigning}
                                className="w-full py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 transition shadow-lg shadow-green-200"
                            >
                                Collect Signature
                            </button>
                        ) : (
                            <div id="signature-area" className="space-y-3">
                                <div className="bg-white rounded-xl border-2 border-green-300 p-3 shadow-sm">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Recipient Name (optional)</p>
                                    <input
                                        type="text"
                                        value={recipientName}
                                        onChange={e => setRecipientName(e.target.value)}
                                        placeholder="Name of person receiving"
                                        className="w-full border rounded-lg px-3 py-2 text-sm"
                                    />
                                </div>

                                <div className="bg-white rounded-xl border-2 border-green-300 p-3 shadow-sm">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Signature</p>
                                    <canvas
                                        ref={canvasRef}
                                        className="w-full bg-white border border-slate-200 rounded-lg touch-none"
                                        style={{ height: '200px' }}
                                        onMouseDown={onPointerDown}
                                        onMouseMove={onPointerMove}
                                        onMouseUp={onPointerUp}
                                        onMouseLeave={onPointerUp}
                                        onTouchStart={onPointerDown}
                                        onTouchMove={onPointerMove}
                                        onTouchEnd={onPointerUp}
                                    />
                                    <div className="flex gap-2 mt-2">
                                        <button onClick={clearSignature} className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
                                            Clear
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={submitSignature}
                                    disabled={!signatureDone || submitting}
                                    className="w-full py-4 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-200"
                                >
                                    {submitting ? 'Submitting...' : 'Confirm Delivery'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </>
        )
    }

    // Main deliveries list
    return (
        <>
            <meta name="robots" content="noindex, nofollow" />
            <div className="min-h-screen bg-slate-50">
                {/* Header */}
                <div className="bg-slate-800 text-white px-4 py-4">
                    <div className="max-w-lg mx-auto">
                        <h1 className="font-bold text-lg">Driver Portal</h1>
                        <p className="text-xs text-slate-400">Tigo Energy SHOP</p>
                    </div>
                </div>

                <div className="p-4 max-w-lg mx-auto space-y-4">
                    {/* Email input */}
                    <div className="bg-white rounded-xl border p-4 shadow-sm">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Your email</label>
                        <div className="flex gap-2 mt-2">
                            <input
                                type="email"
                                value={driverEmail}
                                onChange={e => setDriverEmail(e.target.value)}
                                placeholder="driver@example.com"
                                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                            />
                            <button
                                onClick={fetchDeliveries}
                                disabled={loading || !driverEmail}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700 transition disabled:opacity-50"
                            >
                                {loading ? '...' : 'Load'}
                            </button>
                        </div>
                    </div>

                    {/* Deliveries List */}
                    {deliveries.length > 0 ? (
                        <div className="space-y-3">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                {deliveries.filter(d => !d.signed_at).length} pending &middot; {deliveries.filter(d => d.signed_at).length} completed
                            </p>
                            {deliveries.map(d => {
                                const addr = d.orders?.shipping_address || {}
                                const isSigned = !!d.signed_at
                                return (
                                    <button
                                        key={d.id}
                                        onClick={() => openDelivery(d)}
                                        className={`w-full text-left bg-white rounded-xl border p-4 shadow-sm transition hover:shadow-md ${isSigned ? 'opacity-60 border-green-200' : 'border-amber-200'}`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <p className="font-bold text-slate-800">#{d.orders?.order_number}</p>
                                                <p className="text-sm text-slate-600 mt-1">
                                                    {addr.first_name} {addr.last_name}
                                                    {d.orders?.company_name && <span className="text-slate-400"> ({d.orders.company_name})</span>}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    {addr.street}, {addr.postal_code} {addr.city}
                                                </p>
                                            </div>
                                            <div className="flex-shrink-0 ml-3">
                                                {isSigned ? (
                                                    <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded-lg text-xs font-bold">
                                                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                        Signed
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-1 rounded-lg text-xs font-bold animate-pulse">
                                                        Pending
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    ) : driverEmail && !loading ? (
                        <div className="text-center py-12 text-slate-400">
                            <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                            <p className="font-medium">No deliveries found</p>
                            <p className="text-xs mt-1">Check your email or contact admin</p>
                        </div>
                    ) : null}
                </div>
            </div>
        </>
    )
}
