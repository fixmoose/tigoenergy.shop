'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { issueOrderInvoiceAction, adminMarkDeliveredAction, adminRecordPaymentAction, getOrderPaymentsAction, adminDeletePaymentAction, adminSendDeliveryToDriverAction } from '@/app/actions/admin'
import { adminSendOrderForPaymentAction, adminSendOrderToClientAction } from '@/app/actions/order-notifications'
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
    customerEmail?: string | null
    sendCount?: number
    orderTotal?: number
    amountPaid?: number
    modificationUnlocked?: boolean
}

type FlowStep = 'received' | 'confirm' | 'payment' | 'packing' | 'shipping' | 'delivered' | 'invoice'

function StepCard({ step, currentStep, children, title, subtitle, icon, color }: {
    step: FlowStep
    currentStep: FlowStep
    children: React.ReactNode
    title: string
    subtitle: string
    icon: string
    color: string
}) {
    const stepOrder: FlowStep[] = ['received', 'confirm', 'payment', 'packing', 'shipping', 'delivered', 'invoice']
    const stepIdx = stepOrder.indexOf(step)
    const currentIdx = stepOrder.indexOf(currentStep)
    const isCompleted = stepIdx < currentIdx
    const isActive = stepIdx === currentIdx
    const isFuture = stepIdx > currentIdx

    const colorMap: Record<string, { border: string, text: string, bg: string }> = {
        slate: { border: 'border-slate-200', text: 'text-slate-700', bg: 'bg-slate-50' },
        green: { border: 'border-green-300', text: 'text-green-800', bg: 'bg-green-50' },
        amber: { border: 'border-amber-300', text: 'text-amber-800', bg: 'bg-amber-50' },
        blue: { border: 'border-blue-300', text: 'text-blue-800', bg: 'bg-blue-50' },
        red: { border: 'border-red-300', text: 'text-red-800', bg: 'bg-red-50' },
        indigo: { border: 'border-indigo-300', text: 'text-indigo-800', bg: 'bg-indigo-50' },
        purple: { border: 'border-purple-300', text: 'text-purple-800', bg: 'bg-purple-50' },
    }
    const c = colorMap[color] || colorMap.slate

    if (isCompleted) {
        return (
            <div className="rounded-xl border border-green-200 bg-green-50/50 p-3 opacity-70">
                <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">&#10003;</span>
                    <span className="text-xs font-bold text-green-700 uppercase tracking-wider">{title}</span>
                    <span className="text-[10px] text-green-600 ml-auto">{subtitle}</span>
                </div>
            </div>
        )
    }

    if (isFuture) {
        return (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/30 p-3 opacity-40">
                <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0">{icon}</span>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</span>
                </div>
            </div>
        )
    }

    return (
        <div className={`rounded-xl border-2 ${c.border} ${c.bg} p-4 shadow-sm`}>
            <div className="flex items-center gap-2 mb-2">
                <span className={`w-6 h-6 rounded-full ${c.bg} ${c.text} flex items-center justify-center text-xs font-bold animate-pulse border-2 ${c.border} flex-shrink-0`}>{icon}</span>
                <span className={`text-xs font-bold ${c.text} uppercase tracking-wider`}>{title}</span>
            </div>
            <p className={`text-[10px] ${c.text} opacity-70 ml-8 mb-3`}>{subtitle}</p>
            <div className="ml-8">{children}</div>
        </div>
    )
}

