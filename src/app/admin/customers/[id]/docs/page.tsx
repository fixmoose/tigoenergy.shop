'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface DocEntry {
    type: 'proforma' | 'invoice' | 'packing_slip' | 'shipping_label' | 'storno' | 'quote'
    label: string
    url: string
    orderNumber: string
    orderId: string
    date: string
    invoiceNumber?: string
}

const DOC_ICONS: Record<string, { bg: string; text: string; label: string }> = {
    proforma: { bg: 'bg-amber-50', text: 'text-amber-600', label: 'Proforma / Predračun' },
    invoice: { bg: 'bg-green-50', text: 'text-green-600', label: 'Invoice / Račun' },
    packing_slip: { bg: 'bg-blue-50', text: 'text-blue-600', label: 'Packing Slip / Dobavnica' },
    shipping_label: { bg: 'bg-purple-50', text: 'text-purple-600', label: 'Shipping Label' },
    storno: { bg: 'bg-red-50', text: 'text-red-600', label: 'Storno / Credit Note' },
    quote: { bg: 'bg-teal-50', text: 'text-teal-600', label: 'Quote / Ponudba' },
}

export default function CustomerDocsPage() {
    const params = useParams()
    const customerId = params.id as string

    const [customer, setCustomer] = useState<any>(null)
    const [docs, setDocs] = useState<DocEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [typeFilter, setTypeFilter] = useState('all')

    useEffect(() => {
        async function load() {
            const supabase = createClient()

            // Fetch customer
            const { data: cust } = await supabase
                .from('customers')
                .select('id, email, first_name, last_name, company_name')
                .eq('id', customerId)
                .single()
            setCustomer(cust)

            // Fetch orders with document fields
            const { data: orders } = await supabase
                .from('orders')
                .select('id, order_number, invoice_url, invoice_number, invoice_created_at, packing_slip_url, shipping_label_url, created_at, status')
                .eq('customer_id', customerId)
                .order('created_at', { ascending: false })

            // Fetch quotes for this customer
            const { data: quotes } = await supabase
                .from('quotes')
                .select('id, quote_number, created_at, status, token')
                .eq('customer_id', customerId)
                .order('created_at', { ascending: false })

            // Build document list
            const allDocs: DocEntry[] = []

            for (const order of (orders || [])) {
                // Proforma — always available as on-demand PDF
                allDocs.push({
                    type: 'proforma',
                    label: 'Proforma',
                    url: `/api/orders/${order.id}/proforma`,
                    orderNumber: order.order_number,
                    orderId: order.id,
                    date: order.created_at,
                })

                // Invoice
                if (order.invoice_url || order.invoice_number) {
                    allDocs.push({
                        type: 'invoice',
                        label: order.invoice_number || 'Invoice',
                        url: order.invoice_url || `/api/orders/${order.id}/invoice`,
                        orderNumber: order.order_number,
                        orderId: order.id,
                        date: order.invoice_created_at || order.created_at,
                        invoiceNumber: order.invoice_number,
                    })
                }

                // Packing Slip — always available as on-demand PDF
                allDocs.push({
                    type: 'packing_slip',
                    label: 'Packing Slip',
                    url: order.packing_slip_url || `/api/orders/${order.id}/packing-slip`,
                    orderNumber: order.order_number,
                    orderId: order.id,
                    date: order.created_at,
                })

                // Shipping Label
                if (order.shipping_label_url) {
                    allDocs.push({
                        type: 'shipping_label',
                        label: 'Shipping Label',
                        url: order.shipping_label_url,
                        orderNumber: order.order_number,
                        orderId: order.id,
                        date: order.created_at,
                    })
                }
            }

            // Quotes
            for (const q of (quotes || [])) {
                allDocs.push({
                    type: 'quote',
                    label: q.quote_number,
                    url: `/admin/quotes/${q.id}`,
                    orderNumber: q.quote_number,
                    orderId: q.id,
                    date: q.created_at,
                })
            }

            // Sort by date descending
            allDocs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            setDocs(allDocs)
            setLoading(false)
        }
        load()
    }, [customerId])

    const filtered = docs.filter(d => {
        if (typeFilter !== 'all' && d.type !== typeFilter) return false
        if (search) {
            const s = search.toLowerCase()
            if (!d.orderNumber.toLowerCase().includes(s) && !d.label.toLowerCase().includes(s) && !(d.invoiceNumber || '').toLowerCase().includes(s)) return false
        }
        return true
    })

    // Group by order
    const grouped = filtered.reduce((acc, doc) => {
        const key = doc.orderNumber
        if (!acc[key]) acc[key] = { orderNumber: key, orderId: doc.orderId, date: doc.date, docs: [] }
        acc[key].docs.push(doc)
        return acc
    }, {} as Record<string, { orderNumber: string; orderId: string; date: string; docs: DocEntry[] }>)

    const typeCounts = docs.reduce((acc, d) => {
        acc[d.type] = (acc[d.type] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    if (loading) return <div className="p-6">Loading documents...</div>

    const displayName = customer?.company_name || `${customer?.first_name || ''} ${customer?.last_name || ''}`.trim() || customer?.email

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-4 mb-2">
                <Link href={`/admin/customers/${customerId}`} className="text-blue-600 hover:text-blue-800 text-sm">← Back to Customer</Link>
            </div>

            <div className="flex items-start justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Documents Library</h1>
                    <p className="text-slate-500">{displayName} — {customer?.email}</p>
                </div>
                <span className="text-sm text-slate-400 bg-slate-100 px-3 py-1 rounded-full font-medium">
                    {docs.length} documents
                </span>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <input
                            type="text"
                            placeholder="Search by order #, invoice #..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm bg-white">
                        <option value="all">All Types ({docs.length})</option>
                        {Object.entries(DOC_ICONS).map(([key, info]) => (
                            typeCounts[key] ? <option key={key} value={key}>{info.label} ({typeCounts[key]})</option> : null
                        ))}
                    </select>
                </div>
            </div>

            {/* Documents grouped by order */}
            {Object.keys(grouped).length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border p-12 text-center text-slate-400">
                    {docs.length === 0 ? 'No documents found for this customer.' : 'No documents match your search.'}
                </div>
            ) : (
                <div className="space-y-4">
                    {Object.values(grouped).map(group => (
                        <div key={group.orderNumber} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                            <div className="px-5 py-3 bg-slate-50 border-b flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-slate-800 text-sm">{group.orderNumber}</span>
                                    <span className="text-xs text-slate-400">{new Date(group.date).toLocaleDateString('en-GB')}</span>
                                </div>
                                {!group.orderNumber.startsWith('QUO-') && (
                                    <Link href={`/admin/orders/${group.orderId}`} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                                        View Order →
                                    </Link>
                                )}
                            </div>
                            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {group.docs.map((doc, idx) => {
                                    const style = DOC_ICONS[doc.type] || DOC_ICONS.invoice
                                    const isLink = doc.type === 'quote'
                                    return isLink ? (
                                        <Link
                                            key={idx}
                                            href={doc.url}
                                            className={`flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition group`}
                                        >
                                            <div className={`w-10 h-10 ${style.bg} rounded-lg flex items-center justify-center shrink-0`}>
                                                <svg className={`w-5 h-5 ${style.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium text-slate-800 truncate">{style.label}</div>
                                                <div className="text-[10px] text-slate-400">{doc.label}</div>
                                            </div>
                                        </Link>
                                    ) : (
                                        <a
                                            key={idx}
                                            href={doc.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/50 transition group`}
                                        >
                                            <div className={`w-10 h-10 ${style.bg} rounded-lg flex items-center justify-center shrink-0`}>
                                                <svg className={`w-5 h-5 ${style.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-medium text-slate-800 truncate">{style.label}</div>
                                                {doc.invoiceNumber && <div className="text-[10px] text-slate-400">{doc.invoiceNumber}</div>}
                                            </div>
                                            <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        </a>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
