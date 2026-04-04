'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'

const CATEGORIES = [
    'Gorivo',
    'Telefon & internet',
    'Pisarniški material',
    'Programska oprema & naročnine',
    'Pošiljanje & logistika',
    'Skladišče & najemnina',
    'Marketing & oglaševanje',
    'Zavarovanje',
    'Strokovne storitve',
    'Banka & finance',
    'Potovanja & prevoz',
    'Prehrana & zabava',
    'Oprema & orodja',
    'Skladnost & pristojbine',
    'Komunalne storitve',
    'Drugo',
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

const emptyForm = { date: '', description: '', category: 'Drugo', amount_eur: '', vat_amount: '', supplier: '', invoice_number: '', notes: '' }

const formatDate = (d: string) => {
    const dt = new Date(d)
    return `${dt.getDate().toString().padStart(2, '0')}.${(dt.getMonth() + 1).toString().padStart(2, '0')}.${dt.getFullYear()}`
}

const isUnprocessed = (e: Expense) => e.description === 'Unprocessed' && Number(e.amount_eur) === 0

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

    const monthsSI = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec']
    const monthsFullSI = ['Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij', 'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December']

    const formatEur = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)

    const fetchExpenses = useCallback(async () => {
        setLoading(true)
        const defaultSummary: Summary = { totalAmount: 0, totalVat: 0, totalNet: 0, count: 0, byCategory: [] }
        try {
            const res = await fetch(`/api/admin/expenses?year=${year}${month ? `&month=${month}` : ''}`)
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

    const unprocessedCount = useMemo(() => expenses.filter(isUnprocessed).length, [expenses])

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
            alert('Izpolnite datum, opis in znesek.')
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
                alert('Napaka: ' + data.error)
            }
        } catch (err: any) {
            alert('Napaka: ' + err.message)
        }
    }

    const deleteExpense = async (id: string) => {
        if (!confirm('Izbriši ta strošek?')) return
        try {
            const res = await fetch(`/api/admin/expenses?id=${id}`, { method: 'DELETE' })
            const data = await res.json()
            if (data.success) fetchExpenses()
            else alert('Napaka: ' + data.error)
        } catch (err: any) {
            alert('Napaka: ' + err.message)
        }
    }

    // --- Receipt upload (new expense from drop) ---

    const uploadNewReceipt = async (file: File, skipLoadingState = false) => {
        if (!skipLoadingState) setUploading(true)
        try {
            const ext = file.name.split('.').pop() || 'pdf'
            const storagePath = `expenses/receipt_${Date.now()}.${ext}`

            // Upload file
            const fd = new FormData()
            fd.append('file', file)
            fd.append('expenseId', 'temp')
            fd.append('path', storagePath)
            await fetch('/api/admin/expenses/upload', { method: 'PUT', body: fd })

            // Create unprocessed expense with receipt — no form needed
            const receiptUrl = `/api/storage?bucket=invoices&path=${encodeURIComponent(storagePath)}`
            const res = await fetch('/api/admin/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: new Date().toISOString().split('T')[0],
                    description: 'Unprocessed',
                    category: 'Drugo',
                    amount_eur: 0,
                    vat_amount: 0,
                    receipt_url: receiptUrl,
                    notes: `Original file: ${file.name}`,
                }),
            })
            const data = await res.json()
            if (data.success) {
                fetchExpenses()
            } else {
                alert('Napaka: ' + (data.error || 'Unknown'))
            }
        } catch (err: any) {
            alert('Nalaganje ni uspelo: ' + err.message)
        } finally {
            if (!skipLoadingState) setUploading(false)
        }
    }

    const uploadMultipleReceipts = async (files: File[]) => {
        setUploading(true)
        try {
            for (const file of files) {
                await uploadNewReceipt(file, true)
            }
            fetchExpenses()
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
            alert('Nalaganje ni uspelo: ' + err.message)
        } finally {
            setUploadingReceipt(null)
        }
    }

    // --- PDF Export ---
    const downloadPDF = () => {
        const periodLabel = month === 0 ? `${year}` : `${monthsFullSI[month - 1]} ${year}`
        const processed = [...filtered]
            .filter(e => !isUnprocessed(e))
            .sort((a, b) => a.category.localeCompare(b.category) || new Date(a.date).getTime() - new Date(b.date).getTime())

        const rows = processed.map(e => {
            const net = Number(e.amount_eur) - Number(e.vat_amount || 0)
            return `
                <tr>
                    <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:11px">${formatDate(e.date)}</td>
                    <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:11px">${e.description}</td>
                    <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:11px">${e.category}</td>
                    <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:11px">${e.supplier || '-'}</td>
                    <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:11px;font-family:monospace">${e.invoice_number || '-'}</td>
                    <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:right">${formatEur(net)}</td>
                    <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:right">${formatEur(Number(e.vat_amount || 0))}</td>
                    <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:right;font-weight:bold">${formatEur(Number(e.amount_eur))}</td>
                </tr>`
        }).join('')

        const totalAmount = processed.reduce((s, e) => s + Number(e.amount_eur), 0)
        const totalVat = processed.reduce((s, e) => s + Number(e.vat_amount || 0), 0)
        const totalNet = totalAmount - totalVat

        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Stroški - ${periodLabel}</title>
        <style>@page{size:A4 landscape;margin:15mm}body{font-family:Arial,sans-serif;color:#1e293b}
        table{width:100%;border-collapse:collapse}th{background:#f1f5f9;text-align:left;padding:8px 10px;font-size:10px;text-transform:uppercase;color:#64748b;border-bottom:2px solid #cbd5e1}
        </style></head><body>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
            <div><h1 style="margin:0;font-size:20px">Pregled stroškov</h1><p style="margin:4px 0 0;color:#64748b;font-size:13px">${periodLabel} &mdash; ${processed.length} zapisov</p></div>
            <div style="text-align:right;font-size:11px;color:#64748b">Initra Energija d.o.o.<br>Generirano: ${formatDate(new Date().toISOString())}</div>
        </div>
        <table>
            <thead><tr>
                <th>Datum</th><th>Opis</th><th>Kategorija</th><th>Dobavitelj</th><th>Št. računa</th>
                <th style="text-align:right">Neto</th><th style="text-align:right">DDV</th><th style="text-align:right">Skupaj</th>
            </tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr style="font-weight:bold;background:#f8fafc">
                <td colspan="5" style="padding:8px 10px;border-top:2px solid #cbd5e1;font-size:12px">SKUPAJ</td>
                <td style="padding:8px 10px;border-top:2px solid #cbd5e1;text-align:right;font-size:12px">${formatEur(totalNet)}</td>
                <td style="padding:8px 10px;border-top:2px solid #cbd5e1;text-align:right;font-size:12px">${formatEur(totalVat)}</td>
                <td style="padding:8px 10px;border-top:2px solid #cbd5e1;text-align:right;font-size:12px">${formatEur(totalAmount)}</td>
            </tr></tfoot>
        </table>
        </body></html>`

        const w = window.open('', '_blank')
        if (w) {
            w.document.write(html)
            w.document.close()
            setTimeout(() => { w.print() }, 300)
        }
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Knjigovodstvo</h1>
                    <p className="text-slate-500 text-sm">Stroški, računi & prejeti dokumenti</p>
                </div>
                <div className="flex items-center gap-2">
                    <select value={month} onChange={e => setMonth(Number(e.target.value))}
                        className="border rounded-lg px-3 py-2 text-sm bg-white">
                        <option value={0}>Vsi meseci</option>
                        {monthsFullSI.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                    <select value={year} onChange={e => setYear(Number(e.target.value))}
                        className="border rounded-lg px-3 py-2 text-sm bg-white">
                        {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <button onClick={downloadPDF}
                        className="border border-slate-200 bg-white text-slate-700 px-3 py-2 rounded-lg text-sm font-semibold hover:bg-slate-50 transition whitespace-nowrap"
                        title="Prenesi PDF">
                        PDF
                    </button>
                </div>
            </div>

            {/* Drop zone */}
            <div
                onDragOver={e => { e.preventDefault(); setDropHover(true) }}
                onDragLeave={() => setDropHover(false)}
                onDrop={e => { e.preventDefault(); setDropHover(false); const files = Array.from(e.dataTransfer.files || []); if (files.length) uploadMultipleReceipts(files) }}
                onClick={() => {
                    if (uploading) return
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'image/*,.pdf'
                    input.multiple = true
                    input.onchange = (e: any) => { const files = Array.from(e.target.files || []) as File[]; if (files.length) uploadMultipleReceipts(files) }
                    input.click()
                }}
                className={`rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all ${
                    uploading ? 'border-blue-400 bg-blue-50' :
                    dropHover ? 'border-blue-500 bg-blue-50 scale-[1.01]' :
                    'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-white'
                }`}
            >
                {uploading ? (
                    <div className="text-sm font-semibold text-blue-600">Nalagam...</div>
                ) : (
                    <>
                        <div className="text-5xl opacity-30 mb-2">&#128206;</div>
                        <div className="text-lg font-bold text-slate-600">Spustite račun ali fakturo sem</div>
                        <div className="text-sm text-slate-400 mt-1">PDF, JPG, PNG — ali kliknite za izbiro datotek</div>
                    </>
                )}
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <div className="text-[11px] font-bold uppercase text-slate-400 mb-1">Skupaj</div>
                    <div className="text-2xl font-black text-red-600">{formatEur(summary?.totalAmount || 0)}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <div className="text-[11px] font-bold uppercase text-slate-400 mb-1">Neto</div>
                    <div className="text-2xl font-bold text-slate-700">{formatEur(summary?.totalNet || 0)}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <div className="text-[11px] font-bold uppercase text-slate-400 mb-1">Vstopni DDV</div>
                    <div className="text-2xl font-bold text-emerald-600">{formatEur(summary?.totalVat || 0)}</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <div className="text-[11px] font-bold uppercase text-slate-400 mb-1">Dokumenti</div>
                    <div className="text-2xl font-bold text-slate-700">{summary?.count || 0}</div>
                </div>
                {unprocessedCount > 0 && (
                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
                        <div className="text-[11px] font-bold uppercase text-orange-500 mb-1">Neobdelano</div>
                        <div className="text-2xl font-black text-orange-600">{unprocessedCount}</div>
                    </div>
                )}
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
                    placeholder="Iskanje..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button onClick={openNew} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-black transition whitespace-nowrap">
                    + Dodaj ročno
                </button>
            </div>

            {/* Expense cards */}
            {loading ? (
                <div className="text-center py-16 text-slate-400">Nalagam...</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                    <div className="text-4xl opacity-20 mb-2">&#128203;</div>
                    <div className="text-slate-500">Ni stroškov za {month === 0 ? year : `${monthsFullSI[month - 1]} ${year}`}</div>
                    <div className="text-sm text-slate-400 mt-1">Spustite račun zgoraj ali dodajte ročno</div>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(expense => (
                        <div key={expense.id} className={`rounded-2xl border transition group overflow-hidden flex flex-col ${
                            isUnprocessed(expense) ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-md'
                        }`}>
                            {/* Receipt thumbnail / preview */}
                            {expense.receipt_url ? (
                                <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer"
                                    className="block h-40 bg-slate-100 relative overflow-hidden border-b border-slate-100 hover:opacity-90 transition">
                                    {expense.receipt_url.includes('.pdf') || expense.notes?.includes('.pdf') ? (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-white to-slate-50">
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" className="mb-2 opacity-60">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                <polyline points="14 2 14 8 20 8" />
                                                <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" />
                                            </svg>
                                            <div className="text-[10px] font-bold text-slate-400">{expense.invoice_number || 'PDF'}</div>
                                            <div className="text-[9px] text-blue-500 mt-0.5 font-semibold">Odpri</div>
                                        </div>
                                    ) : (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img src={expense.receipt_url} alt="Račun" className="w-full h-full object-cover" />
                                    )}
                                </a>
                            ) : (
                                <label className={`block h-28 flex flex-col items-center justify-center cursor-pointer border-b transition ${
                                    isUnprocessed(expense) ? 'border-orange-100 bg-orange-50' : 'border-slate-100 bg-slate-50 hover:bg-slate-100'
                                }`}>
                                    <div className="text-3xl opacity-20 mb-1">&#128206;</div>
                                    <div className="text-[10px] font-bold text-slate-400">
                                        {uploadingReceipt === expense.id ? 'Nalagam...' : '+ Priloži račun'}
                                    </div>
                                    <input type="file" className="hidden" accept="image/*,.pdf"
                                        disabled={uploadingReceipt === expense.id}
                                        onChange={e => { const f = e.target.files?.[0]; if (f) attachReceipt(expense.id, f); e.target.value = '' }} />
                                </label>
                            )}

                            {/* Card body */}
                            <div className="p-4 flex-1 flex flex-col">
                                {/* Status + Category badges */}
                                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                                    {isUnprocessed(expense) ? (
                                        <span className="text-[10px] font-bold bg-orange-200 text-orange-800 px-2 py-0.5 rounded animate-pulse">Neobdelano</span>
                                    ) : (
                                        <>
                                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Obdelano</span>
                                            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{expense.category}</span>
                                        </>
                                    )}
                                    <span className="text-[10px] text-slate-400 ml-auto">{formatDate(expense.date)}</span>
                                </div>

                                {/* Description */}
                                {isUnprocessed(expense) ? (
                                    <div className="text-xs text-orange-500 mb-2">{expense.notes || 'Čaka na obdelavo'}</div>
                                ) : (
                                    <div className="font-semibold text-sm text-slate-800 mb-1 leading-snug">{expense.description}</div>
                                )}

                                {/* Supplier + Invoice */}
                                {!isUnprocessed(expense) && (
                                    <div className="text-xs text-slate-400 mb-3 space-y-0.5">
                                        {expense.supplier && <div>{expense.supplier}</div>}
                                        {expense.invoice_number && <div className="font-mono">#{expense.invoice_number}</div>}
                                    </div>
                                )}

                                {/* Amount block — pushed to bottom */}
                                <div className="mt-auto">
                                    {isUnprocessed(expense) ? (
                                        <div className="text-sm font-bold text-orange-400">—</div>
                                    ) : (
                                        <div className="flex items-end justify-between">
                                            <div>
                                                <div className="text-[10px] text-slate-400">Neto</div>
                                                <div className="text-sm font-bold text-slate-600">{formatEur(Number(expense.amount_eur) - Number(expense.vat_amount || 0))}</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-[10px] text-slate-400">DDV</div>
                                                <div className="text-sm font-semibold text-emerald-600">{formatEur(Number(expense.vat_amount || 0))}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] text-slate-400">Skupaj</div>
                                                <div className="text-lg font-black text-red-600">{formatEur(Number(expense.amount_eur))}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Actions footer */}
                            <div className="flex border-t border-slate-100 divide-x divide-slate-100 opacity-0 group-hover:opacity-100 transition">
                                <button onClick={() => openEdit(expense)} className="flex-1 text-xs text-blue-500 hover:text-blue-700 hover:bg-blue-50 font-bold py-2 transition">Uredi</button>
                                <button onClick={() => deleteExpense(expense.id)} className="flex-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 font-bold py-2 transition">Briši</button>
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
                            <h3 className="text-lg font-bold text-slate-800">{editing ? 'Uredi strošek' : 'Nov strošek'}</h3>
                            <button onClick={() => { setShowForm(false); setEditing(null) }} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
                        </div>

                        {editing?.receipt_url && (
                            <div className="mb-4 p-3 bg-blue-50 rounded-xl">
                                <a href={editing.receipt_url} target="_blank" rel="noopener noreferrer"
                                    className="text-sm font-bold text-blue-600 hover:underline">
                                    Odpri priložen dokument
                                </a>
                            </div>
                        )}

                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Datum *</label>
                                    <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Kategorija *</label>
                                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none">
                                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Opis *</label>
                                <input type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="npr. DPD pošiljanje marec 2026"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Neto (EUR) *</label>
                                    <input type="number" step="0.01" value={form.amount_eur} onChange={e => setForm(f => ({ ...f, amount_eur: e.target.value }))}
                                        placeholder="0.00"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">DDV (EUR)</label>
                                    <input type="number" step="0.01" value={form.vat_amount} onChange={e => setForm(f => ({ ...f, vat_amount: e.target.value }))}
                                        placeholder="0.00"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Skupaj</label>
                                    <div className="w-full px-3 py-2 border border-slate-100 rounded-lg text-sm bg-slate-100 text-slate-600 font-bold">
                                        {formatEur((Number(form.amount_eur) || 0) + (Number(form.vat_amount) || 0))}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Dobavitelj</label>
                                    <input type="text" value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
                                        placeholder="npr. DPD d.o.o."
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Št. računa</label>
                                    <input type="text" value={form.invoice_number} onChange={e => setForm(f => ({ ...f, invoice_number: e.target.value }))}
                                        placeholder="Referenca dobavitelja"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Opombe</label>
                                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                    rows={2} placeholder="Neobvezno..."
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
                            </div>
                            <button onClick={saveExpense}
                                className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-black transition">
                                {editing ? 'Shrani spremembe' : 'Dodaj strošek'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
