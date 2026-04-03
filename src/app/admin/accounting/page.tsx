'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'

const CATEGORIES = [
    'Fuel',
    'Phone & Internet',
    'Office Supplies',
    'Software & Subscriptions',
    'Shipping & Logistics',
    'Warehouse & Rent',
    'Marketing & Advertising',
    'Insurance',
    'Professional Services',
    'Bank & Financial',
    'Travel & Transport',
    'Meals & Entertainment',
    'Equipment & Tools',
    'Compliance & Fees',
    'Utilities',
    'Other',
]

interface Expense {
    id: string
    date: string
    description: string
    category: string
    amount_eur: number
    vat_amount: number
    supplier: string | null
    invoice_number: string | null
    receipt_url: string | null
    notes: string | null
}

interface Summary {
    totalAmount: number
    totalVat: number
    totalNet: number
    count: number
    byCategory: { category: string; total: number; count: number }[]
}

const emptyForm = { date: '', description: '', category: 'Other', amount_eur: '', vat_amount: '', supplier: '', invoice_number: '', notes: '' }

export default function AccountingPage() {
    const [year, setYear] = useState(new Date().getFullYear())
    const [month, setMonth] = useState(new Date().getMonth() + 1)
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [summary, setSummary] = useState<Summary | null>(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')

    // Form
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<Expense | null>(null)
    const [form, setForm] = useState(emptyForm)

    // Drop zone
    const [dropHover, setDropHover] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [uploadingReceipt, setUploadingReceipt] = useState<string | null>(null)

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const monthsFull = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

    const formatEur = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)

    const fetchExpenses = useCallback(async () => {
        setLoading(true)
        const defaultSummary: Summary = { totalAmount: 0, totalVat: 0, totalNet: 0, count: 0, byCategory: [] }
        try {
            const res = await fetch(`/api/admin/expenses?year=${year}&month=${month}`)
            const data = await res.json()
            if (data.success) {
                setExpenses(data.data.expenses || [])
                setSummary(data.data.summary || defaultSummary)
            } else {
                setExpenses([])
                setSummary(defaultSummary)
            }
        } catch {
            setExpenses([])
            setSummary(defaultSummary)
        } finally {
            setLoading(false)
        }
    }, [year, month])

    useEffect(() => { fetchExpenses() }, [fetchExpenses])

    const filtered = useMemo(() => {
        if (!search) return expenses
        const q = search.toLowerCase()
        return expenses.filter(e =>
            e.description?.toLowerCase().includes(q) ||
            e.supplier?.toLowerCase().includes(q) ||
            e.category?.toLowerCase().includes(q) ||
            e.invoice_number?.toLowerCase().includes(q) ||
            e.notes?.toLowerCase().includes(q) ||
            e.amount_eur?.toString().includes(q)
        )
    }, [expenses, search])

    // --- Actions ---

    const openNew = () => {
        setEditing(null)
        setForm({ ...emptyForm, date: new Date().toISOString().split('T')[0] })
        setShowForm(true)
    }

    const openEdit = (e: Expense) => {
        setEditing(e)
        setForm({
            date: e.date,
            description: e.description,
            category: e.category,
            amount_eur: String(e.amount_eur),
            vat_amount: String(e.vat_amount || ''),
            supplier: e.supplier || '',
            invoice_number: e.invoice_number || '',
            notes: e.notes || '',
        })
        setShowForm(true)
    }

    const saveExpense = async () => {
        if (!form.date || !form.description || !form.amount_eur) {
            alert('Fill in date, description, and amount.')
            return
        }
        const method = editing ? 'PUT' : 'POST'
        const body = {
            ...(editing ? { id: editing.id } : {}),
            ...form,
            amount_eur: Number(form.amount_eur),
            vat_amount: Number(form.vat_amount) || 0,
        }
        try {
            const res = await fetch('/api/admin/expenses', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            const data = await res.json()
            if (data.success) {
                setShowForm(false)
                setEditing(null)
                setForm(emptyForm)
                fetchExpenses()
            } else {
                alert('Error: ' + data.error)
            }
        } catch (err: any) {
            alert('Failed: ' + err.message)
        }
    }

    const deleteExpense = async (id: string) => {
        if (!confirm('Delete this expense?')) return
        try {
            const res = await fetch(`/api/admin/expenses?id=${id}`, { method: 'DELETE' })
            const data = await res.json()
            if (data.success) fetchExpenses()
            else alert('Error: ' + data.error)
        } catch (err: any) {
            alert('Failed: ' + err.message)
        }
    }

    // --- Receipt upload (new expense from drop) ---

    const uploadNewReceipt = async (file: File) => {
        setUploading(true)
        try {
            const ext = file.name.split('.').pop() || 'pdf'
            const storagePath = `expenses/receipt_${Date.now()}.${ext}`

            // Upload file
            const fd = new FormData()
            fd.append('file', file)
            fd.append('expenseId', 'temp')
            fd.append('path', storagePath)
            await fetch('/api/admin/expenses/upload', { method: 'PUT', body: fd })

            // Create expense with receipt
            const receiptUrl = `/api/storage?bucket=invoices&path=${encodeURIComponent(storagePath)}`
            const res = await fetch('/api/admin/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: new Date().toISOString().split('T')[0],
                    description: file.name.replace(/\.[^.]+$/, ''),
                    category: 'Other',
                    amount_eur: 0,
                    vat_amount: 0,
                    receipt_url: receiptUrl,
                }),
            })
            const data = await res.json()
            if (data.success && data.data) {
                openEdit(data.data)
                fetchExpenses()
            } else {
                alert('Failed: ' + (data.error || 'Unknown'))
            }
        } catch (err: any) {
            alert('Upload failed: ' + err.message)
        } finally {
            setUploading(false)
        }
    }

    // Attach receipt to existing expense
    const attachReceipt = async (expenseId: string, file: File) => {
        setUploadingReceipt(expenseId)
        try {
            const ext = file.name.split('.').pop() || 'pdf'
            const fd = new FormData()
            fd.append('file', file)
            fd.append('expenseId', expenseId)
            fd.append('path', `expenses/receipt_${expenseId}_${Date.now()}.${ext}`)
            const res = await fetch('/api/admin/expenses/upload', { method: 'PUT', body: fd })
            const data = await res.json()
            if (!data.success) throw new Error(data.error)
            fetchExpenses()
        } catch (err: any) {
            alert('Upload failed: ' + err.message)
        } finally {
            setUploadingReceipt(null)
        }
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Accounting</h1>
                    <p className="text-slate-500 text-sm">Company expenses, receipts & invoices</p>
                </div>
                <div className="flex items-center gap-2">
                    <select value={month} onChange={e => setMonth(Number(e.target.value))}
                        className="border rounded-lg px-3 py-2 text-sm bg-white">
                        {monthsFull.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                    <select value={year} onChange={e => setYear(Number(e.target.value))}
                        className="border rounded-lg px-3 py-2 text-sm bg-white">
                        {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            {/* Drop zone */}
            <div
                onDragOver={e => { e.preventDefault(); setDropHover(true) }}
                onDragLeave={() => setDropHover(false)}
                onDrop={e => { e.preventDefault(); setDropHover(false); const f = e.dataTransfer.files?.[0]; if (f) uploadNewReceipt(f) }}
                onClick={() => {
                    if (uploading) return
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'image/*,.pdf'
                    input.onchange = (e: any) => { const f = e.target.files?.[0]; if (f) uploadNewReceipt(f) }
                    input.click()
                }}
                className={`rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all ${
                    uploading ? 'border-blue-400 bg-blue-50' :
                    dropHover ? 'border-blue-500 bg-blue-50 scale-[1.01]' :
                    'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-white'
                }`}
            >
                {uploading ? (
                    <div className="text-sm font-semibold text-blue-600">Uploading...</div>
                ) : (
                    <>
                        <div className="text-5xl opacity-30 mb-2">&#128206;</div>
                        <div className="text-lg font-bold text-slate-600">Drop a receipt or invoice here</div>
                        <div className="text-sm text-slate-400 mt-1">PDF, JPG, PNG — or click to browse files</div>
                    </>
                )}
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <div className="text-[11px] font-bold uppercase text-slate-400 mb-1">Total</div>
                    <div className="text-2xl font-black text-red-600">{formatEur(summary?.totalAmount || 0)}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <div className="text-[11px] font-bold uppercase text-slate-400 mb-1">Net</div>
                    <div className="text-2xl font-bold text-slate-700">{formatEur(summary?.totalNet || 0)}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <div className="text-[11px] font-bold uppercase text-slate-400 mb-1">Input VAT</div>
                    <div className="text-2xl font-bold text-emerald-600">{formatEur(summary?.totalVat || 0)}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <div className="text-[11px] font-bold uppercase text-slate-400 mb-1">Receipts</div>
                    <div className="text-2xl font-bold text-slate-700">{summary?.count || 0}</div>
                </div>
            </div>

            {/* Category pills */}
            {summary?.byCategory && summary.byCategory.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {summary.byCategory.map(c => (
                        <span key={c.category} className="bg-white border border-slate-200 rounded-full px-3 py-1 text-xs font-semibold text-slate-600 inline-flex items-center gap-2">
                            {c.category} <span className="font-black text-red-600">{formatEur(c.total)}</span> <span className="text-slate-400">{c.count}x</span>
                        </span>
                    ))}
                </div>
            )}

            {/* Search + Add button */}
            <div className="flex gap-3">
                <input
                    type="text"
                    placeholder="Search..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button onClick={openNew} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-black transition whitespace-nowrap">
                    + Add manually
                </button>
            </div>

            {/* Expense list */}
            {loading ? (
                <div className="text-center py-16 text-slate-400">Loading...</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                    <div className="text-4xl opacity-20 mb-2">&#128203;</div>
                    <div className="text-slate-500">No expenses for {monthsFull[month - 1]} {year}</div>
                    <div className="text-sm text-slate-400 mt-1">Drop a receipt above or add one manually</div>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(expense => (
                        <div key={expense.id} className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition group">
                            <div className="flex items-center gap-4 px-4 py-3">
                                {/* Date */}
                                <div className="w-12 text-center flex-shrink-0">
                                    <div className="text-[9px] font-bold text-slate-400 uppercase">{months[new Date(expense.date).getMonth()]}</div>
                                    <div className="text-xl font-black text-slate-700 leading-tight">{new Date(expense.date).getDate()}</div>
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-sm text-slate-800 truncate">{expense.description}</span>
                                        <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{expense.category}</span>
                                    </div>
                                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                                        {expense.supplier && <span>{expense.supplier}</span>}
                                        {expense.invoice_number && <span className="font-mono">#{expense.invoice_number}</span>}
                                        {expense.receipt_url ? (
                                            <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer"
                                                className="text-blue-600 font-bold hover:underline">
                                                View receipt
                                            </a>
                                        ) : (
                                            <label className={`font-bold cursor-pointer ${uploadingReceipt === expense.id ? 'text-slate-400' : 'text-orange-500 hover:text-orange-700'}`}>
                                                {uploadingReceipt === expense.id ? 'Uploading...' : '+ Attach receipt'}
                                                <input type="file" className="hidden" accept="image/*,.pdf"
                                                    disabled={uploadingReceipt === expense.id}
                                                    onChange={e => { const f = e.target.files?.[0]; if (f) attachReceipt(expense.id, f); e.target.value = '' }} />
                                            </label>
                                        )}
                                    </div>
                                </div>

                                {/* Amount */}
                                <div className="text-right flex-shrink-0">
                                    <div className="text-base font-black text-red-600">{formatEur(Number(expense.amount_eur))}</div>
                                    {Number(expense.vat_amount) > 0 && (
                                        <div className="text-[10px] text-emerald-600 font-semibold">VAT {formatEur(Number(expense.vat_amount))}</div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                                    <button onClick={() => openEdit(expense)} className="text-xs text-blue-500 hover:text-blue-700 font-bold px-2 py-1 rounded hover:bg-blue-50">Edit</button>
                                    <button onClick={() => deleteExpense(expense.id)} className="text-xs text-red-400 hover:text-red-600 font-bold px-2 py-1 rounded hover:bg-red-50">Del</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Edit/Add Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="text-lg font-bold text-slate-800">{editing ? 'Edit Expense' : 'New Expense'}</h3>
                            <button onClick={() => { setShowForm(false); setEditing(null) }} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
                        </div>

                        {editing?.receipt_url && (
                            <div className="mb-4 p-3 bg-blue-50 rounded-xl">
                                <a href={editing.receipt_url} target="_blank" rel="noopener noreferrer"
                                    className="text-sm font-bold text-blue-600 hover:underline">
                                    View attached receipt
                                </a>
                            </div>
                        )}

                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date *</label>
                                    <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Category *</label>
                                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none">
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Description *</label>
                                <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="e.g. DPD shipping March 2026"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Amount (EUR) *</label>
                                    <input type="number" step="0.01" value={form.amount_eur} onChange={e => setForm(f => ({ ...f, amount_eur: e.target.value }))}
                                        placeholder="0.00"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">VAT Amount (EUR)</label>
                                    <input type="number" step="0.01" value={form.vat_amount} onChange={e => setForm(f => ({ ...f, vat_amount: e.target.value }))}
                                        placeholder="0.00"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Supplier</label>
                                    <input type="text" value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
                                        placeholder="e.g. DPD d.o.o."
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Invoice #</label>
                                    <input type="text" value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))}
                                        placeholder="Supplier ref"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Notes</label>
                                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                    rows={2} placeholder="Optional..."
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
                            </div>
                            <button onClick={saveExpense}
                                className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-black transition">
                                {editing ? 'Save Changes' : 'Add Expense'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
