'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Customer, Order, Quote } from '@/types/database'
import SavedCartsList from '@/components/cart/SavedCartsList'
import { useTranslations } from 'next-intl'
import { resolveInvoicePdfUrl } from '@/lib/utils/invoice-pdf-url'

interface Props {
    user: User
    customer: Customer
    // When set, this component renders the dashboard of that customer as seen
    // by admins from /admin/customers/[id]. All data fetches are routed to
    // /api/admin/customers/[id]/dashboard instead of the self-auth routes.
    adminViewCustomerId?: string
}

const QUOTE_STATUS_STYLES: Record<string, string> = {
    sent: 'bg-blue-100 text-blue-700',
    viewed: 'bg-blue-100 text-blue-700',
    accepted: 'bg-amber-100 text-amber-700',
    expired: 'bg-gray-100 text-gray-500',
    declined: 'bg-red-100 text-red-700',
    draft: 'bg-gray-100 text-gray-500',
}

interface UnpaidInvoice {
    id: string
    invoice_number: string
    invoice_date: string
    customer_name: string | null
    company_name: string | null
    total: number
    vat_amount: number
    currency: string
    pdf_url: string | null
    paid: boolean
}

interface ArchiveInvoice extends UnpaidInvoice {
    net_amount: number
    paid_at: string | null
    notes: string | null
}

import type { SavedCart } from '@/types/database'

