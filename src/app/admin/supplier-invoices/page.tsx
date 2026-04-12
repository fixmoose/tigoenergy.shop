'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import type { SupplierInvoice } from '@/types/database'
import SupplierInvoiceFormModal from '@/components/admin/SupplierInvoiceFormModal'

function formatCurrency(amount: number, currency = 'EUR') {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(amount)
}

const REGION_BADGE: Record<string, string> = {
  EU: 'bg-blue-100 text-blue-700',
  SI: 'bg-slate-100 text-slate-700',
  outside_EU: 'bg-amber-100 text-amber-700',
}

const CATEGORY_BADGE: Record<string, string> = {
  goods: 'bg-green-100 text-green-700',
  service: 'bg-purple-100 text-purple-700',
}

export default function SupplierInvoicesPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState<number | 'all'>('all')
  const [regionFilter, setRegionFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [rows, setRows] = useState<SupplierInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [modalInvoice, setModalInvoice] = useState<SupplierInvoice | null | undefined>(undefined)
  // undefined = modal closed; null = create; row = edit

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ year: String(year) })
    if (month !== 'all') params.set('month', String(month))
    if (regionFilter) params.set('region', regionFilter)
    if (categoryFilter) params.set('category', categoryFilter)
    try {
      const res = await fetch(`/api/admin/supplier-invoices?${params.toString()}`)
      const data = await res.json()
      if (data.success) setRows(data.data || [])
      else setError(data.error || 'Failed to load')
    } catch {
      setError('Failed to load')
    } finally {
      setLoading(false)
    }
  }, [year, month, regionFilter, categoryFilter])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  async function togglePaid(inv: SupplierInvoice) {
    const next = !inv.paid
    try {
      const res = await fetch('/api/admin/supplier-invoices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: inv.id, paid: next, paid_at: next ? new Date().toISOString() : null }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.error || 'Update failed'); return }
      fetchRows()
    } catch {
      setError('Update failed')
    }
  }

  async function deleteInvoice(inv: SupplierInvoice) {
    if (!confirm(`Delete supplier invoice ${inv.supplier_name} #${inv.invoice_number}?`)) return
    try {
      const res = await fetch(`/api/admin/supplier-invoices?id=${inv.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!data.ok) { setError(data.error || 'Delete failed'); return }
      fetchRows()
    } catch {
      setError('Delete failed')
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      r.supplier_name.toLowerCase().includes(q) ||
      r.invoice_number.toLowerCase().includes(q) ||
      (r.supplier_vat_id || '').toLowerCase().includes(q)
    )
  }, [rows, search])

  const summary = useMemo(() => {
    const total = filtered.reduce((s, r) => s + Number(r.total_eur || 0), 0)
    const goodsEU = filtered
      .filter(r => r.category === 'goods' && r.region === 'EU')
      .reduce((s, r) => s + Number(r.total_eur || 0), 0)
    const goodsSI = filtered
      .filter(r => r.category === 'goods' && r.region === 'SI')
      .reduce((s, r) => s + Number(r.total_eur || 0), 0)
    const services = filtered
      .filter(r => r.category === 'service')
      .reduce((s, r) => s + Number(r.total_eur || 0), 0)
    return { total, goodsEU, goodsSI, services, count: filtered.length }
  }, [filtered])

  const months = [
    { value: 'all' as const, label: 'Whole year' },
    ...Array.from({ length: 12 }, (_, i) => ({
      value: (i + 1) as number,
      label: new Date(2026, i).toLocaleString('en', { month: 'long' }),
    })),
  ]
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Supplier Invoices (prejeti računi)</h1>
          <p className="text-slate-500 mt-1">Received invoices from suppliers — accounts payable + source for PRBL / Intrastat arrivals.</p>
        </div>
        <button
          type="button"
          onClick={() => setModalInvoice(null)}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium"
        >
          + New Supplier Invoice
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Year</label>
            <select
              value={year}
              onChange={e => setYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-lg"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Month</label>
            <select
              value={month}
              onChange={e => setMonth(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
              className="px-3 py-2 border border-slate-300 rounded-lg"
            >
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Region</label>
            <select
              value={regionFilter}
              onChange={e => setRegionFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg"
            >
              <option value="">All</option>
              <option value="EU">EU</option>
              <option value="SI">SI (domestic)</option>
              <option value="outside_EU">Outside EU</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg"
            >
              <option value="">All</option>
              <option value="goods">Goods</option>
              <option value="service">Service</option>
            </select>
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="block text-sm font-medium text-slate-600 mb-1">Search</label>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Supplier, invoice #, or VAT"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Invoices</p>
          <p className="text-2xl font-bold text-slate-800">{summary.count}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Total (€)</p>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(summary.total)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">EU Goods (→ Intrastat prejem)</p>
          <p className="text-2xl font-bold text-blue-700">{formatCurrency(summary.goodsEU)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Services</p>
          <p className="text-2xl font-bold text-purple-700">{formatCurrency(summary.services)}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No supplier invoices for this period</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-[11px] font-bold uppercase text-slate-500 tracking-wide">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3 text-center">Category</th>
                <th className="px-4 py-3 text-center">Region</th>
                <th className="px-4 py-3 text-right">Native</th>
                <th className="px-4 py-3 text-right">EUR</th>
                <th className="px-4 py-3 text-center">Paid</th>
                <th className="px-4 py-3 text-center">PDF</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-4 py-3 text-sm text-slate-700">{r.invoice_date}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium text-slate-800">{r.supplier_name}</div>
                    {r.supplier_vat_id && (
                      <div className="text-xs text-slate-500 font-mono">{r.supplier_vat_id}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{r.supplier_country || '-'}</td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-800">{r.invoice_number}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${CATEGORY_BADGE[r.category] || 'bg-slate-100 text-slate-700'}`}>
                      {r.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${REGION_BADGE[r.region || ''] || 'bg-slate-100 text-slate-700'}`}>
                      {r.region || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-slate-600">
                    {r.currency !== 'EUR' ? formatCurrency(Number(r.total), r.currency) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium text-slate-800">
                    {formatCurrency(Number(r.total_eur))}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => togglePaid(r)}
                      className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase transition ${
                        r.paid ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                      title={r.paid ? `Paid ${r.paid_at?.slice(0,10) || ''}` : 'Mark as paid'}
                    >
                      {r.paid ? 'Paid' : 'Unpaid'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.pdf_url ? (
                      <a
                        href={r.pdf_url.startsWith('/api/') ? r.pdf_url : `/api/storage?bucket=invoices&path=${encodeURIComponent(r.pdf_url)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline text-xs"
                      >
                        View
                      </a>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setModalInvoice(r)}
                      className="text-blue-600 hover:underline text-xs mr-2"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteInvoice(r)}
                      className="text-red-600 hover:underline text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200">
              <tr className="font-semibold text-sm">
                <td className="px-4 py-3 text-slate-700" colSpan={7}>Total ({filtered.length})</td>
                <td className="px-4 py-3 text-right text-slate-800">{formatCurrency(summary.total)}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {modalInvoice !== undefined && (
        <SupplierInvoiceFormModal
          initial={modalInvoice}
          onClose={() => setModalInvoice(undefined)}
          onSaved={() => { setModalInvoice(undefined); fetchRows() }}
        />
      )}
    </div>
  )
}
