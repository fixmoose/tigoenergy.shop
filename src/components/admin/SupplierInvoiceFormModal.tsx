'use client'

import React, { useEffect, useState } from 'react'
import type { SupplierInvoice } from '@/types/database'

interface Props {
  initial?: SupplierInvoice | null  // null/undefined = create mode; row = edit mode
  onClose: () => void
  onSaved: () => void
}

const EMPTY = {
  supplier_name: '',
  supplier_vat_id: '',
  supplier_country: '',
  invoice_number: '',
  invoice_date: new Date().toISOString().slice(0, 10),
  due_date: '',
  currency: 'EUR',
  exchange_rate: '',
  net_amount: '',
  vat_amount: '0',
  total: '',
  category: 'goods' as 'goods' | 'service',
  pdf_url: '',
  notes: '',
}

export default function SupplierInvoiceFormModal({ initial, onClose, onSaved }: Props) {
  const isEdit = !!initial?.id
  const [form, setForm] = useState(() =>
    initial
      ? {
          supplier_name: initial.supplier_name || '',
          supplier_vat_id: initial.supplier_vat_id || '',
          supplier_country: initial.supplier_country || '',
          invoice_number: initial.invoice_number || '',
          invoice_date: initial.invoice_date || EMPTY.invoice_date,
          due_date: initial.due_date || '',
          currency: initial.currency || 'EUR',
          exchange_rate: initial.exchange_rate != null ? String(initial.exchange_rate) : '',
          net_amount: String(initial.net_amount ?? ''),
          vat_amount: String(initial.vat_amount ?? '0'),
          total: String(initial.total ?? ''),
          category: (initial.category as 'goods' | 'service') || 'goods',
          pdf_url: initial.pdf_url || '',
          notes: initial.notes || '',
        }
      : { ...EMPTY }
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  // When quantity fields change and total is empty, auto-suggest total = net + vat
  useEffect(() => {
    const n = parseFloat(form.net_amount)
    const v = parseFloat(form.vat_amount || '0')
    if (!isNaN(n) && !form.total) {
      set('total', (n + (isNaN(v) ? 0 : v)).toFixed(2))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.net_amount, form.vat_amount])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.supplier_name.trim() || !form.invoice_number.trim() || !form.invoice_date) {
      return setError('Supplier, invoice number, and invoice date are required')
    }
    if (form.currency !== 'EUR' && !form.exchange_rate) {
      return setError('Exchange rate is required for non-EUR invoices')
    }

    const payload: any = {
      supplier_name: form.supplier_name.trim(),
      supplier_vat_id: form.supplier_vat_id.trim() || null,
      supplier_country: form.supplier_country.trim().toUpperCase() || null,
      invoice_number: form.invoice_number.trim(),
      invoice_date: form.invoice_date,
      due_date: form.due_date || null,
      currency: form.currency,
      exchange_rate: form.currency === 'EUR' ? null : parseFloat(form.exchange_rate),
      net_amount: parseFloat(form.net_amount) || 0,
      vat_amount: parseFloat(form.vat_amount) || 0,
      total: parseFloat(form.total) || 0,
      category: form.category,
      pdf_url: form.pdf_url.trim() || null,
      notes: form.notes.trim() || null,
    }
    if (isEdit) payload.id = initial!.id

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/supplier-invoices', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'Save failed')
        return
      }
      onSaved()
    } catch (err: any) {
      setError(err?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">
            {isEdit ? 'Edit Supplier Invoice' : 'New Supplier Invoice'}
          </h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>

        <form onSubmit={submit} className="px-5 py-4 space-y-4 overflow-y-auto">
          {/* Supplier */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Supplier name *</label>
              <input
                type="text"
                value={form.supplier_name}
                onChange={e => set('supplier_name', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">VAT ID</label>
              <input
                type="text"
                value={form.supplier_vat_id}
                onChange={e => set('supplier_vat_id', e.target.value)}
                placeholder="e.g. NL827580186"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Country (ISO-2)</label>
              <input
                type="text"
                value={form.supplier_country}
                onChange={e => set('supplier_country', e.target.value.toUpperCase())}
                maxLength={2}
                placeholder="NL"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono uppercase"
              />
            </div>
          </div>

          {/* Invoice identity */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Invoice # *</label>
              <input
                type="text"
                value={form.invoice_number}
                onChange={e => set('invoice_number', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Invoice date *</label>
              <input
                type="date"
                value={form.invoice_date}
                onChange={e => set('invoice_date', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Due date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={e => set('due_date', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
              <select
                value={form.currency}
                onChange={e => set('currency', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option>EUR</option>
                <option>USD</option>
                <option>GBP</option>
                <option>CHF</option>
                <option>CNY</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rate→EUR</label>
              <input
                type="number"
                step="0.000001"
                value={form.exchange_rate}
                onChange={e => set('exchange_rate', e.target.value)}
                disabled={form.currency === 'EUR'}
                placeholder={form.currency === 'EUR' ? '—' : '1.0316'}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Net</label>
              <input
                type="number"
                step="0.01"
                value={form.net_amount}
                onChange={e => set('net_amount', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-right"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">VAT</label>
              <input
                type="number"
                step="0.01"
                value={form.vat_amount}
                onChange={e => set('vat_amount', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-right"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Total *</label>
              <input
                type="number"
                step="0.01"
                value={form.total}
                onChange={e => set('total', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-right"
                required
              />
            </div>
          </div>

          {/* Classification + links */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select
                value={form.category}
                onChange={e => set('category', e.target.value as 'goods' | 'service')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="goods">Goods (→ Intrastat prejem if EU)</option>
                <option value="service">Service (expense only)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">PDF URL (optional)</label>
              <input
                type="text"
                value={form.pdf_url}
                onChange={e => set('pdf_url', e.target.value)}
                placeholder="/api/storage?bucket=…"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
