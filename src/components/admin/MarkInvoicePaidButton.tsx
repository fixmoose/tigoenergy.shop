'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
    invoiceId: string
    invoiceNumber: string
    total: number
    currency: string
}

export default function MarkInvoicePaidButton({ invoiceId, invoiceNumber, total, currency }: Props) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10))
    const [method, setMethod] = useState('Bank transfer')
    const [reference, setReference] = useState('')

    async function submit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setSubmitting(true)
        try {
            // Append a structured payment line to the existing notes so the
            // record shows method + reference even though manual_invoices
            // doesn't carry a separate payment_method column.
            const paymentLine = `Payment recorded ${paidDate} — ${method}${reference ? ` (ref: ${reference})` : ''}`
            const res = await fetch('/api/admin/manual-invoices', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: invoiceId,
                    paid: true,
                    paid_at: new Date(paidDate).toISOString(),
                    notes_append: paymentLine,
                }),
            })
            const data = await res.json()
            if (!data.success) throw new Error(data.error || 'Failed to mark paid')
            setOpen(false)
            router.refresh()
        } catch (err: any) {
            setError(err.message || 'Failed')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-sm"
                title="Record payment for this invoice"
            >
                Mark Paid
            </button>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-gray-100">
                            <h2 className="text-base font-bold text-gray-900">Record payment</h2>
                            <p className="text-xs text-gray-500 mt-1">
                                Invoice <span className="font-mono font-bold">{invoiceNumber}</span> · {currency} {Number(total).toFixed(2)}
                            </p>
                        </div>
                        <form onSubmit={submit} className="px-5 py-4 space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Payment date</label>
                                <input
                                    type="date"
                                    value={paidDate}
                                    onChange={e => setPaidDate(e.target.value)}
                                    required
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Method</label>
                                <select
                                    value={method}
                                    onChange={e => setMethod(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                >
                                    <option>Bank transfer</option>
                                    <option>Wise</option>
                                    <option>Card</option>
                                    <option>Cash</option>
                                    <option>Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Reference (optional)</label>
                                <input
                                    type="text"
                                    value={reference}
                                    onChange={e => setReference(e.target.value)}
                                    placeholder="Bank reference, transaction ID, etc."
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                />
                            </div>
                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">{error}</div>
                            )}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    disabled={submitting}
                                    className="flex-1 py-2 border border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {submitting ? 'Recording…' : 'Record payment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    )
}