export default function MyOrders({ user, customer, adminViewCustomerId }: Props) {
    const [orders, setOrders] = useState<Order[]>([])
    const [quotes, setQuotes] = useState<Quote[]>([])
    const [unpaidInvoices, setUnpaidInvoices] = useState<UnpaidInvoice[]>([])
    const [archiveInvoices, setArchiveInvoices] = useState<ArchiveInvoice[]>([])
    const [archiveOpen, setArchiveOpen] = useState(false)
    const [mirrorSavedCarts, setMirrorSavedCarts] = useState<SavedCart[] | null>(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const t = useTranslations('dashboard')

    useEffect(() => {
        const fetchData = async () => {
            if (adminViewCustomerId) {
                // Admin mirror mode: fetch the whole payload for the target
                // customer through a single admin-scoped endpoint.
                try {
                    const res = await fetch(`/api/admin/customers/${adminViewCustomerId}/dashboard`)
                    const data = await res.json()
                    if (data.success) {
                        setOrders(data.data.orders || [])
                        setQuotes(data.data.quotes || [])
                        setUnpaidInvoices(data.data.unpaidInvoices || [])
                        setArchiveInvoices(data.data.archiveInvoices || [])
                        setMirrorSavedCarts(data.data.savedCarts || [])
                    }
                } catch { /* ignore */ }
                setLoading(false)
                return
            }

            // Self-serve mode: customer viewing their own dashboard.
            const supabase = createClient()
            const [ordersRes, quotesRes] = await Promise.all([
                supabase
                    .from('orders')
                    .select('*')
                    .eq('customer_id', user.id)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('quotes')
                    .select('*')
                    .eq('customer_id', user.id)
                    .neq('status', 'draft')
                    .order('created_at', { ascending: false })
            ])

            if (ordersRes.data) setOrders(ordersRes.data)
            if (quotesRes.data) setQuotes(quotesRes.data)
            setLoading(false)

            try {
                const [unpaidRes, archiveRes] = await Promise.all([
                    fetch('/api/customer/unpaid-invoices'),
                    fetch('/api/customer/invoices'),
                ])
                const [unpaidJson, archiveJson] = await Promise.all([
                    unpaidRes.json(),
                    archiveRes.json(),
                ])
                if (unpaidJson.success) setUnpaidInvoices(unpaidJson.data || [])
                if (archiveJson.success) setArchiveInvoices(archiveJson.data || [])
            } catch { /* ignore */ }
        }
        fetchData()
    }, [user.id, adminViewCustomerId])

    const filtered = search.trim()
        ? orders.filter(o =>
            o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
            (o as any).po_number?.toLowerCase().includes(search.toLowerCase()) ||
            o.invoice_number?.toLowerCase().includes(search.toLowerCase())
          )
        : orders

    const activeQuotes = quotes.filter(q => q.status === 'sent' || q.status === 'viewed')

    return (
        <>
        {/* Active Quotes */}
        {!loading && activeQuotes.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-amber-200 overflow-hidden mb-6">
                <div className="p-6 border-b border-amber-100 bg-amber-50/50 flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <h3 className="font-bold text-lg text-gray-900">{t('activeQuotes')}</h3>
                </div>
                <div className="divide-y divide-amber-50">
                    {activeQuotes.map(quote => (
                        <div key={quote.id} className="p-6 hover:bg-amber-50/30 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="bg-amber-100 p-3 rounded-xl">
                                    <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                </div>
                                <div>
                                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                                        <span className="font-bold text-lg text-gray-900">{t('quoteLabel')} #{quote.quote_number}</span>
                                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${QUOTE_STATUS_STYLES[quote.status] || 'bg-gray-100 text-gray-500'}`}>
                                            {quote.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-500 font-medium">
                                        {t('validUntil', { date: new Date(quote.expires_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-none pt-4 md:pt-0">
                                <div className="text-right">
                                    <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-0.5">{t('totalAmount')}</p>
                                    <p className="text-lg font-bold text-gray-900">{quote.currency || 'EUR'} {quote.total.toFixed(2)}</p>
                                </div>
                                <a
                                    href={`/quote/${quote.token}`}
                                    className="bg-amber-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-amber-700 transition-all shadow-sm hover:shadow-md"
                                >
                                    {t('viewQuote')}
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* All Quotes History */}
        {!loading && quotes.length > 0 && quotes.length !== activeQuotes.length && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
                <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-100 text-gray-500 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <h3 className="font-bold text-lg text-gray-900">{t('quoteHistory')}</h3>
                </div>
                <div className="divide-y divide-gray-50">
                    {quotes.filter(q => q.status !== 'sent' && q.status !== 'viewed').map(quote => (
                        <div key={quote.id} className="p-6 hover:bg-gray-50 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="bg-gray-100 p-3 rounded-xl">
                                    <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                </div>
                                <div>
                                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                                        <span className="font-bold text-lg text-gray-900">{t('quoteLabel')} #{quote.quote_number}</span>
                                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${QUOTE_STATUS_STYLES[quote.status] || 'bg-gray-100 text-gray-500'}`}>
                                            {quote.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-500 font-medium">
                                        {quote.created_at && t('placedOn', { date: new Date(quote.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-none pt-4 md:pt-0">
                                <div className="text-right">
                                    <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-0.5">{t('totalAmount')}</p>
                                    <p className="text-lg font-bold text-gray-900">{quote.currency || 'EUR'} {quote.total.toFixed(2)}</p>
                                </div>
                                <a
                                    href={`/quote/${quote.token}`}
                                    className="bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-black transition-all shadow-sm hover:shadow-md"
                                >
                                    {t('viewQuote')}
                                </a>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Unpaid Invoices from Initra */}
        {!loading && unpaidInvoices.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-red-200 overflow-hidden mb-6">
                <div className="p-6 border-b border-red-100 bg-red-50/50 flex items-center gap-3">
                    <div className="w-8 h-8 bg-red-100 text-red-700 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-gray-900">Unpaid Invoices</h3>
                        <p className="text-sm text-red-600 font-medium">
                            {unpaidInvoices.length} invoice{unpaidInvoices.length !== 1 ? 's' : ''} outstanding &mdash; {unpaidInvoices[0]?.currency || 'EUR'} {unpaidInvoices.reduce((s, i) => s + i.total, 0).toFixed(2)}
                        </p>
                    </div>
                </div>
                <div className="divide-y divide-red-50">
                    {unpaidInvoices.map(inv => (
                        <div key={inv.id} className="p-6 hover:bg-red-50/30 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="bg-red-100 p-3 rounded-xl">
                                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                </div>
                                <div>
                                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                                        <span className="font-bold text-lg text-gray-900">Invoice #{inv.invoice_number}</span>
                                        <span className="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider bg-red-100 text-red-700">
                                            Unpaid
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-500 font-medium">
                                        {new Date(inv.invoice_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-none pt-4 md:pt-0">
                                <div className="text-right">
                                    <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-0.5">Amount Due</p>
                                    <p className="text-lg font-bold text-red-700">{inv.currency || 'EUR'} {inv.total.toFixed(2)}</p>
                                </div>
                                {resolveInvoicePdfUrl(inv.pdf_url) && (
                                    <a
                                        href={resolveInvoicePdfUrl(inv.pdf_url)!}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-black transition-all shadow-sm hover:shadow-md"
                                    >
                                        Download PDF
                                    </a>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Pay All Open Net Orders */}
        {!loading && (() => {
            const unpaidNetOrders = orders.filter(o =>
                (o as any).payment_terms === 'net30' &&
                o.payment_status !== 'paid' &&
                o.status !== 'cancelled'
            )
            if (unpaidNetOrders.length < 2) return null
            const totalDue = unpaidNetOrders.reduce((sum, o) => {
                const paid = (o as any).amount_paid || 0
                return sum + (o.total - paid)
            }, 0)
            const refs = unpaidNetOrders.map(o => o.order_number.replace('ETRG-ORD-', '').slice(-6)).join(',')
            const wiseUrl = `https://wise.com/pay/business/initraenergijadoo?amount=${totalDue.toFixed(2)}&currency=${unpaidNetOrders[0].currency || 'EUR'}&description=${refs}`
            return (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h3 className="font-bold text-lg text-blue-900">{unpaidNetOrders.length} {t('openOrders') || 'open orders'}</h3>
                        <p className="text-sm text-blue-700 font-medium mt-1">{t('totalOutstanding') || 'Total outstanding'}: <strong>{unpaidNetOrders[0].currency || 'EUR'} {totalDue.toFixed(2)}</strong></p>
                    </div>
                    <a
                        href={wiseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition shadow-md shadow-blue-200"
                    >
                        💳 {t('payAllOpenOrders') || 'Pay All Open Orders'}
                    </a>
                </div>
            )
        })()}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                    </div>
                    <h3 className="font-bold text-lg text-gray-900">{t('orderHistory')}</h3>
                </div>
                {orders.length > 0 && (
                    <div className="relative w-full sm:w-64">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={t('searchOrders')}
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {loading ? (
                <div className="p-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto mb-4"></div>
                    <p className="text-gray-400">{t('loadingOrders')}</p>
                </div>
            ) : filtered.length > 0 ? (
                <div className="divide-y divide-gray-50">
                    {filtered.map(order => (
                        <div key={order.id} className="p-6 hover:bg-gray-50 transition flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                            <div className="flex items-center gap-4">
                                <div className="bg-gray-100 p-3 rounded-xl">
                                    <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                </div>
                                <div>
                                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                                        <span className="font-bold text-lg text-gray-900">Order #{order.order_number}</span>
                                        {(order as any).po_number && (
                                            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded font-medium">
                                                P.O.: {(order as any).po_number}
                                            </span>
                                        )}
                                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${order.status === 'completed' || order.status === 'paid' || order.status === 'delivered' ? 'bg-amber-100 text-amber-700' :
                                            order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                                'bg-blue-100 text-blue-700'
                                            }`}>{order.status || 'Pending'}</span>
                                        {(order as any).payment_terms === 'net30' && (order as any).payment_due_date && order.payment_status !== 'paid' && order.status !== 'cancelled' && (() => {
                                            const dueDate = new Date((order as any).payment_due_date)
                                            const diffDays = Math.ceil((dueDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
                                            const isOverdue = diffDays < 0
                                            return (
                                                <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                                                    isOverdue ? 'bg-red-100 text-red-700' : diffDays <= 7 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                    {isOverdue ? `${Math.abs(diffDays)}d overdue` : `${diffDays}d left`}
                                                </span>
                                            )
                                        })()}
                                        {(order.payment_status === 'unpaid' || order.payment_status === 'pending' || !order.payment_status) && order.status !== 'cancelled' && (order as any).payment_terms !== 'net30' && (
                                            <span className="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider bg-amber-100 text-amber-700 animate-pulse">
                                                {t('awaitingPayment')}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-500 font-medium">
                                        {t('placedOn', { date: new Date(order.created_at!).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) })}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-none pt-4 md:pt-0">
                                <div className="text-right">
                                    <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-0.5">{t('totalAmount')}</p>
                                    <p className="text-lg font-bold text-gray-900">{order.currency} {order.total.toFixed(2)}</p>
                                </div>
                                {(order as any).payment_terms === 'net30' && order.payment_status !== 'paid' && order.status !== 'cancelled' && (
                                    <a
                                        href={`https://wise.com/pay/business/initraenergijadoo?amount=${(order.total - ((order as any).amount_paid || 0)).toFixed(2)}&currency=${order.currency || 'EUR'}&description=${order.order_number.replace('ETRG-ORD-', '').slice(-6)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-all shadow-sm hover:shadow-md"
                                    >
                                        {t('payNow') || 'Pay Now'}
                                    </a>
                                )}
                                <Link
                                    href={`/orders/${order.id}`}
                                    className="bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-black transition-all shadow-sm hover:shadow-md"
                                >
                                    {t('viewDetails')}
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            ) : orders.length > 0 ? (
                <div className="p-12 text-center">
                    <p className="text-gray-500 font-medium">{t('noOrdersMatch')}</p>
                    <button onClick={() => setSearch('')} className="mt-2 text-sm text-amber-600 hover:underline">{t('clearSearch')}</button>
                </div>
            ) : (
                <div className="p-20 text-center">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{t('noOrders')}</h3>
                    <p className="text-gray-500 mb-8 max-w-xs mx-auto">{t('noOrdersDesc')}</p>
                    <Link href="/products" className="inline-block bg-amber-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-amber-200 hover:bg-amber-700 transition-all">
                        {t('startShopping')}
                    </Link>
                </div>
            )}
        </div>

        {/* Invoice Archive — full history of invoices issued to this customer,
            matched by VAT ID. Collapsed by default; surfaces both paid and
            unpaid rows so the customer can audit past activity. */}
        {!loading && archiveInvoices.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-6">
                <button
                    type="button"
                    onClick={() => setArchiveOpen(v => !v)}
                    className="w-full p-6 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3 hover:bg-gray-100/60 transition text-left"
                >
                    <div className="w-8 h-8 bg-gray-200 text-gray-700 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-lg text-gray-900">Invoice Archive</h3>
                        <p className="text-sm text-gray-500">
                            {archiveInvoices.length} invoice{archiveInvoices.length !== 1 ? 's' : ''} on file · total {archiveInvoices[0]?.currency || 'EUR'} {archiveInvoices.reduce((s, i) => s + i.total, 0).toFixed(2)}
                        </p>
                    </div>
                    <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${archiveOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
                {archiveOpen && (
                    <div className="divide-y divide-gray-100">
                        {archiveInvoices.map(inv => (
                            <div key={inv.id} className="px-6 py-4 hover:bg-gray-50/40 transition flex flex-col md:flex-row md:items-center justify-between gap-3">
                                <div className="flex items-center gap-4">
                                    <div className={`p-2.5 rounded-lg ${inv.paid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-gray-900">Invoice #{inv.invoice_number}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${inv.paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {inv.paid ? 'Paid' : 'Unpaid'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {new Date(inv.invoice_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            {inv.paid && inv.paid_at && (
                                                <span className="text-green-600"> · paid {new Date(inv.paid_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Total</p>
                                        <p className="text-sm font-bold text-gray-900">{inv.currency || 'EUR'} {inv.total.toFixed(2)}</p>
                                    </div>
                                    {resolveInvoicePdfUrl(inv.pdf_url) && (
                                        <a
                                            href={resolveInvoicePdfUrl(inv.pdf_url)!}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs font-semibold text-gray-700 hover:text-gray-900 underline"
                                        >
                                            PDF
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        <SavedCartsList
            injectedCarts={adminViewCustomerId ? mirrorSavedCarts : null}
            readOnly={!!adminViewCustomerId}
        />
        </>
    )
}
