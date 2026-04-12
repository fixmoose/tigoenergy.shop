'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { SupplierInvoice } from '@/types/database'

interface ProductRow {
  id: string
  sku: string
  name_en: string
  cn_code?: string | null
  weight_kg?: number | null
  country_of_origin?: string | null
  stock_quantity?: number | null
}

interface Line {
  product_id: string
  quantity: string   // string for controlled input; converted on submit
  unit_price_eur: string
}

const BLANK_LINE: Line = { product_id: '', quantity: '', unit_price_eur: '' }

export default function NewGoodsReceiptPage() {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)

  const [products, setProducts] = useState<ProductRow[]>([])
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([])
  const [loadingLookups, setLoadingLookups] = useState(true)

  const [supplierInvoiceId, setSupplierInvoiceId] = useState('')
  const [receiptDate, setReceiptDate] = useState(today)
  const [warehouse, setWarehouse] = useState('Šenčur skladišče Jurčič Transport')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([{ ...BLANK_LINE }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [productQuery, setProductQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const supabase = createClient()
      const [{ data: prods }, invRes] = await Promise.all([
        supabase
          .from('products')
          .select('id, sku, name_en, cn_code, weight_kg, country_of_origin, stock_quantity')
          .order('name_en'),
        fetch(`/api/admin/supplier-invoices?year=${new Date().getFullYear()}&category=goods`),
      ])
      const invJson = await invRes.json()
      if (!cancelled) {
        setProducts((prods || []) as ProductRow[])
        setInvoices(invJson.success ? (invJson.data || []) : [])
        setLoadingLookups(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const selectedInvoice = invoices.find(i => i.id === supplierInvoiceId)
  const filteredProducts = productQuery
    ? products.filter(p =>
        (p.sku || '').toLowerCase().includes(productQuery.toLowerCase()) ||
        (p.name_en || '').toLowerCase().includes(productQuery.toLowerCase())
      )
    : products

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines(ls => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  function addLine() {
    setLines(ls => [...ls, { ...BLANK_LINE }])
  }

  function removeLine(idx: number) {
    setLines(ls => (ls.length === 1 ? ls : ls.filter((_, i) => i !== idx)))
  }

  const totalEur = lines.reduce((s, l) => {
    const q = parseFloat(l.quantity) || 0
    const p = parseFloat(l.unit_price_eur) || 0
    return s + q * p
  }, 0)

  const totalMass = lines.reduce((s, l) => {
    const q = parseFloat(l.quantity) || 0
    const prod = products.find(p => p.id === l.product_id)
    const w = prod?.weight_kg || 0
    return s + q * w
  }, 0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const validLines = lines.filter(l => l.product_id && parseFloat(l.quantity) > 0 && parseFloat(l.unit_price_eur) > 0)
    if (validLines.length === 0) {
      return setError('Add at least one line with product, quantity, and unit price.')
    }

    const payload = {
      supplier_invoice_id: supplierInvoiceId || null,
      receipt_date: receiptDate,
      warehouse,
      notes: notes || null,
      lines: validLines.map(l => ({
        product_id: l.product_id,
        quantity: parseFloat(l.quantity),
        unit_price_eur: parseFloat(l.unit_price_eur),
      })),
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/goods-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'Create failed')
        return
      }
      router.push('/admin/supplier-invoices')
    } catch (err: any) {
      setError(err?.message || 'Create failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">New Goods Receipt (PRBL)</h1>
          <p className="text-slate-500 mt-1">
            Multi-item stock-in for physical arrivals from a supplier. Inherits CN / weight / origin from the product catalog.
          </p>
        </div>
        <Link
          href="/admin/supplier-invoices"
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          ← Back
        </Link>
      </div>

      <form onSubmit={submit} className="space-y-6">
        {/* Header fields */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Receipt details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Supplier Invoice (optional)</label>
              <select
                value={supplierInvoiceId}
                onChange={e => setSupplierInvoiceId(e.target.value)}
                disabled={loadingLookups}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="">{loadingLookups ? 'Loading…' : '— none (manual arrival) —'}</option>
                {invoices.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_date} — {inv.supplier_name} #{inv.invoice_number} ({inv.supplier_country || '—'}) — €{Number(inv.total_eur).toFixed(2)}
                  </option>
                ))}
              </select>
              {selectedInvoice && (
                <p className="text-xs text-slate-500 mt-1">
                  {selectedInvoice.region} · {selectedInvoice.category} · net €{Number(selectedInvoice.net_amount_eur).toFixed(2)}
                  {selectedInvoice.currency !== 'EUR' && (
                    <> · {selectedInvoice.currency} {Number(selectedInvoice.net_amount).toFixed(2)} @ rate {selectedInvoice.exchange_rate}</>
                  )}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Receipt date (physical arrival)</label>
              <input
                type="date"
                value={receiptDate}
                onChange={e => setReceiptDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Warehouse</label>
              <input
                type="text"
                value={warehouse}
                onChange={e => setWarehouse(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        {/* Lines */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Line items</h2>
            <input
              type="text"
              value={productQuery}
              onChange={e => setProductQuery(e.target.value)}
              placeholder="Filter product dropdowns…"
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs w-64"
            />
          </div>

          <div className="space-y-3">
            {lines.map((line, idx) => {
              const product = products.find(p => p.id === line.product_id)
              const invEur = selectedInvoice ? Number(selectedInvoice.net_amount_eur || 0) : 0
              const autoPrice = invEur && parseFloat(line.quantity) > 0
                ? (invEur / parseFloat(line.quantity)).toFixed(4)
                : ''
              return (
                <div key={idx} className="grid grid-cols-12 gap-3 items-start bg-slate-50 rounded-lg p-3">
                  <div className="col-span-5">
                    {idx === 0 && <label className="block text-xs font-medium text-slate-500 mb-1">Product</label>}
                    <select
                      value={line.product_id}
                      onChange={e => updateLine(idx, { product_id: e.target.value, unit_price_eur: '' })}
                      disabled={loadingLookups}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      required
                    >
                      <option value="">— pick product —</option>
                      {filteredProducts.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.sku} · {p.name_en}
                        </option>
                      ))}
                    </select>
                    {product && (
                      <p className="text-[10px] text-slate-500 mt-1 font-mono">
                        CN {product.cn_code || '—'} · {product.weight_kg || '—'} kg · {product.country_of_origin || '—'} · stock {product.stock_quantity ?? 0}
                      </p>
                    )}
                  </div>
                  <div className="col-span-2">
                    {idx === 0 && <label className="block text-xs font-medium text-slate-500 mb-1">Quantity</label>}
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={line.quantity}
                      onChange={e => updateLine(idx, { quantity: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-right"
                      required
                    />
                  </div>
                  <div className="col-span-3">
                    {idx === 0 && <label className="block text-xs font-medium text-slate-500 mb-1">Unit price EUR</label>}
                    <input
                      type="number"
                      min="0"
                      step="0.000001"
                      value={line.unit_price_eur}
                      onChange={e => updateLine(idx, { unit_price_eur: e.target.value })}
                      placeholder={autoPrice ? `auto: ${autoPrice}` : ''}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-right"
                      required
                    />
                  </div>
                  <div className="col-span-1">
                    {idx === 0 && <label className="block text-xs font-medium text-slate-500 mb-1">Line €</label>}
                    <div className="px-3 py-2 text-sm text-slate-700 text-right">
                      {(() => {
                        const q = parseFloat(line.quantity) || 0
                        const p = parseFloat(line.unit_price_eur) || 0
                        return q * p > 0 ? (q * p).toFixed(2) : '—'
                      })()}
                    </div>
                  </div>
                  <div className="col-span-1 flex items-center justify-end pt-5">
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      disabled={lines.length === 1}
                      className="text-red-600 hover:text-red-800 disabled:text-slate-300 text-lg leading-none"
                      title="Remove line"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <button
            type="button"
            onClick={addLine}
            className="mt-4 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50"
          >
            + Add line
          </button>

          <div className="mt-4 flex justify-end gap-6 text-sm text-slate-600">
            <div>
              <span className="text-slate-400">Mass:</span>{' '}
              <span className="font-medium text-slate-800">{totalMass.toFixed(2)} kg</span>
            </div>
            <div>
              <span className="text-slate-400">Total:</span>{' '}
              <span className="font-medium text-slate-800">€{totalEur.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        <div className="flex gap-3">
          <Link
            href="/admin/supplier-invoices"
            className="flex-1 py-2 border border-slate-300 rounded-lg text-slate-700 text-center hover:bg-slate-50 font-medium"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create PRBL'}
          </button>
        </div>
      </form>
    </div>
  )
}
