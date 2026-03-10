'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { issueOrderInvoiceAction, adminMarkDeliveredAction } from '@/app/actions/admin'
import { adminSendOrderForPaymentAction, adminSendOrderToClientAction } from '@/app/actions/order-notifications'

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
}

export default function AdminOrderActions({ orderId, status, paymentStatus, createdAt, confirmedAt, packingSlipUrl, shippingLabelUrl, customerEmail, sendCount = 0 }: AdminOrderActionsProps) {
    const [loading, setLoading] = useState(false)
    const [uploadingDoc, setUploadingDoc] = useState<'invoice' | 'packing_slip' | 'delivery_note' | null>(null)
    const [currentTime, setCurrentTime] = useState(new Date())
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
        const hours = Math.floor(ms / (3600000))
        const minutes = Math.floor((ms % 3600000) / 60000)
        const seconds = Math.floor((ms % 60000) / 1000)
        return `${hours}h ${minutes}m ${seconds}s`
    }

    const isWithin2h = diffHours < 2
    const isPending = status === 'pending'
    const isConfirmed = !!confirmedAt || status !== 'pending'

    const handleConfirm = async () => {
        if (isWithin2h && !confirm('The 2-hour cancellation window for the customer has not expired yet. Are you sure you want to confirm now?')) {
            return
        }

        setLoading(true)
        try {
            const { error } = await supabase
                .from('orders')
                .update({
                    status: 'processing',
                    confirmed_at: new Date().toISOString()
                })
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
            // Only generate mock data for GLS for now
            const mockTrackingNumber = carrier === 'GLS' ? `GLS${Math.floor(Math.random() * 1000000000)}` : ''
            const mockTrackingUrl = carrier === 'GLS'
                ? `https://gls-group.eu/EU/en/track-trace?match=${mockTrackingNumber}`
                : ''

            const res = await fetch(`/api/admin/orders/${orderId}/ship`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    carrier,
                    trackingNumber: mockTrackingNumber,
                    trackingUrl: mockTrackingUrl
                })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to process shipping')

            // If DPD, the server returns the real tracking info in the order state or response
            // For now, the API returns { ok: true }
            alert(`${carrier} shipment processed successfully.\nConfirmation email sent to customer.`)
            router.refresh()
        } catch (err: any) {
            console.error('Error shipping order:', err)
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

            const { error: uploadError } = await supabase.storage
                .from('invoices')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('invoices')
                .getPublicUrl(filePath)

            // Update order record
            const updates: any = {}
            if (type === 'invoice') {
                updates.invoice_url = publicUrl
                updates.invoice_created_at = new Date().toISOString()
            } else if (type === 'packing_slip') {
                updates.packing_slip_url = publicUrl
            } else if (type === 'delivery_note') {
                updates.shipping_label_url = publicUrl
            }

            const { error: updateError } = await supabase
                .from('orders')
                .update(updates)
                .eq('id', orderId)

            if (updateError) throw updateError

            alert(`${type.replace('_', ' ')} uploaded successfully.`)
            router.refresh()
        } catch (err: any) {
            console.error('Upload error:', err)
            alert('Failed to upload document: ' + err.message)
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
        } catch (err: any) {
            console.error('Error issuing invoice:', err)
            alert('Failed to issue invoice')
        } finally {
            setLoading(false)
        }
    }

    const handleMarkDelivered = async () => {
        if (!confirm('Mark this order as delivered and notify the customer?')) return
        setLoading(true)
        try {
            const res = await adminMarkDeliveredAction(orderId)
            if (res.success) {
                router.refresh()
            } else {
                alert(res.error || 'Failed to mark as delivered')
            }
        } catch (err: any) {
            alert('Failed to mark as delivered')
        } finally {
            setLoading(false)
        }
    }

    if (status === 'cancelled') return null

    return (
        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
            <h3 className="font-semibold text-slate-800">Order Management</h3>

            {isPending && !confirmedAt ? (
                <div className="space-y-4">
                    {isWithin2h && (
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-800">
                            <p className="font-medium flex items-center gap-2">
                                <span className="animate-pulse">⏳</span> Cancellation window active
                            </p>
                            <p className="text-xs mt-1">
                                Customer can still cancel for another <span className="font-bold">{formatTime(remainingMs)}</span>.
                            </p>
                        </div>
                    )}
                    <button
                        onClick={handleConfirm}
                        disabled={loading}
                        className="w-full py-2.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition disabled:opacity-50 shadow-lg shadow-green-100"
                    >
                        {loading ? 'Processing...' : 'Confirm Order'}
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-green-700 font-medium bg-green-50 px-3 py-2 rounded-lg border border-green-100">
                        <span>✓</span> Order Confirmed {confirmedAt && `at ${new Date(confirmedAt).toLocaleString()}`}
                    </div>

                    {/* Send to Client */}
                    <div className="pt-1 space-y-2">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Order Document</p>
                        <a
                            href={`/api/orders/${orderId}/proforma`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-2.5 bg-slate-700 text-white rounded-xl font-bold hover:bg-slate-800 transition flex items-center justify-center gap-2 text-sm"
                        >
                            <span>📄</span> Download Order Confirmation
                        </a>
                        <button
                            onClick={async () => {
                                if (!confirm(`Send order summary email to ${customerEmail || 'customer'}?`)) return
                                setLoading(true)
                                try {
                                    const res = await adminSendOrderToClientAction(orderId)
                                    if (res.success) {
                                        alert('Order sent to client successfully.')
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
                            className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                        >
                            <span>✉️</span> {loading ? 'Sending...' : 'Send to Client'}
                            {sendCount > 0 && (
                                <span className="ml-1 bg-indigo-800 text-indigo-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                    ×{sendCount}
                                </span>
                            )}
                        </button>
                        {sendCount > 0 && (
                            <p className="text-[10px] text-center text-slate-400">
                                Sent to {customerEmail || 'client'} {sendCount} time{sendCount !== 1 ? 's' : ''}
                            </p>
                        )}
                    </div>

                    {(status === 'processing' || status === 'shipped') && (
                        <div className="space-y-6">
                            {/* Step 2: Packing */}
                            <div className={`p-4 rounded-xl border-2 transition-all ${!packingSlipUrl ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-white opacity-60'}`}>
                                <h4 className="text-xs font-black uppercase text-amber-700 mb-2 flex items-center gap-2">
                                    <span>📦</span> Step 2: Packing
                                </h4>
                                <p className="text-[10px] text-amber-600 mb-3 font-medium">Generate the packing slip to start preparing the items in the warehouse.</p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => window.open(`/api/orders/${orderId}/packing-slip`, '_blank')}
                                        className="flex-1 py-2 bg-white border border-amber-300 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-100 transition"
                                    >
                                        Generate & View Slip
                                    </button>
                                </div>
                            </div>

                            {/* Step 3: Shipping */}
                            <div className={`p-4 rounded-xl border-2 transition-all ${status === 'processing' ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-white opacity-60'}`}>
                                <h4 className="text-xs font-black uppercase text-blue-700 mb-2 flex items-center gap-2">
                                    <span>🚚</span> Step 3: Shipping
                                </h4>
                                <p className="text-[10px] text-blue-600 mb-3 font-medium">Create the official DPD shipping label and notify the customer.</p>
                                <button
                                    onClick={() => handleShipOrder('DPD')}
                                    disabled={loading || status === 'shipped'}
                                    className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition disabled:opacity-50 shadow-lg shadow-red-100 flex items-center justify-center gap-2"
                                >
                                    <span>🏷️</span> Process DPD Label
                                </button>
                                {shippingLabelUrl && (
                                    <a href={shippingLabelUrl} target="_blank" className="block text-center mt-2 text-[10px] font-bold text-red-600 hover:underline">
                                        View Generated Label PDF
                                    </a>
                                )}
                            </div>
                        </div>
                    )}

                    {(status === 'shipped' || status === 'delivered' || status === 'completed') && (
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Shipping Tools</p>
                            <div className="flex flex-col gap-2">
                                <button className="text-left text-sm text-blue-600 hover:underline flex items-center gap-2">
                                    <span>📄</span> Re-print Shipping Label
                                </button>
                                <button className="text-left text-sm text-blue-600 hover:underline flex items-center gap-2">
                                    <span>✉️</span> Re-email Label to Customer
                                </button>
                            </div>
                        </div>
                    )}

                    {(status === 'shipped' || status === 'delivered' || status === 'completed' || status === 'processing') && (
                        <div className="pt-2 space-y-2">
                            <button
                                onClick={handleIssueInvoice}
                                disabled={loading}
                                className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <span>📄</span> {loading ? 'Wait...' : 'Issue Official Invoice'}
                            </button>
                            {status === 'shipped' && (
                                <button
                                    onClick={handleMarkDelivered}
                                    disabled={loading}
                                    className="w-full py-2.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <span>✅</span> {loading ? 'Wait...' : 'Mark as Delivered & Notify Customer'}
                                </button>
                            )}
                        </div>
                    )}

                    {paymentStatus !== 'paid' && (
                        <div className="pt-4 border-t">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Payment</p>
                            <button
                                onClick={async () => {
                                    if (!confirm('Send a payment request email to the customer with order details and IBAN instructions?')) return
                                    setLoading(true)
                                    try {
                                        await adminSendOrderForPaymentAction(orderId)
                                        alert('Payment request sent to customer.')
                                    } catch (err: any) {
                                        alert('Failed: ' + err.message)
                                    } finally {
                                        setLoading(false)
                                    }
                                }}
                                disabled={loading}
                                className="w-full py-2.5 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <span>💳</span> {loading ? 'Sending...' : 'Send Payment Request to Customer'}
                            </button>
                        </div>
                    )}

                    <div className="pt-4 border-t space-y-3">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Manual Uploads</p>

                        <div className="flex flex-col gap-2">
                            <label className="flex flex-col">
                                <span className="text-[10px] text-slate-400 font-bold uppercase ml-1">Invoice</span>
                                <input
                                    type="file"
                                    onChange={(e) => handleUploadDoc(e, 'invoice')}
                                    disabled={!!uploadingDoc}
                                    className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                />
                                {uploadingDoc === 'invoice' && <span className="text-[10px] text-blue-500 mt-1">Uploading...</span>}
                            </label>

                            <label className="flex flex-col">
                                <span className="text-[10px] text-slate-400 font-bold uppercase ml-1">Packing Slip</span>
                                <input
                                    type="file"
                                    onChange={(e) => handleUploadDoc(e, 'packing_slip')}
                                    disabled={!!uploadingDoc}
                                    className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100"
                                />
                                {uploadingDoc === 'packing_slip' && <span className="text-[10px] text-blue-500 mt-1">Uploading...</span>}
                            </label>

                            <label className="flex flex-col">
                                <span className="text-[10px] text-slate-400 font-bold uppercase ml-1">Delivery Note</span>
                                <input
                                    type="file"
                                    onChange={(e) => handleUploadDoc(e, 'delivery_note')}
                                    disabled={!!uploadingDoc}
                                    className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
                                />
                                {uploadingDoc === 'delivery_note' && <span className="text-[10px] text-blue-500 mt-1">Uploading...</span>}
                            </label>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