export default function AdminOrderActions({ orderId, status, paymentStatus, createdAt, confirmedAt, packingSlipUrl, shippingLabelUrl, customerEmail, sendCount = 0, orderTotal = 0, amountPaid = 0, modificationUnlocked = false }: AdminOrderActionsProps) {
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
    const [showDriverForm, setShowDriverForm] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        return () => clearInterval(timer)
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
    const isPaid = paymentStatus === 'paid'
    const isShipped = status === 'shipped'
    const isDelivered = status === 'delivered' || status === 'completed'

    const getCurrentStep = (): FlowStep => {
        if (isPending && !confirmedAt) return 'confirm'
        if (!isPaid) return 'payment'
        if (!packingSlipUrl) return 'packing'
        if (!isShipped && !isDelivered) return 'shipping'
        if (isShipped && !isDelivered) return 'delivered'
        return 'invoice'
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
            const { data: { publicUrl } } = supabase.storage.from('invoices').getPublicUrl(filePath)
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

    if (status === 'cancelled') return null

    return (
        <div className="bg-white rounded-xl shadow-sm border p-5">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="text-blue-500">&#9889;</span> Order Flow
            </h3>

            <div className="space-y-3">
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
                        <button onClick={handleConfirm} disabled={loading} className="w-full py-2 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700 transition disabled:opacity-50">
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
                            paymentStatus === 'paid' ? 'bg-green-100 border border-green-200 text-green-800' :
                            paymentStatus === 'partially_paid' ? 'bg-amber-100 border border-amber-200 text-amber-800' :
                            'bg-red-100 border border-red-200 text-red-700'
                        }`}>
                            <span>{paymentStatus === 'paid' ? '&#10003; Paid' : paymentStatus === 'partially_paid' ? '&#9680; Partial' : '&#9675; Unpaid'}</span>
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
                            {paymentStatus !== 'paid' && (
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

                        {paymentStatus !== 'paid' && !showPaymentForm && (
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
                                className="w-full py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition"
                            >Record Payment</button>
                        )}

                        {showPaymentForm && (
                            <div className="bg-white border border-green-200 rounded-lg p-3 space-y-2">
                                {paymentsLoaded && payments.length > 0 && (
                                    <div className="space-y-1 mb-2">
                                        {payments.map(p => (
                                            <div key={p.id} className="flex items-center justify-between bg-slate-50 rounded px-2 py-1.5 text-[10px] border">
                                                <div>
                                                    <span className="font-bold text-green-700">&euro;{Number(p.amount).toFixed(2)}</span>
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
                                        className="flex-1 py-1.5 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700 disabled:opacity-50"
                                    >{loading ? 'Saving...' : 'Confirm'}</button>
                                    <button onClick={() => setShowPaymentForm(false)} className="px-3 py-1.5 bg-white border rounded text-xs text-slate-600 hover:bg-slate-50">Cancel</button>
                                </div>
                            </div>
                        )}

                        <a href={`/api/orders/${orderId}/proforma`} target="_blank" rel="noopener noreferrer"
                            className="block w-full py-1.5 text-center bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200 transition">
                            Download Proforma
                        </a>
                    </div>
                </StepCard>

                {/* Step 4: Packing */}
                <StepCard step="packing" currentStep={currentStep} title="Packing" subtitle="Generate packing slip & prepare items" icon="4" color="blue">
                    <button onClick={() => window.open(`/api/orders/${orderId}/packing-slip`, '_blank')}
                        className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition">
                        Generate Packing Slip
                    </button>
                </StepCard>

                {/* Step 5: Shipping */}
                <StepCard step="shipping" currentStep={currentStep} title="Shipping" subtitle="Create DPD label & notify customer" icon="5" color="red">
                    <div className="space-y-2">
                        <button onClick={() => handleShipOrder('DPD')} disabled={loading}
                            className="w-full py-2.5 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition disabled:opacity-50">
                            {loading ? 'Processing...' : 'Process DPD Label'}
                        </button>
                        {shippingLabelUrl && (
                            <a href={shippingLabelUrl} target="_blank" className="block text-center text-[10px] font-bold text-red-600 hover:underline">View Label PDF</a>
                        )}
                    </div>
                </StepCard>

                {/* Step 6: Delivery */}
                <StepCard step="delivered" currentStep={currentStep} title="Delivery" subtitle="Confirm delivery by DPD, driver portal, or manually" icon="6" color="green">
                    <div className="space-y-2">
                        <button onClick={handleMarkDelivered} disabled={loading}
                            className="w-full py-2 bg-green-600 text-white rounded-lg font-bold text-sm hover:bg-green-700 transition disabled:opacity-50">
                            {loading ? 'Processing...' : 'Mark as Delivered (Manual)'}
                        </button>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
                            <div className="relative flex justify-center"><span className="bg-green-50 px-2 text-[10px] text-slate-400 font-bold uppercase">or send to driver</span></div>
                        </div>

                        {!showDriverForm ? (
                            <button onClick={() => setShowDriverForm(true)}
                                className="w-full py-2 bg-slate-700 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition">
                                Send Dobavnica to Driver
                            </button>
                        ) : (
                            <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                                <p className="text-[10px] font-bold text-slate-500 uppercase">Driver will receive a link to collect signature digitally</p>
                                <input
                                    type="email"
                                    value={driverEmail}
                                    onChange={e => setDriverEmail(e.target.value)}
                                    placeholder="driver@email.com"
                                    className="w-full border rounded px-3 py-2 text-sm"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={async () => {
                                            if (!driverEmail) { alert('Enter driver email'); return }
                                            setLoading(true)
                                            try {
                                                const res = await adminSendDeliveryToDriverAction(orderId, driverEmail)
                                                if (res.success) { alert('Delivery link sent to driver!'); setShowDriverForm(false) }
                                                else { alert('Failed: ' + res.error) }
                                            } catch (err: any) { alert('Failed: ' + err.message) }
                                            finally { setLoading(false) }
                                        }}
                                        disabled={loading}
                                        className="flex-1 py-2 bg-slate-700 text-white rounded text-xs font-bold hover:bg-slate-800 disabled:opacity-50"
                                    >{loading ? 'Sending...' : 'Send Link'}</button>
                                    <button onClick={() => setShowDriverForm(false)} className="px-3 py-2 bg-white border rounded text-xs text-slate-600 hover:bg-slate-50">Cancel</button>
                                </div>
                            </div>
                        )}
                    </div>
                </StepCard>

                {/* Step 7: Invoice & Compliance */}
                <StepCard step="invoice" currentStep={currentStep} title="Invoice & Compliance" subtitle="Issue invoice, trigger OEEE / Intrastat" icon="7" color="purple">
                    <div className="space-y-2">
                        <button onClick={handleIssueInvoice} disabled={loading}
                            className="w-full py-2 bg-purple-600 text-white rounded-lg font-bold text-sm hover:bg-purple-700 transition disabled:opacity-50">
                            {loading ? 'Wait...' : 'Issue Official Invoice'}
                        </button>
                        <p className="text-[10px] text-slate-500">After invoice: OEEE (SI domestic) or Intrastat (EU) triggered automatically.</p>
                    </div>
                </StepCard>
            </div>

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
        </div>
    )
}
