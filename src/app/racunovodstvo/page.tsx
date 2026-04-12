'use client'

import { useState, useEffect, useCallback } from 'react'

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

interface Invoice {
    id: string
    order_number: string
    invoice_number: string
    invoice_url: string | null
    invoice_created_at: string
    total: number
    vat_amount: number
    customer_name: string
    customer_email: string
    company_name: string | null
    status: string
    currency: string
    source?: 'shop' | 'import'
}

interface Summary {
    expenseCount: number
    expenseNet: number
    expenseVat: number
    expenseTotal: number
    invoiceCount: number
    invoiceTotal: number
    invoiceVat: number
    invoiceNet: number
}

const monthsSI = ['Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij', 'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December']

const formatDate = (d: string) => {
    const dt = new Date(d)
    return `${dt.getDate().toString().padStart(2, '0')}.${(dt.getMonth() + 1).toString().padStart(2, '0')}.${dt.getFullYear()}`
}

const formatEur = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)

export default function RacunovodstvoPage() {
    const [key, setKey] = useState('')
    const [authenticated, setAuthenticated] = useState(false)
    const [passwordInput, setPasswordInput] = useState('')
    const [error, setError] = useState('')

    const [year, setYear] = useState(new Date().getFullYear())
    const [month, setMonth] = useState(new Date().getMonth() + 1)
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [invoices, setInvoices] = useState<Invoice[]>([])
    const [summary, setSummary] = useState<Summary | null>(null)
    const [loading, setLoading] = useState(false)
    const [tab, setTab] = useState<'expenses' | 'invoices'>('expenses')
    const [uploadDragOver, setUploadDragOver] = useState(false)
    const [uploadStatus, setUploadStatus] = useState<string[]>([])

    // Check URL param or sessionStorage on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const urlKey = params.get('key')
        const storedKey = sessionStorage.getItem('racunovodstvo_key')
        if (urlKey) {
            setKey(urlKey)
            setAuthenticated(true)
            sessionStorage.setItem('racunovodstvo_key', urlKey)
        } else if (storedKey) {
            setKey(storedKey)
            setAuthenticated(true)
        }
    }, [])

    const handleLogin = () => {
        if (passwordInput) {
            setKey(passwordInput)
            setAuthenticated(true)
            sessionStorage.setItem('racunovodstvo_key', passwordInput)
            setError('')
        }
    }

    const fetchData = useCallback(async () => {
        if (!key) return
        setLoading(true)
        try {
            const res = await fetch(`/api/racunovodstvo?key=${key}&year=${year}&month=${month}`)
            const data = await res.json()
            if (data.success) {
                setExpenses(data.data.expenses)
                setInvoices(data.data.invoices)
                setSummary(data.data.summary)
                setError('')
            } else {
                setError('Napačno geslo')
                setAuthenticated(false)
                sessionStorage.removeItem('racunovodstvo_key')
            }
        } catch {
            setError('Napaka pri povezavi')
        } finally {
            setLoading(false)
        }
    }, [key, year, month])

    useEffect(() => {
        if (authenticated && key) fetchData()
    }, [authenticated, key, fetchData])

    const storageUrl = (url: string) => {
        if (!url) return url
        const separator = url.includes('?') ? '&' : '?'
        return `${url}${separator}accountant_key=${key}`
    }

    const invoiceDownloadUrl = (orderId: string) => `/api/orders/${orderId}/invoice?download=1&accountant_key=${key}`

    // --- Login screen ---
    if (!authenticated) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 w-full max-w-sm">
                    <div className="text-center mb-6">
                        <h1 className="text-xl font-bold text-slate-800">Initra Energija d.o.o.</h1>
                        <p className="text-sm text-slate-500 mt-1">Portal za knjigovodstvo</p>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Geslo</label>
                            <input
                                type="password"
                                value={passwordInput}
                                onChange={e => setPasswordInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                                placeholder="Vnesite geslo"
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                                autoFocus
                            />
                        </div>
                        {error && <div className="text-sm text-red-500 text-center">{error}</div>}
                        <button onClick={handleLogin}
                            className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-black transition">
                            Vstop
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // --- Main portal ---
    const periodLabel = `${monthsSI[month - 1]} ${year}`

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Initra Energija d.o.o.</h1>
                        <p className="text-slate-500 text-sm">Knjigovodstvo &mdash; {periodLabel}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <select value={month} onChange={e => setMonth(Number(e.target.value))}
                            className="border rounded-lg px-3 py-2 text-sm bg-white">
                            {monthsSI.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                        </select>
                        <select value={year} onChange={e => setYear(Number(e.target.value))}
                            className="border rounded-lg px-3 py-2 text-sm bg-white">
                            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <a
                            href={`/api/racunovodstvo/download?key=${key}&year=${year}&month=${month}`}
                            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold hover:bg-black transition flex items-center gap-2"
                            title="Prenesi vse račune in priloge za izbrani mesec"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" /></svg>
                            Prenesi PDF
                        </a>
                    </div>
                </div>

                {/* Summary cards */}
                {summary && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                            <div className="text-[11px] font-bold uppercase text-slate-400 mb-1">Izdani računi</div>
                            <div className="text-2xl font-black text-emerald-600">{formatEur(summary.invoiceTotal)}</div>
                            <div className="text-xs text-slate-400 mt-1">{summary.invoiceCount} računov</div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                            <div className="text-[11px] font-bold uppercase text-slate-400 mb-1">Izhodni DDV</div>
                            <div className="text-2xl font-bold text-emerald-600">{formatEur(summary.invoiceVat)}</div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                            <div className="text-[11px] font-bold uppercase text-slate-400 mb-1">Stroški</div>
                            <div className="text-2xl font-black text-red-600">{formatEur(summary.expenseTotal)}</div>
                            <div className="text-xs text-slate-400 mt-1">{summary.expenseCount} zapisov</div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                            <div className="text-[11px] font-bold uppercase text-slate-400 mb-1">Vstopni DDV</div>
                            <div className="text-2xl font-bold text-blue-600">{formatEur(summary.expenseVat)}</div>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                    <button onClick={() => setTab('invoices')}
                        className={`px-5 py-2 rounded-lg text-sm font-bold transition ${tab === 'invoices' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        Izdani računi ({invoices.length})
                    </button>
                    <button onClick={() => setTab('expenses')}
                        className={`px-5 py-2 rounded-lg text-sm font-bold transition ${tab === 'expenses' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        Prejeti računi / Stroški ({expenses.length})
                    </button>
                </div>

                {loading ? (
                    <div className="text-center py-16 text-slate-400">Nalagam...</div>
                ) : tab === 'invoices' ? (
                    /* --- Issued Invoices --- */
                    invoices.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                            <div className="text-slate-500">Ni izdanih računov za {periodLabel}</div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-slate-400">Datum</th>
                                        <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-slate-400">Št. računa</th>
                                        <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-slate-400">Kupec</th>
                                        <th className="text-right px-4 py-3 text-[10px] font-bold uppercase text-slate-400">Neto</th>
                                        <th className="text-right px-4 py-3 text-[10px] font-bold uppercase text-slate-400">DDV</th>
                                        <th className="text-right px-4 py-3 text-[10px] font-bold uppercase text-slate-400">Skupaj</th>
                                        <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400 w-20"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map(inv => (
                                        <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                                            <td className="px-4 py-3 text-slate-600">{formatDate(inv.invoice_created_at)}</td>
                                            <td className="px-4 py-3 font-mono font-bold text-slate-800">{inv.invoice_number}</td>
                                            <td className="px-4 py-3">
                                                <div className="font-semibold text-slate-700">{inv.company_name || inv.customer_name}</div>
                                                {inv.company_name && <div className="text-xs text-slate-400">{inv.customer_name}</div>}
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-600">{formatEur(Number(inv.total) - Number(inv.vat_amount || 0))}</td>
                                            <td className="px-4 py-3 text-right text-slate-600">{formatEur(Number(inv.vat_amount || 0))}</td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-800">{formatEur(Number(inv.total))}</td>
                                            <td className="px-4 py-3 text-center">
                                                {inv.source === 'import' && inv.invoice_url ? (
                                                    <a href={storageUrl(inv.invoice_url)} target="_blank" rel="noopener noreferrer"
                                                        className="text-blue-500 hover:text-blue-700 font-bold text-xs">
                                                        PDF
                                                    </a>
                                                ) : (
                                                    <a href={invoiceDownloadUrl(inv.id)} target="_blank" rel="noopener noreferrer"
                                                        className="text-blue-500 hover:text-blue-700 font-bold text-xs">
                                                        PDF
                                                    </a>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-50 font-bold">
                                        <td colSpan={3} className="px-4 py-3 text-slate-600">SKUPAJ</td>
                                        <td className="px-4 py-3 text-right text-slate-600">{formatEur((summary?.invoiceNet) || 0)}</td>
                                        <td className="px-4 py-3 text-right text-slate-600">{formatEur((summary?.invoiceVat) || 0)}</td>
                                        <td className="px-4 py-3 text-right text-slate-800">{formatEur((summary?.invoiceTotal) || 0)}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )
                ) : (
                    /* --- Expenses --- */
                    expenses.length === 0 ? (
                        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                            <div className="text-slate-500">Ni stroškov za {periodLabel}</div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-slate-400">Datum</th>
                                        <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-slate-400">Opis</th>
                                        <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-slate-400">Dobavitelj</th>
                                        <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-slate-400">Št. računa</th>
                                        <th className="text-left px-4 py-3 text-[10px] font-bold uppercase text-slate-400">Kategorija</th>
                                        <th className="text-right px-4 py-3 text-[10px] font-bold uppercase text-slate-400">Neto</th>
                                        <th className="text-right px-4 py-3 text-[10px] font-bold uppercase text-slate-400">DDV</th>
                                        <th className="text-right px-4 py-3 text-[10px] font-bold uppercase text-slate-400">Skupaj</th>
                                        <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400 w-20"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {expenses.map(e => (
                                        <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(e.date)}</td>
                                            <td className="px-4 py-3 font-semibold text-slate-800">{e.description}</td>
                                            <td className="px-4 py-3 text-slate-600">{e.supplier || '-'}</td>
                                            <td className="px-4 py-3 font-mono text-slate-600 text-xs">{e.invoice_number || '-'}</td>
                                            <td className="px-4 py-3">
                                                <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{e.category}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-600">{formatEur(Number(e.amount_eur) - Number(e.vat_amount || 0))}</td>
                                            <td className="px-4 py-3 text-right text-slate-600">{formatEur(Number(e.vat_amount || 0))}</td>
                                            <td className="px-4 py-3 text-right font-bold text-slate-800">{formatEur(Number(e.amount_eur))}</td>
                                            <td className="px-4 py-3 text-center">
                                                {e.receipt_url ? (
                                                    <a href={storageUrl(e.receipt_url)} target="_blank" rel="noopener noreferrer"
                                                        className="text-blue-500 hover:text-blue-700 font-bold text-xs">
                                                        PDF
                                                    </a>
                                                ) : (
                                                    <span className="text-slate-300 text-xs">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-50 font-bold">
                                        <td colSpan={5} className="px-4 py-3 text-slate-600">SKUPAJ</td>
                                        <td className="px-4 py-3 text-right text-slate-600">{formatEur((summary?.expenseNet) || 0)}</td>
                                        <td className="px-4 py-3 text-right text-slate-600">{formatEur((summary?.expenseVat) || 0)}</td>
                                        <td className="px-4 py-3 text-right text-slate-800">{formatEur((summary?.expenseTotal) || 0)}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )
                )}

                {/* Document Upload Zone */}
                <div
                    className={`border-2 border-dashed rounded-2xl p-8 text-center transition ${
                        uploadDragOver
                            ? 'border-blue-400 bg-blue-50'
                            : 'border-slate-300 bg-white hover:border-slate-400'
                    }`}
                    onDragOver={e => { e.preventDefault(); setUploadDragOver(true) }}
                    onDragLeave={() => setUploadDragOver(false)}
                    onDrop={async e => {
                        e.preventDefault()
                        setUploadDragOver(false)
                        const files = Array.from(e.dataTransfer.files)
                        if (files.length === 0) return
                        const statuses: string[] = []
                        for (const file of files) {
                            statuses.push(`Nalagam ${file.name}…`)
                            setUploadStatus([...statuses])
                            const fd = new FormData()
                            fd.append('file', file)
                            try {
                                const res = await fetch(`/api/racunovodstvo/upload?key=${key}`, { method: 'POST', body: fd })
                                const data = await res.json()
                                statuses[statuses.length - 1] = data.success
                                    ? `✓ ${file.name} — naloženo`
                                    : `✗ ${file.name} — ${data.error || 'napaka'}`
                            } catch {
                                statuses[statuses.length - 1] = `✗ ${file.name} — napaka`
                            }
                            setUploadStatus([...statuses])
                        }
                        setTimeout(() => setUploadStatus([]), 8000)
                    }}
                >
                    <input
                        type="file"
                        id="accountant-upload"
                        multiple
                        className="hidden"
                        onChange={async e => {
                            const files = Array.from(e.target.files || [])
                            if (files.length === 0) return
                            const statuses: string[] = []
                            for (const file of files) {
                                statuses.push(`Nalagam ${file.name}…`)
                                setUploadStatus([...statuses])
                                const fd = new FormData()
                                fd.append('file', file)
                                try {
                                    const res = await fetch(`/api/racunovodstvo/upload?key=${key}`, { method: 'POST', body: fd })
                                    const data = await res.json()
                                    statuses[statuses.length - 1] = data.success
                                        ? `✓ ${file.name} — naloženo`
                                        : `✗ ${file.name} — ${data.error || 'napaka'}`
                                } catch {
                                    statuses[statuses.length - 1] = `✗ ${file.name} — napaka`
                                }
                                setUploadStatus([...statuses])
                            }
                            e.target.value = ''
                            setTimeout(() => setUploadStatus([]), 8000)
                        }}
                    />
                    <div className="text-slate-500 mb-2">
                        <svg className="w-10 h-10 mx-auto text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                    </div>
                    <p className="text-sm font-medium text-slate-700">
                        Povlecite dokumente sem ali{' '}
                        <label htmlFor="accountant-upload" className="text-blue-600 hover:underline cursor-pointer font-bold">
                            izberite datoteke
                        </label>
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Računi, potrdila, dokumenti — PDF, slike, Excel</p>
                    {uploadStatus.length > 0 && (
                        <div className="mt-4 text-left max-w-md mx-auto space-y-1">
                            {uploadStatus.map((s, i) => (
                                <div key={i} className={`text-xs ${s.startsWith('✓') ? 'text-green-600' : s.startsWith('✗') ? 'text-red-600' : 'text-slate-500'}`}>
                                    {s}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="text-center text-xs text-slate-400 py-4">
                    Initra Energija d.o.o. &bull; Podsmreka 59A, 1356 Dobrova &bull; SI62518313
                </div>
            </div>
        </div>
    )
}
