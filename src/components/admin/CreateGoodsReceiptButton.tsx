'use client'

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SupplierInvoice } from '@/types/database'

interface Props {
  productId: string
  productName?: string | null
  productSku?: string | null
  onCreated?: () => void
}

export default function CreateGoodsReceiptButton({ productId, productName, productSku, onCreated }: Props) {
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setPortalEl(document.getElementById('product-header-actions'))
  }, [])

  const button = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium whitespace-nowrap"
      title="Create a goods receipt (PRBL) that adds stock and links to a supplier invoice"
    >
      + PRBL (Add Stock)
    </button>
  )

  return (
    <>
      {portalEl && createPortal(button, portalEl)}
      {open && (
        <CreateGoodsReceiptModal
          productId={productId}
          productName={productName}
          productSku={productSku}
          onClose={() => setOpen(false)}
          onCreated={() => { setOpen(false); onCreated?.() }}
        />
      )}
    </>
  )
}

function CreateGoodsReceiptModal({
  productId,
  productName,
  productSku,
  onClose,
  onCreated,
}: {
  productId: string
  productName?: string | null
  productSku?: string | null
  onClose: () => void
  onCreated: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(true)
  const [invoiceId, setInvoiceId] = useState<string>('')
  const [quantity, setQuantity] = useState<string>('')
  const [unitPrice, setUnitPrice] = useState<string>('')
  const [receiptDate, setReceiptDate] = useState(today)
  const [warehouse, setWarehouse] = useState('Šenčur skladišče Jurčič Transport')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingInvoices(true)
      try {
        // Load last 12 months of goods category EU/SI invoices — enough for common case
        const now = new Date()
        const year = now.getFullYear()
        const res = await fetch(`/api/admin/supplier-invoices?year=${year}&category=goods`)
        const data = await res.json()
        if (!cancelled && data.success) setInvoices(data.data || [])
      } catch {
        if (!cancelled) setError('Failed to load supplier invoices')
      } finally {
        if (!cancelled) setLoadingInvoices(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Auto-compute unit price when invoice or quantity changes
  const selectedInvoice = invoices.find(i => i.id === invoiceId)
  useEffect(() => {
    if (selectedInvoice && quantity && !unitPrice) {
      const qty = parseFloat(quantity)
      if (qty > 0) {
        const per = Number(selectedInvoice.net_amount_eur || 0) / qty
        if (per > 0) setUnitPrice(per.toFixed(6))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId, quantity])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const qty = parseFloat(quantity)
    const price = parseFloat(unitPrice)
    if (!qty || qty <= 0) return setError('Quantity must be > 0')
    if (!price || price <= 0) return setError('Unit price must be > 0')

    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/products/${productId}/goods-receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_invoice_id: invoiceId || null,
          quantity: qty,
          unit_price_eur: price,
          receipt_date: receiptDate,
          warehouse,
          notes: notes || null,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'Create failed')
        return
      }
      onCreated()
    } catch (err: any) {
      setError(err?.message || 'Create failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Create Goods Receipt (PRBL)</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {productSku && <span className="font-mono">{productSku}</span>} — {productName}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">
            ×
          </button>
        </div>

        <form onSubmit={submit} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Supplier Invoice</label>
            <select
              value={invoiceId}
              onChange={e => { setInvoiceId(e.target.value); setUnitPrice('') }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              disabled={loadingInvoices}
            >
              <option value="">{loadingInvoices ? 'Loading…' : '— none (enter unit price manually) —'}</option>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Quantity received</label>
              <input
                type="number"
                min="0"
                step="1"
                value={quantity}
                onChange={e => { setQuantity(e.target.value); setUnitPrice('') }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Unit price EUR</label>
              <input
                type="number"
                min="0"
                step="0.000001"
                value={unitPrice}
                onChange={e => setUnitPrice(e.target.value)}
                placeholder={selectedInvoice && quantity ? `auto: €${(Number(selectedInvoice.net_amount_eur) / parseFloat(quantity || '1')).toFixed(4)}` : ''}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}

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
              {submitting ? 'Creating…' : 'Create PRBL'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
