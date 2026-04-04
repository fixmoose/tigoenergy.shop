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
    const [marginSummary, setMarginSummary] = useState<any>(null)
    const [ddvSummary, setDdvSummary] = useState<any>(null)
    const [expensesSummary, setExpensesSummary] = useState<any>(null)
    const [showExpenseForm, setShowExpenseForm] = useState(false)
    const [editingExpense, setEditingExpense] = useState<any>(null)
    const [expenseForm, setExpenseForm] = useState({ date: '', description: '', category: 'Shipping & Logistics', amount_eur: '', vat_amount: '', supplier: '', invoice_number: '', notes: '' })
    const [uploadingReceipt, setUploadingReceipt] = useState<string | null>(null)
    const [dropHover, setDropHover] = useState(false)
    const [processingDrop, setProcessingDrop] = useState(false)

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
            if (reportType === 'expenses') {
                const defaultSummary = { totalAmount: 0, totalVat: 0, totalNet: 0, count: 0, byCategory: [] }
                try {
                    const res = await fetch(`/api/admin/expenses?year=${year}${month ? `&month=${month}` : ''}`)
                    const data = await res.json()
                    if (data.success) {
                        setOrders(data.data.expenses || [])
                        setExpensesSummary(data.data.summary || defaultSummary)
                    } else {
                        setOrders([])
                        setExpensesSummary(defaultSummary)
                    }
                } catch {
                    setOrders([])
                    setExpensesSummary(defaultSummary)
                }
                setMarginSummary(null)
                setDdvSummary(null)
            } else {
                const res = await fetch(`/api/admin/reporting/accounting?year=${year}${month ? `&month=${month}` : ''}&type=${reportType}`)
                const data = await res.json()
                if (data.success) {
                    if (reportType === 'margin') {
                        setOrders(data.data.orders || [])
                        setMarginSummary(data.data.summary)
                        setDdvSummary(null)
                    } else if (reportType === 'ddv') {
                        setOrders(data.data.orders || [])
                        setDdvSummary(data.data.summary)
                        setMarginSummary(null)
                    } else if (reportType === 'orders' || reportType === 'invoices') {
                        setOrders(data.data.orders)
                        setSummary(data.data.summary)
                        setMarginSummary(null)
                        setDdvSummary(null)
                    } else {
                        setOrders(data.data.records || [])
                        setMarginSummary(null)
                        setDdvSummary(null)
                    }
                }
                setExpensesSummary(null)
            }
        } catch (error) {
            console.error('Failed to fetch accounting data:', error)
        } finally {
            setLoading(false)
        }
    }

    const EXPENSE_CATEGORIES = ['Fuel', 'Phone & Internet', 'Office Supplies', 'Software & Subscriptions', 'Shipping & Logistics', 'Warehouse & Rent', 'Marketing & Advertising', 'Insurance', 'Professional Services', 'Bank & Financial', 'Travel & Transport', 'Meals & Entertainment', 'Equipment & Tools', 'Compliance & Fees', 'Utilities', 'Other']

    const handleSaveExpense = async () => {
        if (!expenseForm.date || !expenseForm.description || !expenseForm.amount_eur) {
            alert('Please fill in date, description, and amount.')
            return
        }
        try {
            const method = editingExpense ? 'PUT' : 'POST'
            const body = editingExpense ? { id: editingExpense.id, ...expenseForm, amount_eur: Number(expenseForm.amount_eur), vat_amount: Number(expenseForm.vat_amount) || 0 } : { ...expenseForm, amount_eur: Number(expenseForm.amount_eur), vat_amount: Number(expenseForm.vat_amount) || 0 }
            const res = await fetch('/api/admin/expenses', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            const data = await res.json()
            if (data.success) {
                setShowExpenseForm(false)
                setEditingExpense(null)
                setExpenseForm({ date: '', description: '', category: 'Shipping & Logistics', amount_eur: '', vat_amount: '', supplier: '', invoice_number: '', notes: '' })
                fetchData()
            } else {
                alert('Error: ' + data.error)
            }
        } catch (err: any) {
            alert('Failed to save expense: ' + err.message)
        }
    }

    const handleDeleteExpense = async (id: string) => {
        if (!confirm('Delete this expense?')) return
        try {
            const res = await fetch(`/api/admin/expenses?id=${id}`, { method: 'DELETE' })
            const data = await res.json()
            if (data.success) fetchData()
            else alert('Error: ' + data.error)
        } catch (err: any) {
            alert('Failed to delete: ' + err.message)
        }
    }

    const handleEditExpense = (expense: any) => {
        setEditingExpense(expense)
        setExpenseForm({
            date: expense.date,
            description: expense.description,
            category: expense.category,
            amount_eur: String(expense.amount_eur),
            vat_amount: String(expense.vat_amount || ''),
            supplier: expense.supplier || '',
            invoice_number: expense.invoice_number || '',
            notes: expense.notes || '',
        })
        setShowExpenseForm(true)
    }

    const handleReceiptUpload = async (expenseId: string, file: File) => {
        setUploadingReceipt(expenseId)
        try {
            const ext = file.name.split('.').pop() || 'pdf'
            const filePath = `expenses/receipt_${expenseId}_${Date.now()}.${ext}`
            const formData = new FormData()
            formData.append('file', file)
            formData.append('expenseId', expenseId)
            formData.append('path', filePath)
            const res = await fetch('/api/admin/expenses/upload', { method: 'PUT', body: formData })
            const data = await res.json()
            if (!data.success) throw new Error(data.error || 'Upload failed')
            fetchData()
        } catch (err: any) {
            alert('Failed to upload receipt: ' + err.message)
        } finally {
            setUploadingReceipt(null)
        }
    }

    const handleReceiptDrop = (expenseId: string) => (e: React.DragEvent) => {
        e.preventDefault()
        const file = e.dataTransfer.files?.[0]
        if (file) handleReceiptUpload(expenseId, file)
    }

    // Main drop zone: upload file → create expense with receipt → open edit form
    const handleMainDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        setDropHover(false)
        const file = e.dataTransfer.files?.[0]
        if (!file) return
        await handleNewReceiptUpload(file)
    }

    const handleNewReceiptUpload = async (file: File) => {
        setProcessingDrop(true)
        try {
            const ext = file.name.split('.').pop() || 'pdf'
            const ts = Date.now()
            const storagePath = `expenses/receipt_${ts}.${ext}`

            // 1. Upload to storage
            const uploadForm = new FormData()
            uploadForm.append('file', file)
            uploadForm.append('expenseId', 'temp')
            uploadForm.append('path', storagePath)
            const uploadRes = await fetch('/api/admin/expenses/upload', { method: 'PUT', body: uploadForm })
            const uploadData = await uploadRes.json()

            // 2. Create expense record with receipt attached
            const receiptUrl = `/api/storage?bucket=invoices&path=${encodeURIComponent(storagePath)}`
            const expenseData = {
                date: new Date().toISOString().split('T')[0],
                description: file.name.replace(/\.[^.]+$/, ''),
                category: 'Other',
                amount_eur: 0,
                vat_amount: 0,
                receipt_url: receiptUrl,
            }
            const createRes = await fetch('/api/admin/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(expenseData),
            })
            const createData = await createRes.json()

            if (createData.success && createData.data) {
                // Open edit form pre-filled so user can enter details
                handleEditExpense({ ...createData.data, receipt_url: receiptUrl })
                fetchData()
            } else {
                alert('Failed to create expense: ' + (createData.error || 'Unknown error'))
            }
        } catch (err: any) {
            alert('Upload failed: ' + err.message)
        } finally {
            setProcessingDrop(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [year, month, reportType])

    const filteredOrders = useMemo(() => {
        if (!searchQuery) return orders
        const q = searchQuery.toLowerCase()
        if (reportType === 'expenses') {
            return orders.filter(o =>
                o.description?.toLowerCase().includes(q) ||
                o.supplier?.toLowerCase().includes(q) ||
                o.category?.toLowerCase().includes(q) ||
                o.invoice_number?.toLowerCase().includes(q) ||
                o.notes?.toLowerCase().includes(q) ||
                o.amount_eur?.toString().includes(q)
            )
        }
        return orders.filter(o =>
            o.order_number?.toLowerCase().includes(q) ||
            o.customer_email?.toLowerCase().includes(q) ||
            o.company_name?.toLowerCase().includes(q) ||
            o.invoice_number?.toLowerCase().includes(q) ||
            o.total?.toString().includes(q)
        )
    }, [orders, searchQuery, reportType])

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)
    }


    const months = [
        { v: 0, l: 'All Months' },
        { v: 1, l: 'January' }, { v: 2, l: 'February' }, { v: 3, l: 'March' },
        { v: 4, l: 'April' }, { v: 5, l: 'May' }, { v: 6, l: 'June' },
        { v: 7, l: 'July' }, { v: 8, l: 'August' }, { v: 9, l: 'September' },
        { v: 10, l: 'October' }, { v: 11, l: 'November' }, { v: 12, l: 'December' }
    ]
    const periodLabel = month === 0 ? `${year}` : `${months.find(m => m.v === month)?.l} ${year}`

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
                        {/* Expenses moved to dedicated /admin/accounting section */}
                        <option value="ddv">DDV (VAT)</option>
                        <option value="margin">Margin Report</option>
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
                                    period={`${periodLabel}`}
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
            {reportType === 'expenses' ? (
                <div className="space-y-6">
                    {/* DROP ZONE — main receipt upload */}
                    <div
                        onDragOver={e => { e.preventDefault(); setDropHover(true) }}
                        onDragLeave={() => setDropHover(false)}
                        onDrop={handleMainDrop}
                        onClick={() => {
                            if (processingDrop) return
                            const input = document.createElement('input')
                            input.type = 'file'
                            input.accept = 'image/*,.pdf'
                            input.onchange = (e: any) => { const f = e.target.files?.[0]; if (f) handleNewReceiptUpload(f) }
                            input.click()
                        }}
                        className={`relative rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${
                            processingDrop
                                ? 'border-blue-400 bg-blue-50'
                                : dropHover
                                    ? 'border-blue-500 bg-blue-50 scale-[1.01]'
                                    : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'
                        }`}
                    >
                        {processingDrop ? (
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                <div className="text-sm font-bold text-blue-600">Uploading receipt...</div>
                            </div>
                        ) : (
                            <>
                                <div className="text-4xl mb-3 opacity-40">&#128206;</div>
                                <div className="text-lg font-bold text-slate-700">Drop receipt here</div>
                                <div className="text-sm text-slate-400 mt-1">PDF, JPG, PNG — or click to browse</div>
                            </>
                        )}
                    </div>

                    {/* Summary row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-5 rounded-2xl border border-red-200 shadow-sm">
                            <div className="text-xs font-bold uppercase tracking-wider text-red-600 mb-1">Total Expenses</div>
                            <div className="text-3xl font-black text-red-600">{formatCurrency(expensesSummary?.totalAmount || 0)}</div>
                            <div className="text-[10px] text-slate-400 mt-1">{expensesSummary?.count || 0} receipts this month</div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Net (excl. VAT)</div>
                            <div className="text-2xl font-bold text-slate-800">{formatCurrency(expensesSummary?.totalNet || 0)}</div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Input VAT (deductible)</div>
                            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(expensesSummary?.totalVat || 0)}</div>
                        </div>
                    </div>

                    {/* Category breakdown */}
                    {expensesSummary?.byCategory && expensesSummary.byCategory.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {expensesSummary.byCategory.map((c: any) => (
                                <div key={c.category} className="bg-white border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-3 shadow-sm">
                                    <span className="text-sm font-bold text-slate-700">{c.category}</span>
                                    <span className="text-sm font-black text-red-600">{formatCurrency(c.total)}</span>
                                    <span className="text-[10px] text-slate-400">{c.count}x</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Search + manual add */}
                    <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                        <input
                            type="text"
                            placeholder="Search expenses..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full md:w-96 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition"
                        />
                        <button
                            onClick={() => { setEditingExpense(null); setExpenseForm({ date: new Date().toISOString().split('T')[0], description: '', category: 'Shipping & Logistics', amount_eur: '', vat_amount: '', supplier: '', invoice_number: '', notes: '' }); setShowExpenseForm(true) }}
                            className="bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-black transition shadow-sm whitespace-nowrap"
                        >
                            + Add manually
                        </button>
                    </div>

                    {/* Expense cards */}
                    {loading ? (
                        <div className="text-center py-12 text-slate-400">Loading expenses...</div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                            <div className="text-3xl opacity-30 mb-3">&#128203;</div>
                            <div className="text-slate-500 font-medium">No expenses for {periodLabel}</div>
                            <div className="text-sm text-slate-400 mt-1">Drop a receipt above or add one manually</div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredOrders.map((expense: any) => (
                                <div key={expense.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:border-slate-300 transition group">
                                    <div className="flex items-start gap-4 p-5">
                                        {/* Left: date badge */}
                                        <div className="flex-shrink-0 w-14 text-center">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase">
                                                {new Date(expense.date).toLocaleDateString('en', { month: 'short' })}
                                            </div>
                                            <div className="text-2xl font-black text-slate-700 leading-tight">
                                                {new Date(expense.date).getDate()}
                                            </div>
                                        </div>

                                        {/* Middle: details */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <span className="text-sm font-bold text-slate-800">{expense.description}</span>
                                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{expense.category}</span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                                {expense.supplier && <span>{expense.supplier}</span>}
                                                {expense.invoice_number && <span className="font-mono text-slate-400">#{expense.invoice_number}</span>}
                                                {expense.notes && <span className="italic text-slate-400 truncate max-w-[200px]">{expense.notes}</span>}
                                            </div>
                                            {/* Receipt link */}
                                            <div className="flex items-center gap-3 mt-2">
                                                {expense.receipt_url ? (
                                                    <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer"
                                                        className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1 rounded-lg transition inline-flex items-center gap-1">
                                                        &#128196; View Receipt
                                                    </a>
                                                ) : (
                                                    <label className={`text-xs font-bold px-3 py-1 rounded-lg cursor-pointer transition inline-flex items-center gap-1 ${
                                                        uploadingReceipt === expense.id
                                                            ? 'text-slate-400 bg-slate-100'
                                                            : 'text-orange-600 hover:text-orange-800 bg-orange-50 hover:bg-orange-100'
                                                    }`}>
                                                        &#128206; {uploadingReceipt === expense.id ? 'Uploading...' : 'Attach receipt'}
                                                        <input type="file" className="hidden" accept="image/*,.pdf" disabled={uploadingReceipt === expense.id}
                                                            onChange={e => { const f = e.target.files?.[0]; if (f) handleReceiptUpload(expense.id, f); e.target.value = '' }} />
                                                    </label>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right: amount + actions */}
                                        <div className="flex-shrink-0 text-right">
                                            <div className="text-lg font-black text-red-600">{formatCurrency(Number(expense.amount_eur))}</div>
                                            {Number(expense.vat_amount) > 0 && (
                                                <div className="text-xs text-emerald-600 font-medium">VAT: {formatCurrency(Number(expense.vat_amount))}</div>
                                            )}
                                            <div className="flex items-center justify-end gap-2 mt-3 opacity-0 group-hover:opacity-100 transition">
                                                <button onClick={() => handleEditExpense(expense)} className="text-xs font-bold text-blue-500 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded transition">Edit</button>
                                                <button onClick={() => handleDeleteExpense(expense.id)} className="text-xs font-bold text-red-400 hover:text-red-600 bg-red-50 px-2 py-1 rounded transition">Delete</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : reportType === 'ddv' && ddvSummary ? (
                <div className="space-y-4">
                    {/* DDV Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white p-5 rounded-2xl border border-red-200 shadow-sm">
                            <div className="text-xs font-bold uppercase tracking-wider text-red-600 mb-1">VAT Owed to Gov</div>
                            <div className="text-3xl font-black text-red-600">{formatCurrency(ddvSummary.totalVat)}</div>
                            <div className="text-[10px] text-slate-400 mt-1">Reserve this on bank account</div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Net Revenue (excl. VAT)</div>
                            <div className="text-2xl font-bold text-slate-800">{formatCurrency(ddvSummary.totalSubtotal)}</div>
                            <div className="text-[10px] text-slate-400 mt-1">{ddvSummary.invoiceCount} invoices</div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Gross (incl. VAT)</div>
                            <div className="text-2xl font-bold text-slate-800">{formatCurrency(ddvSummary.totalGross)}</div>
                            <div className="text-[10px] text-emerald-600 font-semibold mt-1">{formatCurrency(ddvSummary.totalPaid)} paid</div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-sm">
                            <div className="text-xs font-bold uppercase tracking-wider text-amber-600 mb-1">Outstanding</div>
                            <div className="text-2xl font-bold text-amber-600">{formatCurrency(ddvSummary.totalOutstanding)}</div>
                            <div className="text-[10px] text-slate-400 mt-1">Unpaid invoiced orders</div>
                        </div>
                    </div>
                    {/* Breakdown by VAT Rate */}
                    {ddvSummary.byRate && ddvSummary.byRate.length > 0 && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Breakdown by VAT Rate</div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {ddvSummary.byRate.map((r: any) => (
                                    <div key={r.rate} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-lg font-black text-slate-700">{r.rate}%</span>
                                            <span className="text-[10px] text-slate-400">{r.count} invoices</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div>
                                                <div className="text-[10px] text-slate-400">Net</div>
                                                <div className="text-sm font-bold text-slate-700">{formatCurrency(r.subtotal)}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-red-400">VAT</div>
                                                <div className="text-sm font-bold text-red-600">{formatCurrency(r.vat)}</div>
                                            </div>
                                            <div>
                                                <div className="text-[10px] text-slate-400">Gross</div>
                                                <div className="text-sm font-bold text-slate-700">{formatCurrency(r.total)}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : reportType === 'margin' && marginSummary ? (
                <div className="space-y-4">
                    {/* Margin Summary — 3 segments */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                            { key: 'invoiced', label: 'Invoiced (Actual)', color: 'emerald', desc: 'Based on issued invoices' },
                            { key: 'confirmed', label: 'Confirmed Orders', color: 'blue', desc: 'Processing + shipped + delivered' },
                            { key: 'all', label: 'All Orders', color: 'slate', desc: 'Excludes cancelled' },
                        ].map(seg => {
                            const d = marginSummary[seg.key]
                            if (!d) return null
                            return (
                                <div key={seg.key} className={`bg-white p-5 rounded-2xl border shadow-sm ${seg.color === 'emerald' ? 'border-emerald-200' : seg.color === 'blue' ? 'border-blue-200' : 'border-slate-200'}`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className={`text-xs font-bold uppercase tracking-wider ${seg.color === 'emerald' ? 'text-emerald-600' : seg.color === 'blue' ? 'text-blue-600' : 'text-slate-500'}`}>{seg.label}</div>
                                        <div className="text-[10px] text-slate-400">{d.count} orders</div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <div className="text-[10px] text-slate-400 uppercase">Revenue (Net)</div>
                                            <div className="text-lg font-bold text-slate-800">{formatCurrency(d.revenue || 0)}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-slate-400 uppercase">Cost</div>
                                            <div className="text-lg font-bold text-slate-500">{formatCurrency(d.cost || 0)}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-slate-400 uppercase">Margin</div>
                                            <div className={`text-xl font-black ${(d.margin || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(d.margin || 0)}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-slate-400 uppercase">Margin %</div>
                                            <div className={`text-xl font-black ${(d.margin_pct || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{(d.margin_pct || 0).toFixed(1)}%</div>
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-2">{seg.desc}</div>
                                </div>
                            )
                        })}
                    </div>
                    {/* Warehouse payout note */}
                    {marginSummary.invoiced && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                            <span className="text-amber-500 text-lg">💰</span>
                            <div>
                                <div className="text-sm font-bold text-amber-800">Warehouse Margin Share (25%)</div>
                                <div className="text-xs text-amber-700 mt-1">
                                    Invoiced margin: <strong>{formatCurrency(marginSummary.invoiced.margin)}</strong> ×  25% = <strong>{formatCurrency(marginSummary.invoiced.margin * 0.25)}</strong>
                                </div>
                                <div className="text-[10px] text-amber-600 mt-1">
                                    Transport costs are NOT included (only item sell price minus item purchase cost).
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="text-sm font-medium text-slate-500 mb-1">Total Sales ({periodLabel})</div>
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
            )}

            {/* Search and Table — not shown for expenses (they have their own card view) */}
            {reportType !== 'expenses' && <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
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
                    <div className="flex items-center gap-3">
                        {reportType === 'expenses' && (
                            <button
                                onClick={() => { setEditingExpense(null); setExpenseForm({ date: new Date().toISOString().split('T')[0], description: '', category: 'Shipping & Logistics', amount_eur: '', vat_amount: '', supplier: '', invoice_number: '', notes: '' }); setShowExpenseForm(true) }}
                                className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-700 transition"
                            >
                                + Add Expense
                            </button>
                        )}
                        <div className="text-xs text-slate-500 font-medium">
                            Showing {filteredOrders.length} records
                        </div>
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
                                {reportType === 'ddv' && (
                                    <>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Invoice / Date</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Net</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">VAT %</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">VAT</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Gross</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Payment</th>
                                    </>
                                )}
                                {reportType === 'margin' && (
                                    <>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Order / Date</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Revenue</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Cost</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Margin</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">%</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Invoice</th>
                                    </>
                                )}
                                {reportType === 'expenses' && (
                                    <>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Description</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Category</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Supplier</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Amount</th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">VAT</th>
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
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${record.status === 'completed' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                            record.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-100' :
                                                                'bg-blue-50 text-blue-700 border-blue-100'
                                                            }`}>
                                                            {record.status}
                                                        </span>
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${record.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                            record.payment_status === 'net30' ? 'bg-blue-50 text-blue-700 border-blue-100' :
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
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${record.status === 'received' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
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

                                        {reportType === 'ddv' && (
                                            <>
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-800">{record.invoice_number}</div>
                                                    <div className="text-[10px] text-slate-400 font-medium uppercase mt-1">
                                                        {record.invoice_created_at ? new Date(record.invoice_created_at).toLocaleDateString() : new Date(record.created_at).toLocaleDateString()}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 font-mono">#{record.order_number}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-semibold text-slate-700">{record.company_name || record.customer_email}</div>
                                                    {record.company_name && <div className="text-xs text-slate-400">{record.customer_email}</div>}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="font-bold text-slate-800">{formatCurrency(Number(record.subtotal) || 0)}</div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                                                        {record.vat_rate || 0}%
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="font-bold text-red-600">{formatCurrency(Number(record.vat_amount) || 0)}</div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="font-bold text-slate-800">{formatCurrency(Number(record.total) || 0)}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${record.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                            record.payment_status === 'partially_paid' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                            record.payment_status === 'net30' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                            'bg-slate-50 text-slate-600 border-slate-100'
                                                            }`}>
                                                            {record.payment_status}
                                                        </span>
                                                        {record.payment_terms === 'net30' && record.payment_due_date && (
                                                            <span className="text-[9px] text-slate-400">Due: {record.payment_due_date}</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </>
                                        )}

                                        {reportType === 'margin' && (
                                            <>
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-800">{record.order_number}</div>
                                                    <div className="text-[10px] text-slate-400 font-medium uppercase mt-1">
                                                        {new Date(record.created_at).toLocaleDateString()}
                                                    </div>
                                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase mt-1 ${record.status === 'delivered' || record.status === 'completed' ? 'bg-amber-50 text-amber-700' : record.status === 'shipped' ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-600'}`}>
                                                        {record.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-semibold text-slate-700">{record.company_name || record.customer_email}</div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="font-bold text-slate-800">{formatCurrency(record.revenue)}</div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="font-mono text-sm text-slate-500">{formatCurrency(record.cost)}</div>
                                                    {record.cost === 0 && <div className="text-[9px] text-red-400 font-bold">NO COST DATA</div>}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className={`font-black text-sm ${(record.margin || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        {formatCurrency(record.margin || 0)}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold ${(record.margin_pct || 0) >= 20 ? 'bg-emerald-50 text-emerald-700' : (record.margin_pct || 0) >= 10 ? 'bg-amber-50 text-amber-700' : (record.margin_pct || 0) >= 0 ? 'bg-orange-50 text-orange-700' : 'bg-red-50 text-red-700'}`}>
                                                        {(record.margin_pct || 0).toFixed(1)}%
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {record.invoice_number ? (
                                                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">{record.invoice_number}</span>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-300 italic">—</span>
                                                    )}
                                                </td>
                                            </>
                                        )}

                                        {reportType === 'expenses' && (
                                            <>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-medium text-slate-800">{new Date(record.date).toLocaleDateString()}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-semibold text-slate-800">{record.description}</div>
                                                    {record.invoice_number && <div className="text-[10px] text-slate-400 font-mono mt-0.5">{record.invoice_number}</div>}
                                                    {record.notes && <div className="text-[10px] text-slate-400 italic mt-0.5">{record.notes}</div>}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded font-medium">{record.category}</span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-600">{record.supplier || '—'}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="font-bold text-red-600">{formatCurrency(Number(record.amount_eur))}</div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="text-sm text-emerald-600 font-medium">{formatCurrency(Number(record.vat_amount) || 0)}</div>
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
                                            {reportType === 'expenses' ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => handleEditExpense(record)} className="text-blue-500 hover:text-blue-700 text-xs font-bold transition">Edit</button>
                                                    <button onClick={() => handleDeleteExpense(record.id)} className="text-red-400 hover:text-red-600 text-xs font-bold transition">Del</button>
                                                </div>
                                            ) : (
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
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>}

            {/* Expense Form Modal */}
            {showExpenseForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">{editingExpense ? 'Edit Expense' : 'Add Expense'}</h3>
                                <p className="text-sm text-slate-500">Track a business expense.</p>
                            </div>
                            <button onClick={() => { setShowExpenseForm(false); setEditingExpense(null) }} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">x</button>
                        </div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date *</label>
                                    <input type="date" value={expenseForm.date} onChange={e => setExpenseForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Category *</label>
                                    <select value={expenseForm.category} onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500">
                                        {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Description *</label>
                                <input type="text" value={expenseForm.description} onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. DPD shipping March 2026" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Amount (EUR) *</label>
                                    <input type="number" step="0.01" value={expenseForm.amount_eur} onChange={e => setExpenseForm(f => ({ ...f, amount_eur: e.target.value }))} placeholder="0.00" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">VAT Amount (EUR)</label>
                                    <input type="number" step="0.01" value={expenseForm.vat_amount} onChange={e => setExpenseForm(f => ({ ...f, vat_amount: e.target.value }))} placeholder="0.00" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Supplier</label>
                                    <input type="text" value={expenseForm.supplier} onChange={e => setExpenseForm(f => ({ ...f, supplier: e.target.value }))} placeholder="e.g. DPD d.o.o." className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Invoice #</label>
                                    <input type="text" value={expenseForm.invoice_number} onChange={e => setExpenseForm(f => ({ ...f, invoice_number: e.target.value }))} placeholder="Supplier invoice ref" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Notes</label>
                                <textarea value={expenseForm.notes} onChange={e => setExpenseForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Optional notes..." className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                            </div>
                            <button onClick={handleSaveExpense} className="w-full bg-red-600 text-white py-3 rounded-2xl font-bold hover:bg-red-700 transition shadow-lg shadow-red-100">
                                {editingExpense ? 'Update Expense' : 'Add Expense'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
