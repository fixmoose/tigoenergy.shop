'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { issueOrderInvoiceAction, adminMarkDeliveredAction, adminRecordPaymentAction, getOrderPaymentsAction, adminDeletePaymentAction, adminSendDeliveryToDriverAction, adminSendToWarehouseAction, adminSendInvoiceEmailAction, adminDeleteOrderAction, reserveStockForOrderAction, adjustStockForOrderAction } from '@/app/actions/admin'
import { adminSendOrderForPaymentAction, adminSendOrderToClientAction, sendPaymentReminderAction } from '@/app/actions/order-notifications'
import { adminUnlockOrder } from '@/app/actions/order-modify'
import type { OrderPayment } from '@/types/database'

interface AdminOrderActionsProps {
    orderId: string
    status: string | null
    paymentStatus?: string | null
    createdAt: string | null
    confirmedAt: string | null
    packingSlipUrl?: string | null
    shippingLabelUrl?: string | null
    invoiceUrl?: string | null
    trackingNumber?: string | null
    trackingUrl?: string | null
    shippingCarrier?: string | null
    customerEmail?: string | null
    sendCount?: number
    orderTotal?: number
    amountPaid?: number
    modificationUnlocked?: boolean
    paymentTerms?: string | null
    paymentDueDate?: string | null
    overdueReminderSentAt?: string | null
    autoReminderEnabled?: boolean
    warehouseActions?: { action: string; by_email?: string; by_name?: string; at: string; file_url?: string }[]
    warehouseSendLog?: { email: string; name: string; sentAt: string }[]
}

type FlowStep = 'received' | 'confirm' | 'payment' | 'packing' | 'shipping' | 'delivered' | 'invoice' | 'done'

function StepCard({ step, currentStep, children, title, subtitle, icon, color }: {
    step: FlowStep
    currentStep: FlowStep
    children: React.ReactNode
    title: string
    subtitle: string
    icon: string
    color: string
}) {
    const stepOrder: FlowStep[] = ['received', 'confirm', 'payment', 'packing', 'shipping', 'delivered', 'invoice', 'done']
    const stepIdx = stepOrder.indexOf(step)
    const currentIdx = stepOrder.indexOf(currentStep)
    const isCompleted = stepIdx < currentIdx
    const isActive = stepIdx === currentIdx
    const isFuture = stepIdx > currentIdx

    const colorMap: Record<string, { border: string, text: string, bg: string }> = {
        slate: { border: 'border-slate-200', text: 'text-slate-700', bg: 'bg-slate-50' },
        green: { border: 'border-amber-300', text: 'text-amber-800', bg: 'bg-amber-50' },
        amber: { border: 'border-amber-300', text: 'text-amber-800', bg: 'bg-amber-50' },
        blue: { border: 'border-blue-300', text: 'text-blue-800', bg: 'bg-blue-50' },
        red: { border: 'border-red-300', text: 'text-red-800', bg: 'bg-red-50' },
        indigo: { border: 'border-indigo-300', text: 'text-indigo-800', bg: 'bg-indigo-50' },
        purple: { border: 'border-purple-300', text: 'text-purple-800', bg: 'bg-purple-50' },
    }
    const c = colorMap[color] || colorMap.slate

    if (isCompleted) {
        return (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 opacity-70 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">&#10003;</span>
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider truncate">{title}</span>
                </div>
                <p className="text-[9px] text-amber-600 mt-1 ml-7 truncate">{subtitle}</p>
            </div>
        )
    }

    if (isFuture) {
        return (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/30 p-3 opacity-40 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0">{icon}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{title}</span>
                </div>
            </div>
        )
    }

    return (
        <div className={`rounded-xl border-2 ${c.border} ${c.bg} p-4 shadow-sm min-w-0 col-span-2`}>
            <div className="flex items-center gap-2 mb-2">
                <span className={`w-6 h-6 rounded-full ${c.bg} ${c.text} flex items-center justify-center text-xs font-bold animate-pulse border-2 ${c.border} flex-shrink-0`}>{icon}</span>
                <span className={`text-xs font-bold ${c.text} uppercase tracking-wider`}>{title}</span>
            </div>
            <p className={`text-[10px] ${c.text} opacity-70 ml-8 mb-3`}>{subtitle}</p>
            <div className="ml-8">{children}</div>
        </div>
    )
}

