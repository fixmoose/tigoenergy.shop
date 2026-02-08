'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface AdminOrderActionsProps {
    orderId: string
    status: string | null
    createdAt: string | null
    confirmedAt: string | null
}

export default function AdminOrderActions({ orderId, status, createdAt, confirmedAt }: AdminOrderActionsProps) {
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
        const trackingNumber = `${carrier === 'GLS' ? 'GLS' : 'DPD'}${Math.floor(Math.random() * 1000000000)}`
        const trackingUrl = carrier === 'GLS'
            ? `https://gls-group.eu/EU/en/track-trace?match=${trackingNumber}`
            : `https://www.dpd.com/tracking?type=1&text=${trackingNumber}`

        setLoading(true)
        try {
            const res = await fetch(`/api/admin/orders/${orderId}/ship`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ carrier, trackingNumber, trackingUrl })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to process shipping')

            alert(`${carrier} Label Generated: ${trackingNumber}\nConfirmation email sent to customer.`)
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

                    {(status === 'processing' || status === 'shipped') && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between pt-2">
                                <span className="text-xs font-bold text-slate-500 uppercase">Documents</span>
                                <a
                                    href={`/api/orders/${orderId}/packing-slip`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-bold text-blue-600 hover:text-blue-700 underline"
                                >
                                    View Packing Slip
                                </a>
                                {status === 'processing' && (
                                    <a
                                        href={`/api/orders/${orderId}/delivery-note`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs font-bold text-amber-600 hover:text-amber-700 underline"
                                    >
                                        View Delivery Note
                                    </a>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => handleShipOrder('GLS')}
                                    disabled={loading}
                                    className="flex flex-col items-center justify-center p-3 border-2 border-slate-100 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition group"
                                >
                                    <span className="text-xl mb-1">📦</span>
                                    <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700 text-center">Process GLS Label</span>
                                </button>
                                <button
                                    onClick={() => handleShipOrder('DPD')}
                                    disabled={loading}
                                    className="flex flex-col items-center justify-center p-3 border-2 border-slate-100 rounded-xl hover:border-red-500 hover:bg-red-50 transition group"
                                >
                                    <span className="text-xl mb-1">🚚</span>
                                    <span className="text-xs font-bold text-slate-800 group-hover:text-red-700 text-center">Process DPD Label</span>
                                </button>
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
