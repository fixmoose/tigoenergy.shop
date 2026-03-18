'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import AdminQuoteCreator from '@/components/admin/AdminQuoteCreator'

interface QuoteListItem {
    id: string
    quote_number: string
    customer_email: string
    company_name: string | null
    status: string
    total: number
    language: string
    created_at: string | null
    expires_at: string
    sent_at: string | null
    viewed_at: string | null
    accepted_at: string | null
    order_id: string | null
}

const STATUS_COLORS: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700',
    sent: 'bg-blue-100 text-blue-700',
    viewed: 'bg-yellow-100 text-yellow-700',
    accepted: 'bg-green-100 text-green-700',
    expired: 'bg-red-100 text-red-700',
    declined: 'bg-red-100 text-red-700',
}

const STATUS_LABELS: Record<string, string> = {
    draft: 'Draft',
    sent: 'Sent',
    viewed: 'Viewed',
    accepted: 'Accepted',
    expired: 'Expired',
    declined: 'Declined',
}

function formatCurrency(amount: number | null | undefined) {
    if (amount == null) return '€0.00'
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)
}

export default function AdminQuotesPage() {
    const [quotes, setQuotes] = useState<QuoteListItem[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [statusFilter, setStatusFilter] = useState('all')
    const [searchQuery, setSearchQuery] = useState('')

    async function fetchQuotes() {
        const supabase = createClient()
        const { data, error } = await supabase
            .from('quotes')
            .select('id,quote_number,customer_email,company_name,status,total,language,created_at,expires_at,sent_at,viewed_at,accepted_at,order_id')
            .order('created_at', { ascending: false })
            .limit(200)

        if (!error) setQuotes(data || [])
        setLoading(false)
    }

    useEffect(() => { fetchQuotes() }, [])

    const filtered = quotes.filter(q => {
        if (statusFilter !== 'all' && q.status !== statusFilter) return false
        if (searchQuery) {
            const s = searchQuery.toLowerCase()
            if (!q.quote_number.toLowerCase().includes(s) && !q.customer_email.toLowerCase().includes(s) && !(q.company_name || '').toLowerCase().includes(s)) return false
        }
        return true
    })

    const statusCounts = quotes.reduce((acc, q) => {
        acc[q.status] = (acc[q.status] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    if (loading) return <div className="p-6">Loading quotes...</div>

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Quotes / Ponudbe</h1>
                <button onClick={() => setIsCreateOpen(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                    + Create Quote
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <input type="text" placeholder="Search quote #, email, company..."
                            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                        className="px-3 py-2 border rounded-lg text-sm bg-white">
                        <option value="all">All Statuses ({quotes.length})</option>
                        {Object.entries(STATUS_LABELS).map(([key, label]) => (
                            <option key={key} value={key}>{label} ({statusCounts[key] || 0})</option>
                        ))}
                    </select>
                </div>
                <div className="mt-3 pt-3 border-t text-sm text-slate-500">
                    Showing <span className="font-medium text-slate-800">{filtered.length}</span> of {quotes.length} quotes
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                        <tr>
                            <th className="text-left px-4 py-3">Quote</th>
                            <th className="text-left px-4 py-3">Customer</th>
                            <th className="text-left px-4 py-3">Status</th>
                            <th className="text-right px-4 py-3">Total</th>
                            <th className="text-left px-4 py-3">Created</th>
                            <th className="text-left px-4 py-3">Expires</th>
                            <th className="text-right px-6 py-3"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {filtered.map(q => {
                            const isExpired = new Date(q.expires_at) < new Date() && q.status !== 'accepted'
                            const effectiveStatus = isExpired && ['sent', 'viewed', 'draft'].includes(q.status) ? 'expired' : q.status

                            return (
                                <tr key={q.id} className={`hover:bg-slate-50 ${effectiveStatus === 'expired' ? 'opacity-60' : ''}`}>
                                    <td className="px-4 py-4">
                                        <div className="font-medium text-slate-800">{q.quote_number}</div>
                                        <div className="text-xs text-slate-400">{q.language.toUpperCase()}</div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="text-sm text-slate-600 truncate max-w-[200px]">{q.customer_email}</div>
                                        {q.company_name && <div className="text-xs text-slate-400">{q.company_name}</div>}
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[effectiveStatus] || 'bg-slate-100 text-slate-700'}`}>
                                            {STATUS_LABELS[effectiveStatus] || effectiveStatus}
                                        </span>
                                        {q.order_id && (
                                            <Link href={`/admin/orders/${q.order_id}`} className="block text-xs text-green-600 hover:underline mt-1">
                                                View Order →
                                            </Link>
                                        )}
                                    </td>
                                    <td className="text-right px-4 py-4 font-medium text-slate-800">
                                        {formatCurrency(q.total)}
                                    </td>
                                    <td className="px-4 py-4 text-sm text-slate-500">
                                        {q.created_at && new Date(q.created_at).toLocaleDateString('en-GB')}
                                    </td>
                                    <td className="px-4 py-4 text-sm text-slate-500">
                                        {new Date(q.expires_at).toLocaleDateString('en-GB')}
                                    </td>
                                    <td className="text-right px-6 py-4">
                                        <Link href={`/admin/quotes/${q.id}`}
                                            className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                                            View →
                                        </Link>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>

                {filtered.length === 0 && (
                    <div className="p-8 text-center text-slate-500">
                        {quotes.length === 0 ? 'No quotes yet. Create your first one!' : 'No quotes match your filters'}
                    </div>
                )}
            </div>

            {isCreateOpen && (
                <AdminQuoteCreator
                    onClose={() => setIsCreateOpen(false)}
                    onCreated={() => { fetchQuotes(); setIsCreateOpen(false) }}
                />
            )}
        </div>
    )
}