export default function AdminOrderActions({ orderId, status, paymentStatus, createdAt, confirmedAt, packingSlipUrl, shippingLabelUrl, invoiceUrl, trackingNumber, trackingUrl, shippingCarrier, customerEmail, sendCount = 0, orderTotal = 0, amountPaid = 0, modificationUnlocked = false, paymentTerms, paymentDueDate, overdueReminderSentAt, autoReminderEnabled = true, warehouseActions = [], warehouseSendLog = [] }: AdminOrderActionsProps) {
    const [loading, setLoading] = useState(false)
    const [uploadingDoc, setUploadingDoc] = useState<'invoice' | 'packing_slip' | 'delivery_note' | null>(null)
    const [currentTime, setCurrentTime] = useState(new Date())
    const [showPaymentForm, setShowPaymentForm] = useState(false)
    const [payAmount, setPayAmount] = useState('')
    const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
    const [payMethod, setPayMethod] = useState('bank_transfer')
    const [payReference, setPayReference] = useState('')
    const [payNotes, setPayNotes] = useState('')
    const [payments, setPayments] = useState<OrderPayment[]>([])
    const [paymentsLoaded, setPaymentsLoaded] = useState(false)
    const [driverEmail, setDriverEmail] = useState('')
    const [savedDrivers, setSavedDrivers] = useState<{ id: string; name: string; email: string; phone: string; is_warehouse?: boolean }[]>([])
    const [warehouseMembers, setWarehouseMembers] = useState<{ id: string; name: string; email: string }[]>([])
    const [warehouseEmail, setWarehouseEmail] = useState('')
    const [showWarehouseSend, setShowWarehouseSend] = useState(false)
    const [dpdStatus, setDpdStatus] = useState<any[] | null>(null)
    const [dpdStatusLoading, setDpdStatusLoading] = useState(false)
    const [dpdStatusError, setDpdStatusError] = useState<string | null>(null)
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        supabase.from('drivers').select('id, name, email, phone, is_warehouse').order('name').then(({ data }) => {
            if (data) {
                setSavedDrivers(data)
                setWarehouseMembers(data.filter(d => d.is_warehouse))
            }
        })
    }, [])

    const creationDate = createdAt ? new Date(createdAt) : null
    const diffMs = creationDate ? currentTime.getTime() - creationDate.getTime() : 0
    const diffHours = diffMs / (1000 * 60 * 60)
    const remainingMs = Math.max(0, (2 * 60 * 60 * 1000) - diffMs)

    const formatTime = (ms: number) => {
        const hours = Math.floor(ms / 3600000)
        const minutes = Math.floor((ms % 3600000) / 60000)
        const seconds = Math.floor((ms % 60000) / 1000)
        return `${hours}h ${minutes}m ${seconds}s`
    }

    const isWithin2h = diffHours < 2
    const isPending = status === 'pending'
    const isConfirmed = !!confirmedAt || status !== 'pending'
    const isPaid = paymentStatus === 'paid' || paymentStatus === 'net30'
    const isShipped = status === 'shipped'
    const isDelivered = status === 'delivered' || status === 'completed'
    const isPickup = shippingCarrier === 'Personal Pick-up'

    // Check warehouse actions for auto-advancement
    const warehousePrepared = warehouseActions.some(a => a.action === 'marked_prepared')
    const warehousePickedUp = warehouseActions.some(a => a.action === 'marked_picked_up')
    const warehouseDpdPickedUp = warehouseActions.some(a => a.action === 'marked_dpd_picked_up')

    const getCurrentStep = (): FlowStep => {
        if (isPending && !confirmedAt) return 'confirm'
        if (!isPaid) return 'payment'
        // Packing: skip if warehouse already prepared OR packing slip exists
        if (!packingSlipUrl && !warehousePrepared) return 'packing'
        // Shipping/delivery: check actual DB status (warehouse updates these)
        if (isPickup && !isDelivered) return 'delivered'
        if (!isShipped && !isDelivered) return 'shipping'
        if (isShipped && !isDelivered) return 'delivered'
        if (!invoiceUrl) return 'invoice'
        return 'done'
    }

    const currentStep = getCurrentStep()

    const handleConfirm = async () => {
        if (isWithin2h && !confirm('The 2-hour cancellation window has not expired yet. Confirm now?')) return
        setLoading(true)
        try {
            const { error } = await supabase
                .from('orders')
                .update({ status: 'processing', confirmed_at: new Date().toISOString() })
                .eq('id', orderId)
            if (error) throw error
            // Reserve stock for this order
            await reserveStockForOrderAction(orderId)
            router.refresh()
        } catch (err) {
            console.error('Error confirming order:', err)
            alert('Failed to confirm order.')
        } finally {
            setLoading(false)
        }
    }

    const handleShipOrder = async (carrier: 'GLS' | 'DPD') => {
        setLoading(true)
        try {
            const mockTrackingNumber = carrier === 'GLS' ? `GLS${Math.floor(Math.random() * 1000000000)}` : ''
            const mockTrackingUrl = carrier === 'GLS' ? `https://gls-group.eu/EU/en/track-trace?match=${mockTrackingNumber}` : ''
            const res = await fetch(`/api/admin/orders/${orderId}/ship`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ carrier, trackingNumber: mockTrackingNumber, trackingUrl: mockTrackingUrl })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to process shipping')
            // Deduct stock — goods leaving warehouse
            await adjustStockForOrderAction(orderId)
            alert(`${carrier} shipment processed. Email sent to customer.`)
            router.refresh()
        } catch (err: any) {
            console.error('Error shipping:', err)
            alert(err.message || 'Failed to process shipping.')
        } finally {
            setLoading(false)
        }
    }

    const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>, type: 'invoice' | 'packing_slip' | 'delivery_note') => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploadingDoc(type)
        try {
            const fileName = `${type}_${orderId}_${Date.now()}.${file.name.split('.').pop()}`
            const filePath = `orders/${orderId}/${fileName}`
            const { error: uploadError } = await supabase.storage.from('invoices').upload(filePath, file)
            if (uploadError) throw uploadError
            // Use API route URL instead of public URL (bucket may not be public)
            const publicUrl = `/api/storage?bucket=invoices&path=${encodeURIComponent(filePath)}`
            const updates: any = {}
            if (type === 'invoice') { updates.invoice_url = publicUrl; updates.invoice_created_at = new Date().toISOString() }
            else if (type === 'packing_slip') { updates.packing_slip_url = publicUrl }
            else if (type === 'delivery_note') { updates.shipping_label_url = publicUrl }
            const { error: updateError } = await supabase.from('orders').update(updates).eq('id', orderId)
            if (updateError) throw updateError
            alert(`${type.replace('_', ' ')} uploaded.`)
            router.refresh()
        } catch (err: any) {
            console.error('Upload error:', err)
            alert('Failed: ' + err.message)
        } finally {
            setUploadingDoc(null)
        }
    }

    const handleIssueInvoice = async () => {
        setLoading(true)
        try {
            const res = await issueOrderInvoiceAction(orderId)
            if (res.success) {
                alert(`Invoice ${res.invoiceNumber} generated!`)
                router.refresh()
            } else {
                alert(res.error || 'Failed to issue invoice')
            }
        } catch {
            alert('Failed to issue invoice')
        } finally {
            setLoading(false)
        }
    }

    const handleMarkDelivered = async () => {
        if (!confirm('Mark as delivered and notify customer?')) return
        setLoading(true)
        try {
            const res = await adminMarkDeliveredAction(orderId)
            if (res.success) { router.refresh() } else { alert(res.error || 'Failed') }
        } catch { alert('Failed to mark as delivered') } finally { setLoading(false) }
    }

    const handleCheckDpdStatus = async () => {
        setDpdStatusLoading(true)
        setDpdStatusError(null)
        try {
            const res = await fetch(`/api/admin/orders/${orderId}/dpd-status`)
            const data = await res.json()
            if (!res.ok) {
                setDpdStatusError(data.error || 'Failed to fetch status')
            } else if (!data.parcels || data.parcels.length === 0) {
                setDpdStatusError('No tracking data returned from DPD')
            } else {
                setDpdStatus(data.parcels)
                console.log('DPD parcels:', data.parcels)
            }
        } catch {
            setDpdStatusError('Network error')
        } finally {
            setDpdStatusLoading(false)
        }
    }

    if (status === 'cancelled') return null

    return (
        <div className="bg-white rounded-xl shadow-sm border p-5">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="text-blue-500">&#9889;</span> Order Flow
            </h3>

            {/* Net Payment Counter — always visible for net orders */}
            {paymentTerms === 'net30' && (() => {
                const dueDate = paymentDueDate ? new Date(paymentDueDate) : null
                const now = new Date()
                const diffDays = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)) : null
                const isOverdue = diffDays !== null && diffDays < 0
                const isPaidFull = paymentStatus === 'paid'
                const isPreDelivery = !dueDate && !isPaidFull
                return (
                    <div className={`rounded-xl px-4 py-3 mb-4 text-sm flex items-center justify-between ${
                        isPaidFull ? 'bg-amber-50 border-2 border-amber-300 text-amber-800'
                        : isPreDelivery ? 'bg-blue-50 border-2 border-blue-300 text-blue-800'
                        : isOverdue ? 'bg-red-50 border-2 border-red-300 text-red-800'
                        : diffDays !== null && diffDays <= 7 ? 'bg-amber-50 border-2 border-amber-300 text-amber-800'
                        : 'bg-blue-50 border-2 border-blue-300 text-blue-800'
                    }`}>
                        <div className="flex items-center gap-3">
                            <span className="text-lg">{isPaidFull ? '✅' : isPreDelivery ? '📦' : isOverdue ? '🚨' : '⏳'}</span>
                            <div>
                                <span className="font-bold">
                                    {isPaidFull ? (
                                        <>Net payment — Paid{dueDate && <> (was due {dueDate.toLocaleDateString('en-GB')})</>}</>
                                    ) : isPreDelivery ? (
                                        <>Net payment — countdown starts on delivery</>
                                    ) : isOverdue ? (
                                        <>{Math.abs(diffDays!)} day{Math.abs(diffDays!) !== 1 ? 's' : ''} OVERDUE — was due {dueDate!.toLocaleDateString('en-GB')}</>
                                    ) : (
                                        <>{diffDays} day{diffDays !== 1 ? 's' : ''} left — due {dueDate!.toLocaleDateString('en-GB')}</>
                                    )}
                                </span>
                                <span className="ml-3 text-xs opacity-70">€{(amountPaid || 0).toFixed(2)} (paid so far) / €{(orderTotal || 0).toFixed(2)} (owe)</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                            {!isPaidFull && (
                                <button
                                    onClick={() => {
                                        setPayAmount(((orderTotal || 0) - (amountPaid || 0)).toFixed(2))
                                        setPayDate(new Date().toISOString().split('T')[0])
                                        setShowPaymentForm(true)
                                        if (!paymentsLoaded) {
                                            getOrderPaymentsAction(orderId).then(res => {
                                                if (res.success) setPayments(res.data as OrderPayment[])
                                                setPaymentsLoaded(true)
                                            })
                                        }
                                    }}
                                    className="py-1.5 px-4 rounded-lg text-xs font-bold transition bg-amber-600 text-white hover:bg-amber-700"
                                >Record Payment</button>
                            )}
                            {!isPaidFull && (
                                <button
                                    onClick={async () => {
                                        if (!confirm(`Send payment reminder to ${customerEmail}?`)) return
                                        setLoading(true)
                                        try {
                                            const res = await sendPaymentReminderAction(orderId) as any
                                            if (res.success) { alert('Reminder sent!'); router.refresh() }
                                            else { alert('Failed: ' + (res.error || 'Unknown error')) }
                                        } catch (err: any) { alert('Failed: ' + err.message) }
                                        finally { setLoading(false) }
                                    }}
                                    disabled={loading}
                                    className={`py-1.5 px-4 rounded-lg text-xs font-bold transition disabled:opacity-50 ${
                                        isOverdue
                                            ? 'bg-red-600 text-white hover:bg-red-700'
                                            : 'bg-amber-600 text-white hover:bg-amber-700'
                                    }`}
                                >
                                    {loading ? 'Sending...' : 'Send Reminder'}
                                </button>
                            )}
                            {!isPaidFull && (
                                <button
                                    onClick={async () => {
                                        setLoading(true)
                                        try {
                                            const supabaseClient = createClient()
                                            const newVal = !autoReminderEnabled
                                            const { error } = await supabaseClient
                                                .from('orders')
                                                .update({ auto_reminder_enabled: newVal })
                                                .eq('id', orderId)
                                            if (error) throw error
                                            router.refresh()
                                        } catch (err: any) { alert('Failed: ' + err.message) }
                                        finally { setLoading(false) }
                                    }}
                                    disabled={loading}
                                    className={`py-1.5 px-3 rounded-lg text-[10px] font-bold transition border ${
                                        autoReminderEnabled
                                            ? 'bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200'
                                            : 'bg-slate-100 border-slate-300 text-slate-500 hover:bg-slate-200'
                                    }`}
                                    title={autoReminderEnabled ? 'Auto-reminder ON — will email 1 day before due' : 'Auto-reminder OFF'}
                                >
                                    {autoReminderEnabled ? '🔔 Auto' : '🔕 Auto'}
                                </button>
                            )}
                            {overdueReminderSentAt && (
                                <span className="text-[10px] opacity-70">
                                    Reminded: {new Date(overdueReminderSentAt).toLocaleDateString('en-GB')}
                                </span>
                            )}
                        </div>
                    </div>
                )
            })()}

            <div className="grid grid-cols-8 gap-2 items-start">
                {/* Step 1: Order Received */}
                <StepCard step="received" currentStep={currentStep} title="Order Received" subtitle={createdAt ? new Date(createdAt).toLocaleDateString('en-GB') : ''} icon="1" color="slate">
                    <span />
                </StepCard>

                {/* Step 2: Confirm Order */}
                <StepCard step="confirm" currentStep={currentStep} title="Confirm Order" subtitle="Check stock, pricing & accuracy" icon="2" color="green">
                    <div className="space-y-2">
                        {isWithin2h && isPending && (
                            <div className="bg-amber-100 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                                <span className="animate-pulse">&#9203;</span> Customer can cancel for <strong>{formatTime(remainingMs)}</strong>
                            </div>
                        )}
                        <button onClick={handleConfirm} disabled={loading} className="w-full py-2 bg-amber-600 text-white rounded-lg font-bold text-sm hover:bg-amber-700 transition disabled:opacity-50">
                            {loading ? 'Processing...' : 'Confirm Order'}
                        </button>
                        {modificationUnlocked ? (
                            <div className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100">Unlocked for customer modification</div>
                        ) : !isConfirmed && (
                            <button
                                onClick={async () => {
                                    if (!confirm('Allow customer to modify this order?')) return
                                    setLoading(true)
                                    try {
                                        const res = await adminUnlockOrder(orderId)
                                        if (res.success) { alert('Unlocked.'); router.refresh() } else { alert('Failed: ' + res.error) }
                                    } catch (err: any) { alert('Failed: ' + err.message) } finally { setLoading(false) }
                                }}
                                disabled={loading}
                                className="w-full py-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg font-semibold hover:bg-amber-100 transition disabled:opacity-50"
                            >Unlock for Modification</button>
                        )}
                    </div>
                </StepCard>

                {/* Step 3: Payment */}
                <StepCard step="payment" currentStep={currentStep} title="Payment" subtitle="Send payment request & confirm receipt" icon="3" color="amber">
                    <div className="space-y-2">
                        <div className={`rounded-lg px-3 py-2 text-xs font-medium flex justify-between items-center ${
                            paymentStatus === 'paid' ? 'bg-amber-100 border border-amber-200 text-amber-800' :
                            paymentStatus === 'net30' ? 'bg-blue-100 border border-blue-200 text-blue-800' :
                            paymentStatus === 'partially_paid' ? 'bg-amber-100 border border-amber-200 text-amber-800' :
                            'bg-red-100 border border-red-200 text-red-700'
                        }`}>
                            <span>{paymentStatus === 'paid' ? '&#10003; Paid' : paymentStatus === 'net30' ? '&#9711; Net 30' : paymentStatus === 'partially_paid' ? '&#9680; Partial' : '&#9675; Unpaid'}</span>
                            <span className="font-bold">&euro;{(amountPaid || 0).toFixed(2)} / &euro;{(orderTotal || 0).toFixed(2)}</span>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={async () => {
                                    if (!confirm(`Send order to ${customerEmail}?`)) return
                                    setLoading(true)
                                    try {
                                        const res = await adminSendOrderToClientAction(orderId)
                                        if (res.success) { alert('Sent.'); router.refresh() } else { alert('Failed: ' + res.error) }
                                    } catch (err: any) { alert('Failed: ' + err.message) } finally { setLoading(false) }
                                }}
                                disabled={loading}
                                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition disabled:opacity-50"
                            >
                                Send to Client{sendCount > 0 && <span className="ml-1 bg-indigo-800 text-indigo-200 text-[9px] px-1.5 py-0.5 rounded-full">&times;{sendCount}</span>}
                            </button>
                            {paymentStatus !== 'paid' && paymentStatus !== 'net30' && (
                                <button
                                    onClick={async () => {
                                        if (!confirm('Send payment request email?')) return
                                        setLoading(true)
                                        try { await adminSendOrderForPaymentAction(orderId); alert('Sent.') }
                                        catch (err: any) { alert('Failed: ' + err.message) } finally { setLoading(false) }
                                    }}
                                    disabled={loading}
                                    className="flex-1 py-2 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 transition disabled:opacity-50"
                                >Payment Request</button>
                            )}
                        </div>

                        {paymentStatus !== 'paid' && paymentStatus !== 'net30' && !showPaymentForm && (
                            <button
                                onClick={() => {
                                    setPayAmount(((orderTotal || 0) - (amountPaid || 0)).toFixed(2))
                                    setPayDate(new Date().toISOString().split('T')[0])
                                    setShowPaymentForm(true)
                                    if (!paymentsLoaded) {
                                        getOrderPaymentsAction(orderId).then(res => {
                                            if (res.success) setPayments(res.data as OrderPayment[])
                                            setPaymentsLoaded(true)
                                        })
                                    }
                                }}
                                className="w-full py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition"
                            >Record Payment</button>
                        )}

                        {showPaymentForm && (
                            <div className="bg-white border border-amber-200 rounded-lg p-3 space-y-2">
                                {paymentsLoaded && payments.length > 0 && (
                                    <div className="space-y-1 mb-2">
                                        {payments.map(p => (
                                            <div key={p.id} className="flex items-center justify-between bg-slate-50 rounded px-2 py-1.5 text-[10px] border">
                                                <div>
                                                    <span className="font-bold text-amber-700">&euro;{Number(p.amount).toFixed(2)}</span>
                                                    <span className="text-slate-400 mx-1">&middot;</span>
                                                    <span className="text-slate-600">{new Date(p.payment_date).toLocaleDateString('en-GB')}</span>
                                                    <span className="text-slate-400 mx-1">&middot;</span>
                                                    <span className="text-slate-500">{p.payment_method}</span>
                                                    {p.reference && <span className="text-slate-400 ml-1">({p.reference})</span>}
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        if (!confirm('Delete this payment?')) return
                                                        const res = await adminDeletePaymentAction(p.id, orderId)
                                                        if (res.success) { setPayments(prev => prev.filter(x => x.id !== p.id)); router.refresh() }
                                                        else { alert('Failed: ' + res.error) }
                                                    }}
                                                    className="text-red-400 hover:text-red-600 font-bold ml-2"
                                                >&#10005;</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[9px] text-slate-500 font-bold uppercase">Amount</label>
                                        <input type="number" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs" />
                                    </div>
                                    <div>
                                        <label className="text-[9px] text-slate-500 font-bold uppercase">Date</label>
                                        <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs" />
                                    </div>
                                </div>
                                <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs">
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="net30">Net 30 (Invoice)</option>
                                    <option value="wise">Wise</option>
                                    <option value="stripe">Stripe</option>
                                    <option value="cash">Cash</option>
                                    <option value="other">Other</option>
                                </select>
                                <input type="text" value={payReference} onChange={e => setPayReference(e.target.value)} placeholder="Reference (optional)" className="w-full border rounded px-2 py-1.5 text-xs" />
                                <div className="flex gap-2">
                                    <button
                                        onClick={async () => {
                                            const amt = parseFloat(payAmount)
                                            if (!amt || amt <= 0) { alert('Enter valid amount'); return }
                                            setLoading(true)
                                            try {
                                                const res = await adminRecordPaymentAction(orderId, amt, payDate, payMethod, payReference, payNotes)
                                                if (res.success) { setShowPaymentForm(false); setPayReference(''); setPayNotes(''); setPaymentsLoaded(false); router.refresh() }
                                                else { alert('Failed: ' + res.error) }
                                            } finally { setLoading(false) }
                                        }}
                                        disabled={loading}
                                        className="flex-1 py-1.5 bg-amber-600 text-white rounded text-xs font-bold hover:bg-amber-700 disabled:opacity-50"
                                    >{loading ? 'Saving...' : 'Confirm'}</button>
                                    <button onClick={() => setShowPaymentForm(false)} className="px-3 py-1.5 bg-white border rounded text-xs text-slate-600 hover:bg-slate-50">Cancel</button>
                                </div>
                            </div>
                        )}

                        {paymentStatus !== 'paid' && paymentStatus !== 'net30' && (
                            <button
                                onClick={async () => {
                                    if (!confirm('Mark as Net30? Order will be treated as "paid on terms" so the flow can continue. Payment due in 30 days.')) return
                                    setLoading(true)
                                    try {
                                        const { error } = await supabase
                                            .from('orders')
                                            .update({
                                                payment_method: 'IBAN',
                                                payment_terms: 'net30',
                                                payment_status: 'net30',
                                                // payment_due_date set on delivery (not now)
                                            })
                                            .eq('id', orderId)
                                        if (error) throw error
                                        router.refresh()
                                    } catch (err: any) {
                                        alert('Failed: ' + err.message)
                                    } finally {
                                        setLoading(false)
                                    }
                                }}
                                disabled={loading}
                                className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition disabled:opacity-50"
                            >
                                Net 30 — Ship Now, Pay Later
                            </button>
                        )}


                    </div>
                </StepCard>

                {/* Step 4: Packing */}
                <StepCard step="packing" currentStep={currentStep} title="Packing" subtitle="Generate packing slip & prepare items" icon="4" color="blue">
                    <button
                        onClick={async () => {
                            // Open the PDF in a new tab
                            window.open(`/api/orders/${orderId}/packing-slip`, '_blank')
                            // Save packing slip URL to DB so the workflow can advance
                            setLoading(true)
                            try {
                                const packingUrl = `${window.location.origin}/api/orders/${orderId}/packing-slip`
                                const { error: updateErr } = await supabase
                                    .from('orders')
                                    .update({ packing_slip_url: packingUrl })
                                    .eq('id', orderId)
                                if (updateErr) console.error('Failed to save packing slip URL:', updateErr)
                                router.refresh()
                            } catch (err) {
                                console.error('Error saving packing slip URL:', err)
                            } finally {
                                setLoading(false)
                            }
                        }}
                        disabled={loading}
                        className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition disabled:opacity-50">
                        {loading ? 'Processing...' : 'Generate Packing Slip'}
                    </button>
                </StepCard>

                {/* Step 5: Shipping */}
                <StepCard step="shipping" currentStep={currentStep} title={isPickup ? 'Pickup' : 'Shipping'} subtitle={isPickup ? 'Skip shipping or convert to delivery' : 'DPD, own delivery, or manual'} icon="5" color="red">
                    <div className="space-y-2">
                        {isPickup ? (
                            <>
                                <button onClick={async () => {
                                    setLoading(true)
                                    try {
                                        const { error } = await supabase.from('orders').update({
                                            status: 'shipped',
                                            shipping_carrier: 'Personal Pick-up',
                                            shipped_at: new Date().toISOString(),
                                        }).eq('id', orderId)
                                        if (error) throw error
                                        // Deduct stock — goods leaving warehouse
                                        await adjustStockForOrderAction(orderId)
                                        router.refresh()
                                    } catch { alert('Failed') } finally { setLoading(false) }
                                }} disabled={loading}
                                    className="w-full py-2.5 bg-amber-600 text-white rounded-lg font-bold text-sm hover:bg-amber-700 transition disabled:opacity-50">
                                    {loading ? 'Processing...' : 'Skip to Pickup'}
                                </button>
                                <p className="text-[10px] text-slate-400 text-center">Customer picks up — no shipping needed</p>
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                                    <div className="relative flex justify-center"><span className="bg-red-50 px-2 text-[10px] text-slate-400 font-bold uppercase">or convert to delivery</span></div>
                                </div>
                                <button onClick={() => handleShipOrder('DPD')} disabled={loading}
                                    className="w-full py-2 bg-red-600 text-white rounded-lg font-bold text-xs hover:bg-red-700 transition disabled:opacity-50">
                                    {loading ? 'Processing...' : 'Convert to DPD Delivery'}
                                </button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => handleShipOrder('DPD')} disabled={loading}
                                    className="w-full py-2.5 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition disabled:opacity-50">
                                    {loading ? 'Processing...' : 'Process DPD Label'}
                                </button>
                                {shippingLabelUrl && (
                                    <a href={shippingLabelUrl} target="_blank" className="block text-center text-[10px] font-bold text-red-600 hover:underline">View Label PDF</a>
                                )}
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                                    <div className="relative flex justify-center"><span className="bg-red-50 px-2 text-[10px] text-slate-400 font-bold uppercase">or manual</span></div>
                                </div>
                                <button onClick={async () => {
                                    const carrier = prompt('Enter carrier name (e.g. Own Delivery, GLS, Pošta Slovenije):')
                                    if (!carrier) return
                                    const tracking = prompt('Tracking number (optional):') || ''
                                    setLoading(true)
                                    try {
                                        const { error } = await supabase.from('orders').update({
                                            status: 'shipped',
                                            shipping_carrier: carrier,
                                            tracking_number: tracking || null,
                                            shipped_at: new Date().toISOString(),
                                        }).eq('id', orderId)
                                        if (error) throw error
                                        // Deduct stock — goods leaving warehouse
                                        await adjustStockForOrderAction(orderId)
                                        alert(`Marked as shipped via ${carrier}`)
                                        router.refresh()
                                    } catch { alert('Failed') } finally { setLoading(false) }
                                }} disabled={loading}
                                    className="w-full py-2 bg-slate-600 text-white rounded-lg font-bold text-xs hover:bg-slate-700 transition disabled:opacity-50">
                                    {loading ? 'Processing...' : 'Own Delivery / Manual Ship'}
                                </button>
                            </>
                        )}
                    </div>
                </StepCard>

                {/* Step 6: Delivery */}
                <StepCard step="delivered" currentStep={currentStep} title={isPickup ? 'Pickup' : 'Delivery'} subtitle={
                    isPickup ? 'Mark as picked up or convert to delivery'
                    : shippingCarrier === 'DPD' ? 'DPD tracking — auto-delivers & invoices on confirmation'
                    : 'Send dobavnica to driver or confirm manually'
                } icon="6" color="green">
                    <div className="space-y-3">
                        {/* Pickup or internal driver: send dobavnica for signature */}
                        {(isPickup || (!isPickup && shippingCarrier !== 'DPD')) && (
                            <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    {isPickup ? 'Dobavnica za prevzem' : 'Send Dobavnica to Driver'}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                    {isPickup
                                        ? 'Send dobavnica to local worker — customer signs on /driver portal at pickup.'
                                        : 'Driver receives a link to view the delivery note and collect signature digitally.'}
                                </p>
                                {savedDrivers.length > 0 && (
                                    <select
                                        value={savedDrivers.some(d => d.email === driverEmail) ? driverEmail : '__custom'}
                                        onChange={e => setDriverEmail(e.target.value === '__custom' ? '' : e.target.value)}
                                        className="w-full border rounded px-3 py-2 text-sm bg-white"
                                    >
                                        <option value="__custom">Other (type email)</option>
                                        {savedDrivers.map(d => (
                                            <option key={d.id} value={d.email}>{d.name} ({d.email})</option>
                                        ))}
                                    </select>
                                )}
                                {(!savedDrivers.some(d => d.email === driverEmail)) && (
                                    <input
                                        type="email"
                                        value={driverEmail}
                                        onChange={e => setDriverEmail(e.target.value)}
                                        placeholder="driver@email.com"
                                        className="w-full border rounded px-3 py-2 text-sm"
                                    />
                                )}
                                <button
                                    onClick={async () => {
                                        if (!driverEmail) { alert('Enter driver email'); return }
                                        setLoading(true)
                                        try {
                                            const res = await adminSendDeliveryToDriverAction(orderId, driverEmail)
                                            if (res.success) { alert('Dobavnica link sent!') }
                                            else { alert('Failed: ' + res.error) }
                                        } catch (err: any) { alert('Failed: ' + err.message) }
                                        finally { setLoading(false) }
                                    }}
                                    disabled={loading || !driverEmail}
                                    className="w-full py-2 bg-slate-700 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition disabled:opacity-50"
                                >{loading ? 'Sending...' : 'Send Dobavnica Link'}</button>
                            </div>
                        )}

                        {/* Pickup: extra options */}
                        {isPickup && (
                            <>
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                                    <div className="relative flex justify-center"><span className="bg-amber-50 px-2 text-[10px] text-slate-400 font-bold uppercase">or</span></div>
                                </div>
                                <button onClick={handleMarkDelivered} disabled={loading}
                                    className="w-full py-2 bg-amber-600 text-white rounded-lg font-bold text-xs hover:bg-amber-700 transition disabled:opacity-50">
                                    {loading ? 'Processing...' : 'Mark as Picked Up (no signature)'}
                                </button>
                                <button onClick={() => handleShipOrder('DPD')} disabled={loading}
                                    className="w-full py-2 bg-red-600 text-white rounded-lg font-bold text-xs hover:bg-red-700 transition disabled:opacity-50">
                                    {loading ? 'Processing...' : 'Convert to DPD Delivery'}
                                </button>
                            </>
                        )}

                        {/* DPD tracking info */}
                        {!isPickup && shippingCarrier === 'DPD' && trackingNumber && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                                <p className="text-[10px] font-bold text-red-700 uppercase tracking-wider">DPD Tracking</p>
                                <p className="text-sm font-mono text-red-900">{trackingNumber}</p>
                                <div className="flex items-center gap-2">
                                    {trackingNumber && (
                                        <a href={`https://tracking.dpd.de/parcelstatus?query=${trackingNumber.split(',')[0].trim()}&locale=sl_SI`} target="_blank" rel="noopener noreferrer"
                                            className="inline-block text-xs font-bold text-red-600 hover:underline">
                                            Track on DPD &rarr;
                                        </a>
                                    )}
                                    <button onClick={handleCheckDpdStatus} disabled={dpdStatusLoading}
                                        className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-2 py-0.5 rounded transition disabled:opacity-50">
                                        {dpdStatusLoading ? 'Checking...' : 'Check Live Status'}
                                    </button>
                                </div>

                                {dpdStatusError && (
                                    <p className="text-xs text-red-600 font-medium">{dpdStatusError}</p>
                                )}

                                {dpdStatus && dpdStatus.length > 0 && (
                                    <div className="space-y-1.5 mt-1">
                                        {dpdStatus.map((p: any, i: number) => (
                                            <div key={i} className="bg-white border border-red-100 rounded p-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-mono text-slate-500">{p.parcel_number || p.parcelnumber || `Parcel ${i + 1}`}</span>
                                                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                                        (p.status || '').toUpperCase() === 'DELIVERED'
                                                            ? 'bg-amber-100 text-amber-700'
                                                            : ['IN_DELIVERY', 'ON_THE_ROAD', 'INBOUND', 'AT_DELIVERY_DEPOT'].includes((p.status || '').toUpperCase())
                                                                ? 'bg-yellow-100 text-yellow-700'
                                                                : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                        {p.status_description || p.status || 'Awaiting pickup'}
                                                    </span>
                                                </div>
                                                {(p.statusInfo || p.status_description) && p.status && p.status !== p.statusInfo && (
                                                    <p className="text-[10px] text-slate-500 mt-0.5">{p.status}</p>
                                                )}
                                                {(p.delivered_at || p.deliveryDate) && (
                                                    <p className="text-[10px] text-amber-600 mt-0.5">Delivered: {p.delivered_at || p.deliveryDate}</p>
                                                )}
                                                {p.depot && (
                                                    <p className="text-[10px] text-slate-400 mt-0.5">Depot: {p.depot}</p>
                                                )}
                                                {p.raw_response && (
                                                    <pre className="text-[9px] text-slate-400 mt-1 whitespace-pre-wrap break-all">{JSON.stringify(p.raw_response, null, 1)}</pre>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <p className="text-[10px] text-red-500">Delivery status is checked automatically. Invoice will be issued when DPD confirms delivery.</p>
                            </div>
                        )}

                        {!isPickup && (
                            <>
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                                    <div className="relative flex justify-center"><span className="bg-amber-50 px-2 text-[10px] text-slate-400 font-bold uppercase">{shippingCarrier === 'DPD' ? 'or override' : 'or'}</span></div>
                                </div>

                                {/* Manual confirmation — secondary/override path */}
                                <button onClick={handleMarkDelivered} disabled={loading}
                                    className="w-full py-2 bg-amber-600 text-white rounded-lg font-bold text-xs hover:bg-amber-700 transition disabled:opacity-50">
                                    {loading ? 'Processing...' : 'Mark as Delivered (Manual)'}
                                </button>
                            </>
                        )}
                    </div>
                </StepCard>

                {/* Step 7: Invoice & Compliance */}
                <StepCard step="invoice" currentStep={currentStep} title="Invoice & Compliance" subtitle="Issue invoice, trigger OEEE / Intrastat" icon="7" color="purple">
                    <div className="space-y-2">
                        {!invoiceUrl ? (
                            <button onClick={handleIssueInvoice} disabled={loading}
                                className="w-full py-2 bg-purple-600 text-white rounded-lg font-bold text-sm hover:bg-purple-700 transition disabled:opacity-50">
                                {loading ? 'Wait...' : 'Issue Official Invoice'}
                            </button>
                        ) : (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 font-medium">
                                &#10003; Invoice issued
                            </div>
                        )}
                        {invoiceUrl && (
                            <button
                                onClick={async () => {
                                    if (!confirm(`Send invoice to ${customerEmail}?`)) return
                                    setLoading(true)
                                    try {
                                        const res = await adminSendInvoiceEmailAction(orderId)
                                        if (res.success) { alert('Invoice email sent!'); router.refresh() }
                                        else { alert('Failed: ' + res.error) }
                                    } catch (err: any) { alert('Failed: ' + err.message) }
                                    finally { setLoading(false) }
                                }}
                                disabled={loading}
                                className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs hover:bg-indigo-700 transition disabled:opacity-50"
                            >
                                {loading ? 'Sending...' : 'Email Invoice to Customer'}
                            </button>
                        )}
                        <p className="text-[10px] text-slate-500">After invoice: OEEE (SI domestic) or Intrastat (EU) triggered automatically.</p>
                    </div>
                </StepCard>
            </div>

            {/* Documents — always visible: proforma, order confirmation, invoice */}
            <div className="mt-4 border-t pt-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Documents</div>
                <div className="flex flex-wrap gap-2">
                    <a href={`/api/orders/${orderId}/proforma`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-bold hover:bg-amber-100 transition">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Predračun / Proforma
                    </a>
                    {invoiceUrl && (
                        <>
                            {invoiceUrl.startsWith('http') && (
                                <a href={invoiceUrl} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-[10px] font-bold hover:bg-purple-100 transition">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    Invoice (stored)
                                </a>
                            )}
                            <a href={`/api/orders/${orderId}/invoice`} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-[10px] font-bold hover:bg-purple-100 transition">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Račun / Invoice PDF
                            </a>
                        </>
                    )}
                    {invoiceUrl && (
                        <button
                            onClick={async () => {
                                if (!confirm(`Send invoice email to ${customerEmail}?`)) return
                                setLoading(true)
                                try {
                                    const res = await adminSendInvoiceEmailAction(orderId)
                                    if (res.success) { alert('Invoice email sent!'); router.refresh() }
                                    else { alert('Failed: ' + res.error) }
                                } catch (err: any) { alert('Failed: ' + err.message) }
                                finally { setLoading(false) }
                            }}
                            disabled={loading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold hover:bg-indigo-100 transition disabled:opacity-50"
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            {loading ? 'Sending...' : 'Email Invoice'}
                        </button>
                    )}
                </div>
            </div>

            {/* Warehouse Documents — packing slip, label, send buttons */}
            {(packingSlipUrl || shippingLabelUrl) && (
                <div className="mt-3 border-t pt-3">
                    <div className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-2">Warehouse</div>
                    <div className="flex flex-wrap gap-2">
                        {packingSlipUrl && (
                            <a href={packingSlipUrl} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-bold hover:bg-blue-100 transition">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Packing Slip
                            </a>
                        )}
                        {shippingLabelUrl && (
                            <a href={shippingLabelUrl} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-[10px] font-bold hover:bg-red-100 transition">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Shipping Label
                            </a>
                        )}
                    </div>

                    {/* Warehouse Quick-Send Buttons */}
                    <div className="mt-3 space-y-2">
                        {warehouseMembers.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {warehouseMembers.map(wm => {
                                    const sendCount = warehouseSendLog.filter(l => l.email === wm.email).length
                                    return (
                                        <button
                                            key={wm.id}
                                            onClick={async () => {
                                                setLoading(true)
                                                try {
                                                    const res = await adminSendToWarehouseAction(orderId, wm.email)
                                                    if (res.success) {
                                                        alert(`Sent to ${wm.name}!`)
                                                        router.refresh()
                                                    } else {
                                                        alert('Failed: ' + res.error)
                                                    }
                                                } catch (err: any) {
                                                    alert('Failed: ' + err.message)
                                                } finally {
                                                    setLoading(false)
                                                }
                                            }}
                                            disabled={loading}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg text-xs font-bold hover:bg-orange-100 transition disabled:opacity-50"
                                        >
                                            Send to {wm.name}
                                            {sendCount > 0 && (
                                                <span className="bg-orange-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">{sendCount}</span>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        )}

                        {/* Custom email send */}
                        <button
                            onClick={() => setShowWarehouseSend(!showWarehouseSend)}
                            className="text-[10px] font-bold text-orange-500 hover:text-orange-700 uppercase tracking-wider"
                        >
                            {showWarehouseSend ? 'Cancel' : 'Send to custom email...'}
                        </button>

                        {showWarehouseSend && (
                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 space-y-2">
                                <input
                                    type="email"
                                    value={warehouseEmail}
                                    onChange={e => setWarehouseEmail(e.target.value)}
                                    placeholder="warehouse@email.com"
                                    className="w-full border border-orange-200 rounded px-3 py-2 text-sm bg-white outline-none focus:border-orange-400"
                                />
                                <button
                                    onClick={async () => {
                                        if (!warehouseEmail) { alert('Enter warehouse email'); return }
                                        setLoading(true)
                                        try {
                                            const res = await adminSendToWarehouseAction(orderId, warehouseEmail)
                                            if (res.success) {
                                                alert('Sent to warehouse!')
                                                setShowWarehouseSend(false)
                                                router.refresh()
                                            } else {
                                                alert('Failed: ' + res.error)
                                            }
                                        } catch (err: any) {
                                            alert('Failed: ' + err.message)
                                        } finally {
                                            setLoading(false)
                                        }
                                    }}
                                    disabled={loading || !warehouseEmail}
                                    className="w-full py-2 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 transition disabled:opacity-50"
                                >
                                    {loading ? 'Sending...' : 'Send'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Manual Uploads */}
            <details className="mt-4 border-t pt-3">
                <summary className="text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-600">Manual Uploads</summary>
                <div className="mt-2 flex flex-col gap-2">
                    {(['invoice', 'packing_slip', 'delivery_note'] as const).map(type => (
                        <label key={type} className="flex flex-col">
                            <span className="text-[9px] text-slate-400 font-bold uppercase ml-1">{type.replace(/_/g, ' ')}</span>
                            <input type="file" onChange={(e) => handleUploadDoc(e, type)} disabled={!!uploadingDoc}
                                className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100" />
                            {uploadingDoc === type && <span className="text-[10px] text-blue-500 mt-1">Uploading...</span>}
                        </label>
                    ))}
                </div>
            </details>

            {/* Delete Order */}
            <details className="mt-4 border-t border-red-100 pt-3">
                <summary className="text-[10px] font-bold text-red-400 uppercase tracking-wider cursor-pointer hover:text-red-600">Danger Zone</summary>
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-[10px] text-red-600 mb-2">Permanently delete this order and all related data (items, payments, documents). This cannot be undone.</p>
                    <button
                        onClick={async () => {
                            const typed = prompt('Type DELETE to confirm permanent deletion:')
                            if (typed !== 'DELETE') return
                            setLoading(true)
                            try {
                                const res = await adminDeleteOrderAction(orderId)
                                if (res.success) {
                                    router.push('/admin/orders')
                                } else {
                                    alert('Failed: ' + res.error)
                                }
                            } catch (err: any) {
                                alert('Failed: ' + err.message)
                            } finally {
                                setLoading(false)
                            }
                        }}
                        disabled={loading}
                        className="w-full py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition disabled:opacity-50"
                    >
                        Delete Order
                    </button>
                </div>
            </details>
        </div>
    )
}
