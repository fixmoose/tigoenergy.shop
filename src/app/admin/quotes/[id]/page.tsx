'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getQuoteAction, adminSendQuoteAction, adminUpdateQuoteStatusAction, adminDeleteQuoteAction, acceptQuoteAction } from '@/app/actions/quotes'

function formatCurrency(amount: number | null | undefined) {
    if (amount == null) return '€0.00'
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)
}

const STATUS_COLORS: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700',
    sent: 'bg-blue-100 text-blue-700',
    viewed: 'bg-yellow-100 text-yellow-700',
    accepted: 'bg-green-100 text-green-700',
    expired: 'bg-red-100 text-red-700',
    declined: 'bg-red-100 text-red-700',
}

export default function AdminQuoteDetailPage() {
    const params = useParams()
    const quoteId = params.id as string
    const [quote, setQuote] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState('')

    async function loadQuote() {
        const res = await getQuoteAction(quoteId)
        if (res.success) setQuote(res.data)
        setLoading(false)
    }

    useEffect(() => { loadQuote() }, [quoteId])

    const handleSend = async () => {
        setActionLoading('send')
        const res = await adminSendQuoteAction(quoteId)
        if (res.success) {
            alert('Quote sent to customer!')
            loadQuote()
        } else {
            alert(res.error)
        }
        setActionLoading('')
    }

    const handleExpire = async () => {
        if (!confirm('Mark this quote as expired?')) return
        setActionLoading('expire')
        await adminUpdateQuoteStatusAction(quoteId, 'expired')
        loadQuote()
        setActionLoading('')
    }

    const handleDelete = async () => {
        if (!confirm('Delete this draft quote?')) return
        setActionLoading('delete')
        const res = await adminDeleteQuoteAction(quoteId)
        if (res.success) {
            window.location.href = '/admin/quotes'
        } else {
            alert(res.error)
            setActionLoading('')
        }
    }

    if (loading) return <div className="p-6">Loading quote...</div>
    if (!quote) return <div className="p-6 text-red-600">Quote not found</div>

    const isExpired = new Date(quote.expires_at) < new Date() && quote.status !== 'accepted'
    const effectiveStatus = isExpired && ['sent', 'viewed', 'draft'].includes(quote.status) ? 'expired' : quote.status
    const items = quote.items || []

    const acceptUrl = `https://tigoenergy.shop/quote/${quote.token}`

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/admin/quotes" className="text-blue-600 hover:text-blue-800 text-sm">← Back to Quotes</Link>
            </div>

            <div className="flex items-start justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">{quote.quote_number}</h1>
                    <p className="text-slate-500">{quote.customer_email} {quote.company_name && `(${quote.company_name})`}</p>
                </div>
                <span className={`text-sm px-3 py-1 rounded-full font-medium ${STATUS_COLORS[effectiveStatus] || 'bg-slate-100 text-slate-700'}`}>
                    {effectiveStatus.toUpperCase()}
                </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Items */}
                    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                        <div className="px-6 py-4 border-b bg-slate-50">
                            <h2 className="font-bold text-slate-800">Items</h2>
                        </div>
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50/50 text-xs text-slate-500 uppercase">
                                <tr>
                                    <th className="text-left px-6 py-3">Product</th>
                                    <th className="text-left px-4 py-3">SKU</th>
                                    <th className="text-center px-4 py-3">Qty</th>
                                    <th className="text-right px-4 py-3">Unit Price</th>
                                    <th className="text-right px-6 py-3">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {items.map((item: any) => (
                                    <tr key={item.id}>
                                        <td className="px-6 py-3 font-medium">{item.product_name}</td>
                                        <td className="px-4 py-3 text-slate-400">{item.sku}</td>
                                        <td className="px-4 py-3 text-center">{item.quantity}</td>
                                        <td className="px-4 py-3 text-right">{formatCurrency(item.unit_price)}</td>
                                        <td className="px-6 py-3 text-right font-medium">{formatCurrency(item.total_price)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="border-t-2">
                                <tr>
                                    <td colSpan={4} className="text-right px-4 py-2 text-slate-500">Subtotal</td>
                                    <td className="text-right px-6 py-2 font-medium">{formatCurrency(quote.subtotal)}</td>
                                </tr>
                                <tr>
                                    <td colSpan={4} className="text-right px-4 py-2 text-slate-500">Shipping</td>
                                    <td className="text-right px-6 py-2 font-medium">{formatCurrency(quote.shipping_cost)}</td>
                                </tr>
                                <tr>
                                    <td colSpan={4} className="text-right px-4 py-2 text-slate-500">VAT ({quote.vat_rate}%)</td>
                                    <td className="text-right px-6 py-2 font-medium">{formatCurrency(quote.vat_amount)}</td>
                                </tr>
                                <tr>
                                    <td colSpan={4} className="text-right px-4 py-3 font-bold text-lg">Total</td>
                                    <td className="text-right px-6 py-3 font-bold text-lg text-green-600">{formatCurrency(quote.total)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Address (if pre-filled) */}
                    {quote.shipping_address && (
                        <div className="bg-white rounded-xl shadow-sm border p-6">
                            <h2 className="font-bold text-slate-800 mb-3">Pre-filled Address</h2>
                            <p className="text-sm text-slate-600">
                                {quote.shipping_address.first_name} {quote.shipping_address.last_name}<br />
                                {quote.shipping_address.street}<br />
                                {quote.shipping_address.street2 && <>{quote.shipping_address.street2}<br /></>}
                                {quote.shipping_address.postal_code} {quote.shipping_address.city}<br />
                                {quote.shipping_address.country}
                            </p>
                        </div>
                    )}

                    {quote.internal_notes && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                            <h2 className="font-bold text-yellow-800 mb-2">Internal Notes</h2>
                            <p className="text-sm text-yellow-700">{quote.internal_notes}</p>
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Actions */}
                    <div className="bg-white rounded-xl shadow-sm border p-6 space-y-3">
                        <h2 className="font-bold text-slate-800 mb-4">Actions</h2>

                        <a href={`/api/admin/quotes/${quoteId}/pdf`} target="_blank" rel="noopener noreferrer"
                            className="w-full py-2.5 bg-teal-50 text-teal-700 rounded-lg font-medium hover:bg-teal-100 text-sm text-center border border-teal-200 flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Download PDF
                        </a>

                        {(quote.status === 'draft') && (
                            <button onClick={handleSend} disabled={!!actionLoading}
                                className="w-full py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 text-sm">
                                {actionLoading === 'send' ? 'Sending...' : 'Send to Customer'}
                            </button>
                        )}

                        {(quote.status === 'sent' || quote.status === 'viewed') && (
                            <button onClick={handleSend} disabled={!!actionLoading}
                                className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 text-sm">
                                {actionLoading === 'send' ? 'Sending...' : 'Resend Email'}
                            </button>
                        )}

                        {quote.status === 'accepted' && quote.order_id && (
                            <Link href={`/admin/orders/${quote.order_id}`}
                                className="block w-full py-2.5 bg-green-50 text-green-700 rounded-lg font-medium hover:bg-green-100 text-sm text-center border border-green-200">
                                View Order →
                            </Link>
                        )}

                        {['draft', 'sent', 'viewed'].includes(quote.status) && (
                            <button
                                onClick={async () => {
                                    const deliveryType = confirm('Shipping delivery?\n\nOK = Use shipping address from quote\nCancel = Personal pickup (lastni prevzem)')
                                        ? 'shipping' : 'pickup'
                                    setActionLoading('convert')
                                    try {
                                        const res = await acceptQuoteAction(quote.token, {
                                            type: deliveryType,
                                            address: deliveryType === 'shipping' && quote.shipping_address ? {
                                                street: quote.shipping_address.street || quote.shipping_address.line1 || '',
                                                city: quote.shipping_address.city || '',
                                                postal_code: quote.shipping_address.postal_code || '',
                                                country: quote.shipping_address.country || 'SI',
                                            } : undefined,
                                        })
                                        if (res.success) {
                                            alert(`Order ${res.orderNumber} created!`)
                                            loadQuote()
                                        } else {
                                            alert('Failed: ' + res.error)
                                        }
                                    } catch (err: any) { alert('Failed: ' + err.message) }
                                    finally { setActionLoading('') }
                                }}
                                disabled={!!actionLoading}
                                className="w-full py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 text-sm"
                            >
                                {actionLoading === 'convert' ? 'Converting...' : 'Convert to Order'}
                            </button>
                        )}

                        {['draft', 'sent', 'viewed'].includes(quote.status) && (
                            <button onClick={handleExpire} disabled={!!actionLoading}
                                className="w-full py-2.5 bg-amber-50 text-amber-700 rounded-lg font-medium hover:bg-amber-100 disabled:opacity-50 text-sm border border-amber-200">
                                Mark as Expired
                            </button>
                        )}

                        {quote.status === 'draft' && (
                            <button onClick={handleDelete} disabled={!!actionLoading}
                                className="w-full py-2.5 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 disabled:opacity-50 text-sm border border-red-200">
                                Delete Draft
                            </button>
                        )}

                        {/* Customer link */}
                        {['sent', 'viewed'].includes(quote.status) && (
                            <div className="mt-4 pt-4 border-t">
                                <label className="text-xs text-slate-500 block mb-1">Customer Link</label>
                                <div className="flex gap-2">
                                    <input readOnly value={acceptUrl} className="flex-1 text-xs px-2 py-1.5 border rounded bg-slate-50 text-slate-600" />
                                    <button onClick={() => { navigator.clipboard.writeText(acceptUrl); alert('Copied!') }}
                                        className="px-3 py-1.5 bg-slate-100 rounded text-xs hover:bg-slate-200 font-medium">
                                        Copy
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Timeline */}
                    <div className="bg-white rounded-xl shadow-sm border p-6">
                        <h2 className="font-bold text-slate-800 mb-4">Timeline</h2>
                        <div className="space-y-3 text-sm">
                            <div className="flex items-start gap-3">
                                <div className="w-2 h-2 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                                <div>
                                    <div className="text-slate-700">Created</div>
                                    <div className="text-xs text-slate-400">{quote.created_at && new Date(quote.created_at).toLocaleString('en-GB')}</div>
                                    {quote.created_by && <div className="text-xs text-slate-400">by {quote.created_by}</div>}
                                </div>
                            </div>
                            {quote.sent_at && (
                                <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                                    <div>
                                        <div className="text-slate-700">Sent to customer</div>
                                        <div className="text-xs text-slate-400">{new Date(quote.sent_at).toLocaleString('en-GB')}</div>
                                    </div>
                                </div>
                            )}
                            {quote.viewed_at && (
                                <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 rounded-full bg-yellow-400 mt-1.5 shrink-0" />
                                    <div>
                                        <div className="text-slate-700">Viewed by customer</div>
                                        <div className="text-xs text-slate-400">{new Date(quote.viewed_at).toLocaleString('en-GB')}</div>
                                    </div>
                                </div>
                            )}
                            {quote.accepted_at && (
                                <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 rounded-full bg-green-400 mt-1.5 shrink-0" />
                                    <div>
                                        <div className="text-slate-700">Accepted — Order created</div>
                                        <div className="text-xs text-slate-400">{new Date(quote.accepted_at).toLocaleString('en-GB')}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Details */}
                    <div className="bg-white rounded-xl shadow-sm border p-6 text-sm space-y-2">
                        <h2 className="font-bold text-slate-800 mb-3">Details</h2>
                        <div className="flex justify-between"><span className="text-slate-500">Language</span><span className="font-medium">{quote.language?.toUpperCase()}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Market</span><span className="font-medium">{quote.market?.toUpperCase()}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">B2B</span><span className="font-medium">{quote.is_b2b ? 'Yes' : 'No'}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Expires</span><span className="font-medium">{new Date(quote.expires_at).toLocaleDateString('en-GB')}</span></div>
                        {quote.vat_id && <div className="flex justify-between"><span className="text-slate-500">VAT ID</span><span className="font-medium">{quote.vat_id}</span></div>}
                    </div>
                </div>
            </div>
        </div>
    )
}
