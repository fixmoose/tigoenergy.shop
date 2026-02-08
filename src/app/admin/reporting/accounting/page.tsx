'use client'

import { useState, useEffect, useMemo } from 'react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { AccountingReportPDF } from '@/components/admin/AccountingReportPDF'

export default function AccountingReportPage() {
    const [year, setYear] = useState(new Date().getFullYear())
    const [month, setMonth] = useState(new Date().getMonth() + 1)
    const [loading, setLoading] = useState(true)
    const [orders, setOrders] = useState<any[]>([])
    const [summary, setSummary] = useState({
        totalRevenue: 0,
        totalInvoices: 0,
        totalOutstanding: 0
    })
    const [searchQuery, setSearchQuery] = useState('')
    const [isMounted, setIsMounted] = useState(false)
    const [isSharing, setIsSharing] = useState(false)
    const [accountantEmail, setAccountantEmail] = useState('')
    const [shareModalOpen, setShareModalOpen] = useState(false)
    const [shareUrl, setShareUrl] = useState('')
    const [reportType, setReportType] = useState('orders')

    useEffect(() => {
        setIsMounted(true)
    }, [])

    const handleShare = async () => {
        if (!accountantEmail || !accountantEmail.includes('@')) {
            alert('Please enter a valid email address.')
            return
        }

        setIsSharing(true)
        try {
            const res = await fetch('/api/admin/reporting/accounting/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ year, month, email: accountantEmail })
            })
            const data = await res.json()
            if (data.success) {
                setShareUrl(data.shareUrl)
                alert(`Success! A secure link has been sent to ${accountantEmail}.`)
                setShareModalOpen(false)
            } else {
                throw new Error(data.error)
            }
        } catch (err: any) {
            alert('Error sharing link: ' + err.message)
        } finally {
            setIsSharing(false)
        }
    }

    const fetchData = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/admin/reporting/accounting?year=${year}&month=${month}&type=${reportType}`)
            const data = await res.json()
            if (data.success) {
                if (reportType === 'orders' || reportType === 'invoices') {
                    setOrders(data.data.orders)
                    setSummary(data.data.summary)
                } else {
                    setOrders(data.data.records || [])
                }
            }
        } catch (error) {
            console.error('Failed to fetch accounting data:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [year, month, reportType])

    const filteredOrders = useMemo(() => {
        if (!searchQuery) return orders
        const q = searchQuery.toLowerCase()
        return orders.filter(o =>
            o.order_number?.toLowerCase().includes(q) ||
            o.customer_email?.toLowerCase().includes(q) ||
            o.company_name?.toLowerCase().includes(q) ||
            o.invoice_number?.toLowerCase().includes(q) ||
            o.total?.toString().includes(q)
        )
    }, [orders, searchQuery])

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)
    }


    const months = [
        { v: 1, l: 'January' }, { v: 2, l: 'February' }, { v: 3, l: 'March' },
        { v: 4, l: 'April' }, { v: 5, l: 'May' }, { v: 6, l: 'June' },
        { v: 7, l: 'July' }, { v: 8, l: 'August' }, { v: 9, l: 'September' },
        { v: 10, l: 'October' }, { v: 11, l: 'November' }, { v: 12, l: 'December' }
    ]

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 capitalize">{reportType} Reporting</h1>
                    <p className="text-slate-500">Manage, search, and export {reportType} records.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>

                    <select
                        value={month}
                        onChange={(e) => setMonth(Number(e.target.value))}
                        className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {months.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                    </select>

                    <select
                        value={reportType}
                        onChange={(e) => setReportType(e.target.value)}
                        className="border rounded-lg px-3 py-2 text-sm bg-slate-800 text-white shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="orders">Orders</option>
                        <option value="invoices">Invoices</option>
                        <option value="returns">Returns (RMAs)</option>
                        <option value="carts">Abandoned Carts</option>
                        <option value="customers">Customers</option>
                        <option value="stock">Stock Inventory</option>
                    </select>

                    <button
                        onClick={() => setShareModalOpen(true)}
                        className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-black flex items-center gap-2 transition shadow-md shadow-slate-100"
                    >
                        <span className="text-lg">🔗</span> Share with Accountant
                    </button>

                    {isMounted ? (
                        <PDFDownloadLink
                            document={
                                <AccountingReportPDF
                                    orders={filteredOrders}
                                    summary={summary}
                                    period={`${months[month - 1].l} ${year}`}
                                />
                            }
                            fileName={`accounting_report_${year}_${month}.pdf`}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 flex items-center gap-2 transition shadow-md shadow-blue-100"
                        >
                            {({ loading: reportLoading }) => (
                                reportLoading ? 'Generating...' : <><span className="text-lg">📄</span> Export Report (PDF)</>
                            )}
                        </PDFDownloadLink>
                    ) : (
                        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold opacity-50 cursor-not-allowed flex items-center gap-2">
                            <span className="text-lg">📄</span> Export Report (PDF)
                        </button>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-sm font-medium text-slate-500 mb-1">Total Sales ({months[month - 1].l} {year})</div>
                    <div className="text-3xl font-bold text-slate-800">{formatCurrency(summary.totalRevenue)}</div>
                    <div className="text-xs text-slate-400 mt-2">Inc. VAT where applicable</div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-sm font-medium text-slate-500 mb-1">Invoices Issued</div>
                    <div className="text-3xl font-bold text-slate-800">{summary.totalInvoices}</div>
                    <div className="text-xs text-slate-400 mt-2">{orders.length} total orders</div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-sm font-medium text-slate-500 mb-1">Outstanding Receivables</div>
                    <div className="text-3xl font-bold text-amber-600">{formatCurrency(summary.totalOutstanding)}</div>
                    <div className="text-xs text-slate-400 mt-2">Excludes cancelled orders</div>
                </div>
            </div>

            {/* Search and Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/50">
                    <div className="relative w-full md:w-96">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                        <input
                            type="text"
                            placeholder="Search by order #, email, company, amount..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition"
                        />
                    </div>
                    <div className="text-xs text-slate-500 font-medium">
                        Showing {filteredOrders.length} records
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                {reportType === 'orders' && (
                                    <>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Order / Date</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Amount</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Invoice</th>
                                    </>
                                )}
                                {reportType === 'invoices' && (
                                    <>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Invoice # / Date</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Order #</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Amount</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                    </>
                                )}
                                {reportType === 'returns' && (
                                    <>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">RMA # / Date</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Order #</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Reason</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                    </>
                                )}
                                {reportType === 'carts' && (
                                    <>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Cart ID / Date</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Customer / Contact</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Location</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Value</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                    </>
                                )}
                                {reportType === 'customers' && (
                                    <>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Name / Email</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Country</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Total Orders</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Total Spent</th>
                                    </>
                                )}
                                {reportType === 'stock' && (
                                    <>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Product / SKU</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Category</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Stock Level</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Value</th>
                                    </>
                                )}
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={6} className="px-6 py-4 h-16 bg-slate-50/20"></td>
                                    </tr>
                                ))
                            ) : filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                                        No transactions found for this period.
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map((record) => (
                                    <tr key={record.id} className="hover:bg-slate-50/80 transition group">
                                        {reportType === 'orders' && (
                                            <>
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-800">{record.order_number}</div>
                                                    <div className="text-[10px] text-slate-400 font-medium uppercase mt-1">
                                                        {new Date(record.created_at).toLocaleDateString()}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-semibold text-slate-700">{record.company_name || 'Individual Customer'}</div>
                                                    <div className="text-xs text-slate-400">{record.customer_email}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${record.status === 'completed' ? 'bg-green-50 text-green-700 border-green-100' :
                                                            record.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-100' :
                                                                'bg-blue-50 text-blue-700 border-blue-100'
                                                            }`}>
                                                            {record.status}
                                                        </span>
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${record.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                            'bg-amber-50 text-amber-700 border-amber-100'
                                                            }`}>
                                                            {record.payment_status}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="font-bold text-slate-800">{formatCurrency(record.total)}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono">VAT: {record.vat_rate}%</div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {record.invoice_url ? (
                                                        <a href={record.invoice_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 font-bold text-xs flex items-center justify-center gap-1 group/link">
                                                            <span className="text-lg">📄</span>
                                                            <span className="group-hover/link:underline">{record.invoice_number || 'View'}</span>
                                                        </a>
                                                    ) : <span className="text-slate-300 text-xs italic">Not generated</span>}
                                                </td>
                                            </>
                                        )}

                                        {reportType === 'invoices' && (
                                            <>
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-800">{record.invoice_number || record.order_number}</div>
                                                    <div className="text-[10px] text-slate-400 font-medium uppercase mt-1">
                                                        {new Date(record.created_at).toLocaleDateString()}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-mono text-xs">{record.order_number}</td>
                                                <td className="px-6 py-4 text-sm">{record.company_name || record.customer_email}</td>
                                                <td className="px-6 py-4 text-right font-bold">{formatCurrency(record.total)}</td>
                                                <td className="px-6 py-4 text-xs font-bold">{record.payment_status?.toUpperCase()}</td>
                                            </>
                                        )}

                                        {reportType === 'customers' && (
                                            <>
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-800">{record.full_name}</div>
                                                    <div className="text-xs text-slate-400">{record.email}</div>
                                                </td>
                                                <td className="px-6 py-4"><span className="text-xs font-bold">{record.role?.toUpperCase()}</span></td>
                                                <td className="px-6 py-4 text-sm">{record.country || 'N/A'}</td>
                                                <td className="px-6 py-4 text-right text-sm">{record.order_count || 0}</td>
                                                <td className="px-6 py-4 text-right font-bold text-sm">{formatCurrency(record.total_spent || 0)}</td>
                                            </>
                                        )}

                                        {reportType === 'returns' && (
                                            <>
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-800">RMA-{record.id.slice(0, 8).toUpperCase()}</div>
                                                    <div className="text-[10px] text-slate-400 font-medium uppercase mt-1">
                                                        {new Date(record.created_at).toLocaleDateString()}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-mono text-xs text-blue-600 font-bold">{record.orders?.order_number || 'N/A'}</td>
                                                <td className="px-6 py-4 text-xs">{record.orders?.customer_email || 'Loading...'}</td>
                                                <td className="px-6 py-4 text-xs italic text-slate-500 max-w-[200px] truncate">{record.reason || 'No reason provided'}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${record.status === 'received' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                                        {record.status}
                                                    </span>
                                                </td>
                                            </>
                                        )}

                                        {reportType === 'carts' && (
                                            <>
                                                <td className="px-6 py-4">
                                                    <div className="font-mono text-[10px] text-slate-500">{record.id.slice(0, 8)}</div>
                                                    <div className="text-[10px] text-slate-400 font-medium uppercase mt-1">
                                                        {new Date(record.updated_at).toLocaleDateString()}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {record.customers ? (
                                                        <>
                                                            <div className="text-sm font-bold text-slate-700">{record.customers.first_name} {record.customers.last_name}</div>
                                                            <div className="text-xs text-blue-600 font-medium">{record.customers.email}</div>
                                                            {!record.customers.marketing_consent && (
                                                                <div className="text-[9px] text-red-400 font-bold uppercase mt-1">No Marketing Consent</div>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <div className="text-sm text-slate-400 italic font-medium">Guest (No Email)</div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {record.customers?.addresses?.[0] ? (
                                                        <div className="text-xs text-slate-600">
                                                            {record.customers.addresses[0].city}, {record.customers.addresses[0].country}
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs text-slate-300 italic">Unknown Location</div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right font-bold text-sm">
                                                    <div className="text-slate-800">{(record.items || []).length} Items</div>
                                                    <div className="text-[10px] text-slate-400 font-normal">
                                                        {formatCurrency((record.items || []).reduce((sum: number, item: any) => sum + (item.total_price || 0), 0))}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[10px] font-bold uppercase">Abandoned</span>
                                                </td>
                                            </>
                                        )}

                                        {reportType === 'stock' && (
                                            <>
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-800 text-sm whitespace-nowrap">{record.sku}</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">{record.name_en}</div>
                                                </td>
                                                <td className="px-6 py-4"><span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">{record.category}</span></td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className={`font-bold text-sm ${record.stock_level < 5 ? 'text-red-600' : 'text-slate-800'}`}>
                                                        {record.stock_level}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right font-bold text-sm">
                                                    {formatCurrency(record.price_eur * record.stock_level)}
                                                    <div className="text-[9px] text-slate-400 font-normal mt-0.5">Asset Value</div>
                                                </td>
                                            </>
                                        )}

                                        <td className="px-6 py-4 text-right">
                                            <a
                                                href={
                                                    reportType === 'customers' ? `/admin/customers/${record.id}` :
                                                        reportType === 'carts' ? (record.user_id ? `/admin/customers/${record.user_id}` : '#') :
                                                            `/admin/orders/${record.id || record.order_id}`
                                                }
                                                className={`text-slate-400 hover:text-slate-600 transition ${reportType === 'carts' && !record.user_id ? 'opacity-20 cursor-not-allowed' : ''}`}
                                                title="View Details"
                                            >
                                                <span>➡️</span>
                                            </a>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Share Modal */}
            {shareModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">Secure Report Sharing</h3>
                                <p className="text-sm text-slate-500">Access valid for 24 hours.</p>
                            </div>
                            <button onClick={() => setShareModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">×</button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Accountant Email</label>
                                <input
                                    type="email"
                                    value={accountantEmail}
                                    onChange={(e) => setAccountantEmail(e.target.value)}
                                    placeholder="e.g. accountant@company.com"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="bg-blue-50 p-4 rounded-2xl flex gap-3 items-start">
                                <span className="text-blue-500 text-lg">ℹ️</span>
                                <div className="text-xs text-blue-800 leading-relaxed">
                                    <p className="font-bold mb-1">How it works:</p>
                                    <p>We'll email a secure link. The recipient must verify their email to download a consolidated PDF of all monthly invoices.</p>
                                </div>
                            </div>

                            <button
                                onClick={handleShare}
                                disabled={isSharing || !accountantEmail}
                                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition disabled:opacity-50 shadow-lg shadow-blue-100"
                            >
                                {isSharing ? 'Sending Link...' : 'Generate & Send Link'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
