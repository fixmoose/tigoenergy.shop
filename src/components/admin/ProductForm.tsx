'use client'
import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Product } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import RichTextEditor from './RichTextEditor'

export default function ProductForm({ initial, onSaved }: { initial?: Partial<Product>; onSaved?: (p: Product) => void }) {
  const [product, setProduct] = useState<Partial<Product>>(initial ?? {})
  const [saving, setSaving] = useState(false)
  const [salesHistory, setSalesHistory] = useState<any[]>([])
  const [salesHistoryLoading, setSalesHistoryLoading] = useState(false)
  const [reportedPeriods, setReportedPeriods] = useState<{ year: number; month: number }[]>([])
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [allProducts, setAllProducts] = useState<Array<Pick<Product, 'id' | 'name_en' | 'sku' | 'images'>>>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [categories, setCategories] = useState<{ id: string, name: string, parent_id: string | null }[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!product.id) return
    const fetchHistory = async () => {
      setSalesHistoryLoading(true)
      try {
        const { data, error } = await supabase
          .from('order_items')
          .select(`
            *,
            orders (
                order_number,
                customer_email,
                company_name,
                created_at
            )
          `)
          .eq('product_id', product.id)
          .order('created_at', { ascending: false })
          .limit(20)

        if (!error && data) setSalesHistory(data)
      } catch (err) {
        console.error('Failed to fetch sales history', err)
      } finally {
        setSalesHistoryLoading(false)
      }
    }
    fetchHistory()
  }, [product.id])

  useEffect(() => {
    const fetchReportedPeriods = async () => {
      const { data, error } = await supabase.from('intrastat_reports').select('year, month')
      if (!error && data) setReportedPeriods(data)
    }
    fetchReportedPeriods()
  }, [])

  useEffect(() => {
    supabase.from('categories').select('id, name, parent_id').then(({ data }) => {
      if (data) setCategories(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    async function fetchProducts() {
      const { data } = await supabase
        .from('products')
        .select('id, name_en, sku, images')
        .order('name_en', { ascending: true })
      if (data) setAllProducts(data)
    }
    fetchProducts()
  }, [])

  function setField<K extends keyof Product>(k: K, v: any) {
    setProduct((p) => ({ ...(p ?? {}), [k]: v }))
  }

  function toggleRelatedProduct(productId: string) {
    const current = product.related_products ?? []
    const updated = current.includes(productId)
      ? current.filter(id => id !== productId)
      : [...current, productId]
    setField('related_products', updated)
  }

  async function uploadFiles(): Promise<string[]> {
    if (!files.length) return []
    setUploading(true)
    const uploaded: string[] = []
    for (const file of files) {
      const path = `product-images/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const res = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
      if (res.error) continue
      const url = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
      uploaded.push(url)
    }
    setUploading(false)
    setFiles([])
    return uploaded
  }

  const isIntrastatLocked = (invoiceDate: string) => {
    const date = new Date(invoiceDate)
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    return reportedPeriods.some(p => p.year === year && p.month === month)
  }

  const updateStockAndInvoices = (invoices: any[]) => {
    let totalStock = 0
    let totalValue = 0
    invoices.forEach(inv => {
      totalStock += Number(inv.quantity) || 0
      totalValue += (Number(inv.quantity) || 0) * (Number(inv.unit_cost_gross) || 0)
    })
    const newAvgCost = totalStock > 0 ? (totalValue / totalStock) : (product.cost_eur || 0)
    setField('supplier_invoices', invoices)
    setField('stock_quantity', totalStock)
    setField('cost_eur', Number(newAvgCost.toFixed(4)))
  }

  async function save() {
    setSaving(true)
    try {
      const imageUrls = await uploadFiles()
      const payload: any = { ...product }
      if (imageUrls && imageUrls.length) payload.images = [...(payload.images ?? []), ...imageUrls]
      const method = product.id ? 'PUT' : 'POST'
      const res = await fetch('/api/admin/products', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      setSaving(false)
      if (res.ok) onSaved?.(data.product)
      else alert(`Error: ${data.error}`)
    } catch (err) {
      setSaving(false)
      alert('Save failed')
    }
  }

  async function handleDelete() {
    if (!product.id || !product.name_en) return
    if (!confirm(`Are you sure you want to delete "${product.name_en}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/products?id=${product.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        alert(`Error: ${data.error}`)
        setDeleting(false)
        return
      }
      window.location.href = '/admin/products'
    } catch (err) {
      alert('Delete failed')
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Identity */}
        <div className="bg-white p-5 rounded-xl border shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-800 border-b pb-2 text-sm uppercase tracking-wide">Identity</h3>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Product Name</label>
            <input value={product.name_en ?? ''} onChange={(e) => setField('name_en', e.target.value)} className="border rounded w-full px-3 py-2 text-sm font-medium" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">SKU</label>
              <input value={product.sku ?? ''} onChange={(e) => setField('sku', e.target.value)} className="border rounded w-full px-2 py-1 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Slug</label>
              <input value={product.slug ?? ''} onChange={(e) => setField('slug', e.target.value)} className="border rounded w-full px-2 py-1 text-xs text-gray-500 bg-gray-50" />
            </div>
          </div>
          <div className="flex items-center gap-4 bg-gray-50 p-2 rounded border">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={product.active ?? false} onChange={(e) => setField('active', e.target.checked)} className="w-4 h-4 text-green-600" />
              <label className="text-xs font-semibold">Active</label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={product.featured ?? false} onChange={(e) => setField('featured', e.target.checked)} className="w-4 h-4 text-orange-500" />
              <label className="text-xs font-semibold">Featured</label>
            </div>
          </div>
        </div>

        {/* Card 2: Categorization */}
        <div className="bg-white p-5 rounded-xl border shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-800 border-b pb-2 text-sm uppercase tracking-wide">Categorization</h3>
          <div className="space-y-3">
            <select value={product.category ?? ''} onChange={(e) => setField('category', e.target.value)} className="border rounded w-full px-2 py-2 text-sm">
              <option value="">Category...</option>
              {categories.filter(c => !c.parent_id).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <select value={product.subcategory ?? ''} onChange={(e) => setField('subcategory', e.target.value)} className="border rounded w-full px-2 py-2 text-sm">
              <option value="">Subcategory...</option>
              {categories.filter(c => c.parent_id === categories.find(cat => cat.name === product.category)?.id).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {/* Card 3: Pricing */}
        <div className="bg-white p-5 rounded-xl border shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-800 border-b pb-2 text-sm uppercase tracking-wide">Pricing</h3>
          <div className="flex justify-between items-center text-xs">
            <span>Avg Cost:</span>
            <span className="font-mono">€{Number(product.cost_eur || 0).toFixed(2)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold">B2C €</label>
              <input type="number" step="0.01" value={product.price_eur ?? ''} onChange={(e) => setField('price_eur', Number(e.target.value))} className="border rounded w-full px-2 py-1 text-sm font-semibold" />
            </div>
            <div>
              <label className="text-[10px] font-bold">B2B €</label>
              <input type="number" step="0.01" value={product.b2b_price_eur ?? ''} onChange={(e) => setField('b2b_price_eur', Number(e.target.value))} className="border rounded w-full px-2 py-1 text-sm" />
            </div>
          </div>
        </div>

        {/* Card 4: Stock */}
        <div className="bg-white p-5 rounded-xl border shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-800 border-b pb-2 text-sm uppercase tracking-wide">Stock</h3>
          <div className="text-center py-2 bg-gray-50 rounded border border-dashed">
            <div className="text-3xl font-bold">{product.stock_quantity ?? 0}</div>
            <div className="text-[10px] text-gray-400">Available</div>
          </div>
          <select value={product.stock_status ?? 'in_stock'} onChange={(e) => setField('stock_status', e.target.value)} className="border rounded w-full px-1 py-1 text-xs">
            <option value="in_stock">In Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Description */}
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <RichTextEditor label="Description" value={product.description_en ?? ''} onChange={(val) => setField('description_en', val)} />
      </div>

      {/* Procurement & Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4 h-fit">
          <h3 className="font-semibold text-gray-800 border-b pb-2">Procurement & Packaging</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm">CN Code</label>
              <input value={product.cn_code ?? ''} onChange={(e) => setField('cn_code', e.target.value)} className="border rounded w-48 px-2 py-1" />
            </div>
            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-sm">Packaging Materials</h4>
                <div className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[10px] border border-amber-100 font-bold">
                  Total: {(Object.values(product.packaging_material_weights || {}).reduce((a, b) => a + (Number(b) || 0), 0)).toFixed(3)} kg
                </div>
              </div>
              <div className="space-y-2">
                {Object.entries(product.packaging_material_weights || { 'cardboard': 0 }).map(([material, weight], idx) => (
                  <div key={idx} className="flex gap-2 items-end">
                    <select value={material} onChange={(e) => {
                      const cur = { ...product.packaging_material_weights }; delete cur[material]; cur[e.target.value] = weight; setField('packaging_material_weights', cur)
                    }} className="border rounded flex-1 px-2 py-1 text-xs">
                      <option value="cardboard">Cardboard</option>
                      <option value="plastic">Plastic</option>
                      <option value="foam">Foam</option>
                      <option value="metal">Metal</option>
                      <option value="wood">Wood</option>
                    </select>
                    <input type="number" step="0.001" defaultValue={weight} onBlur={(e) => {
                      const cur = { ...product.packaging_material_weights }; cur[material] = parseFloat(e.target.value) || 0; setField('packaging_material_weights', cur)
                    }} className="border rounded w-20 px-2 py-1 text-xs" />
                    <button onClick={() => { const cur = { ...product.packaging_material_weights }; delete cur[material]; setField('packaging_material_weights', cur) }} className="text-red-500">×</button>
                  </div>
                ))}
                <button onClick={() => setField('packaging_material_weights', { ...product.packaging_material_weights, '': 0 })} className="text-xs text-blue-600 font-bold">+ Add</button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4 h-fit">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="font-semibold text-gray-800">Supplier Invoices</h3>
            <button onClick={() => { setEditingInvoiceId(null); document.getElementById('invoice-modal')?.classList.remove('hidden') }} className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded-lg border border-green-200 font-bold">+ Add</button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {(product.supplier_invoices as any[] ?? []).map(inv => (
              <div key={inv.id} className="flex-none w-56 bg-gray-50 border rounded p-2 text-xs">
                <div className="font-bold truncate">{inv.invoice_number}</div>
                <div className="text-gray-500 mb-1">{inv.invoice_date}</div>
                <div className="flex justify-between font-mono bg-white p-1 rounded border">
                  <span className="text-blue-600">+{inv.quantity}</span>
                  <span>€{inv.unit_cost_gross?.toFixed(2)}</span>
                </div>
                <div className="flex gap-2 justify-end mt-2">
                  <button onClick={() => {
                    if (isIntrastatLocked(inv.invoice_date)) return alert('Locked');
                    setEditingInvoiceId(inv.id);
                    const m = document.getElementById('invoice-modal');
                    if (m) {
                      m.classList.remove('hidden');
                      (m.querySelector('[name=inv_num]') as HTMLInputElement).value = inv.invoice_number;
                      (m.querySelector('[name=inv_date]') as HTMLInputElement).value = inv.invoice_date;
                      (m.querySelector('[name=inv_qty]') as HTMLInputElement).value = inv.quantity;
                      (m.querySelector('[name=inv_cost]') as HTMLInputElement).value = inv.unit_cost_gross;
                    }
                  }} className="text-blue-500">✎</button>
                  <button onClick={() => {
                    if (isIntrastatLocked(inv.invoice_date)) return alert('Locked');
                    updateStockAndInvoices((product.supplier_invoices as any[]).filter(i => i.id !== inv.id))
                  }} className="text-red-500">×</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div id="invoice-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 hidden">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
          <h3 className="font-bold mb-4">{editingInvoiceId ? 'Edit Invoice' : 'Add Invoice'}</h3>
          <div className="space-y-3">
            <input name="inv_num" placeholder="Invoice Number" className="border rounded w-full px-3 py-2 text-sm" />
            <input name="inv_date" type="date" className="border rounded w-full px-3 py-2 text-sm" />
            <input name="inv_qty" type="number" placeholder="Quantity" className="border rounded w-full px-3 py-2 text-sm" />
            <input name="inv_cost" type="number" step="0.01" placeholder="Unit Cost Gross €" className="border rounded w-full px-3 py-2 text-sm" />
            <input name="inv_file" type="file" className="text-xs" />
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={() => document.getElementById('invoice-modal')?.classList.add('hidden')} className="btn btn-sm btn-ghost">Cancel</button>
            <button onClick={async () => {
              const m = document.getElementById('invoice-modal');
              const num = (m?.querySelector('[name=inv_num]') as HTMLInputElement).value;
              const date = (m?.querySelector('[name=inv_date]') as HTMLInputElement).value;
              if (!num || !date) return alert('Required fields missing');
              if (isIntrastatLocked(date)) return alert('Locked');

              const file = (m?.querySelector('[name=inv_file]') as HTMLInputElement).files?.[0];
              let path = '';
              if (file) {
                const res = await supabase.storage.from('invoices').upload(`manual/${Date.now()}_${file.name}`, file);
                if (res.data) path = res.data.path;
              }

              const inv = {
                id: editingInvoiceId || crypto.randomUUID(),
                invoice_number: num,
                invoice_date: date,
                quantity: Number((m?.querySelector('[name=inv_qty]') as HTMLInputElement).value) || 0,
                unit_cost_gross: Number((m?.querySelector('[name=inv_cost]') as HTMLInputElement).value) || 0,
                url: path || ((product.supplier_invoices as any[])?.find(x => x.id === editingInvoiceId)?.url)
              };

              let updated = [];
              if (editingInvoiceId) updated = (product.supplier_invoices as any[] ?? []).map(i => i.id === editingInvoiceId ? inv : i);
              else updated = [...(product.supplier_invoices as any[] ?? []), inv];

              updateStockAndInvoices(updated);
              m?.classList.add('hidden');
            }} className="btn btn-sm btn-primary">Save</button>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h3 className="font-semibold text-gray-800 border-b pb-2 mb-4">Related Products</h3>
        <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="border rounded w-full px-3 py-2 text-sm mb-4" placeholder="Search..." />
        <div className="max-h-40 overflow-y-auto divide-y border rounded">
          {allProducts.filter(p => p.id !== product.id && (p.name_en.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase()))).slice(0, 10).map(p => (
            <div key={p.id} onClick={() => toggleRelatedProduct(p.id)} className="p-2 flex justify-between items-center hover:bg-gray-50 cursor-pointer">
              <span className="text-sm">{p.name_en}</span>
              <input type="checkbox" checked={(product.related_products ?? []).includes(p.id)} readOnly />
            </div>
          ))}
        </div>
      </div>

      {mounted && document.getElementById('product-header-actions') && createPortal(
        <div className="flex gap-3">
          <button onClick={save} disabled={saving} className="btn btn-sm btn-primary">{saving ? 'Saving...' : 'Save Product'}</button>
          {product.id && <button onClick={handleDelete} className="btn btn-sm btn-error text-white">Delete</button>}
        </div>,
        document.getElementById('product-header-actions')!
      )}
    </div>
  )
}
