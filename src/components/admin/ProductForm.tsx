'use client'
import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { Product } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import RichTextEditor from './RichTextEditor'
import Link from 'next/link'
import { getB2BCustomerPrices, setB2BCustomerPrice, deleteB2BCustomerPrice } from '@/app/actions/pricing'
import { getB2BCustomers } from '@/app/actions/customers'

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

  // B2B Custom Pricing State
  const [b2bPrices, setB2BPrices] = useState<any[]>([])
  const [b2bPricesLoading, setB2BPricesLoading] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [newB2BPrice, setNewB2BPrice] = useState<number>(0)
  const [allB2BCustomers, setAllB2BCustomers] = useState<any[]>([])

  // Invoice Currency State
  const [invoiceCurrency, setInvoiceCurrency] = useState('EUR')
  const [conversionRate, setConversionRate] = useState(1)

  const supabase = createClient()

  useEffect(() => {
    if (invoiceCurrency === 'EUR') {
      setConversionRate(1)
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.frankfurter.app/latest?from=${invoiceCurrency}&to=EUR`)
        const data = await res.json()
        if (data?.rates?.EUR) {
          setConversionRate(data.rates.EUR)
        }
      } catch (e) {
        console.error('Frankfurter fail', e)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [invoiceCurrency])

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

    // Fetch B2B Prices
    const fetchB2BPrices = async () => {
      setB2BPricesLoading(true)
      const data = await getB2BCustomerPrices(product.id!)
      setB2BPrices(data)
      setB2BPricesLoading(false)
    }
    fetchB2BPrices()

    // Fetch All B2B Customers
    const fetchB2BCustomers = async () => {
      const data = await getB2BCustomers()
      setAllB2BCustomers(data)
    }
    fetchB2BCustomers()
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

  const handleSetB2BPrice = async () => {
    if (!selectedCustomerId || !product.id || newB2BPrice <= 0) return
    try {
      await setB2BCustomerPrice(selectedCustomerId, product.id, newB2BPrice)
      const updated = await getB2BCustomerPrices(product.id)
      setB2BPrices(updated)
      setSelectedCustomerId('')
      setNewB2BPrice(0)
    } catch (err) {
      alert('Failed to set B2B price')
    }
  }

  const handleDeleteB2BPrice = async (id: string) => {
    if (!confirm('Remove this custom price?')) return
    try {
      await deleteB2BCustomerPrice(id, product.id!)
      setB2BPrices(prev => prev.filter(p => p.id !== id))
    } catch (err) {
      alert('Failed to delete')
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
              <label className="block text-xs font-bold text-gray-700 mb-1">Weight (kg)</label>
              <input type="number" step="0.001" value={product.weight_kg ?? ''} onChange={(e) => setField('weight_kg', Number(e.target.value))} className="border rounded w-full px-2 py-1 text-sm font-mono" />
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
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Units per Box</label>
              <input type="number" value={product.units_per_box ?? ''} onChange={(e) => setField('units_per_box', Number(e.target.value))} className="border rounded w-full px-2 py-1 text-sm" />
            </div>
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
              <input type="number" step="0.01" value={product.b2b_price_eur ?? ''} onChange={(e) => setField('b2b_price_eur', Number(e.target.value))} className="border rounded w-full px-2 py-1 text-sm font-semibold text-blue-600" />
            </div>
          </div>
          <div className="bg-blue-50 p-2 rounded border border-blue-100 mt-2">
            <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">B2B Custom Pricing</h4>
            <div className="max-h-24 overflow-y-auto space-y-1">
              {b2bPricesLoading ? <div className="text-[10px]">Loading...</div> :
                b2bPrices.length === 0 ? <div className="text-[10px] text-gray-400 italic">No custom prices</div> :
                  b2bPrices.map(bp => (
                    <div key={bp.id} className="flex justify-between items-center text-[10px] bg-white p-1 rounded border">
                      <span className="truncate flex-1 font-medium">{bp.customer?.company_name || bp.customer?.email}</span>
                      <span className="font-bold text-blue-600 px-2">€{bp.price_eur.toFixed(2)}</span>
                      <button onClick={() => handleDeleteB2BPrice(bp.id)} className="text-red-500 hover:text-red-700">×</button>
                    </div>
                  ))
              }
            </div>
            <div className="mt-2 space-y-1">
              <select
                className="w-full text-[10px] p-1 border rounded"
                value={selectedCustomerId}
                onChange={e => setSelectedCustomerId(e.target.value)}
              >
                <option value="">Select B2B Customer...</option>
                {allB2BCustomers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.company_name} ({c.email})
                  </option>
                ))}
              </select>
              <div className="flex gap-1">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Price"
                  className="flex-1 text-[10px] p-1 border rounded"
                  value={newB2BPrice || ''}
                  onChange={e => setNewB2BPrice(Number(e.target.value))}
                />
                <button
                  onClick={handleSetB2BPrice}
                  disabled={!selectedCustomerId || newB2BPrice <= 0}
                  className="bg-blue-600 text-white px-2 py-1 rounded text-[10px] font-bold disabled:opacity-50"
                >Set</button>
              </div>
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
          <select value={product.stock_status ?? 'in_stock'} onChange={(e) => setField('stock_status', e.target.value)} className="border rounded w-full px-2 py-2 text-sm">
            <option value="in_stock">In Stock</option>
            <option value="out_of_stock">Out of Stock</option>
            <option value="coming_soon">Coming Soon</option>
            <option value="special_order">Special Order</option>
            <option value="available_to_order">Available to Order</option>
          </select>
          <div>
            <label className="block text-[10px] font-bold text-gray-700 mb-1">Low Stock Threshold</label>
            <input type="number" value={product.low_stock_threshold ?? ''} onChange={(e) => setField('low_stock_threshold', Number(e.target.value))} className="border rounded w-full px-2 py-1 text-sm" />
          </div>
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
              <label className="block text-sm font-bold">CN Code</label>
              <input value={product.cn_code ?? ''} onChange={(e) => setField('cn_code', e.target.value)} className="border rounded w-48 px-2 py-1 font-mono" />
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
                    <input type="number" step="0.001" value={weight} onChange={(e) => {
                      const cur = { ...product.packaging_material_weights }; cur[material] = parseFloat(e.target.value) || 0; setField('packaging_material_weights', cur)
                    }} className="border rounded w-28 px-2 py-1 text-xs font-mono" />
                    <button onClick={() => { const cur = { ...product.packaging_material_weights }; delete cur[material]; setField('packaging_material_weights', cur) }} className="w-8 h-8 flex items-center justify-center rounded hover:bg-red-50 text-red-500">×</button>
                  </div>
                ))}
                <button onClick={() => setField('packaging_material_weights', { ...product.packaging_material_weights, '': 0 })} className="text-xs text-blue-600 font-bold hover:underline">+ Add Material</button>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4 h-fit">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="font-semibold text-gray-800">Supplier Invoices</h3>
            <button onClick={() => { setEditingInvoiceId(null); document.getElementById('invoice-modal')?.classList.remove('hidden') }} className="text-xs bg-green-50 text-green-700 px-3 py-1 rounded-lg border border-green-200 font-bold">+ Add Invoice</button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {(product.supplier_invoices as any[] ?? []).sort((a, b) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime()).map(inv => (
              <div key={inv.id} className="flex-none w-56 bg-white border border-gray-100 rounded-xl p-3 shadow-sm hover:shadow-md transition">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-black text-gray-900 truncate flex-1 pr-2">{inv.invoice_number}</div>
                  {isIntrastatLocked(inv.invoice_date) && (
                    <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded border border-red-100 font-bold uppercase">Locked</span>
                  )}
                </div>
                <div className="text-gray-400 text-[10px] uppercase font-black tracking-widest mb-3">{new Date(inv.invoice_date).toLocaleDateString()}</div>
                <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100 mb-3">
                  <span className="text-blue-600 font-black font-mono">+{inv.quantity}</span>
                  <span className="font-bold text-gray-700">€{Number(inv.unit_cost_gross || 0).toFixed(2)}</span>
                </div>
                <div className="flex gap-2 justify-end pt-2 border-t border-gray-50">
                  {inv.url && (
                    <a href={inv.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">View PDF</a>
                  )}
                  <button onClick={() => {
                    if (isIntrastatLocked(inv.invoice_date)) return alert('Locked - month reported to Intrastat');
                    setEditingInvoiceId(inv.id);
                    const m = document.getElementById('invoice-modal');
                    if (m) {
                      m.classList.remove('hidden');
                      (m.querySelector('[name=inv_num]') as HTMLInputElement).value = inv.invoice_number;
                      (m.querySelector('[name=inv_date]') as HTMLInputElement).value = inv.invoice_date;
                      (m.querySelector('[name=inv_qty]') as HTMLInputElement).value = inv.quantity;
                      (m.querySelector('[name=inv_cost]') as HTMLInputElement).value = inv.unit_cost_gross;
                    }
                  }} className="text-gray-400 hover:text-blue-600">✎</button>
                  <button onClick={() => {
                    if (isIntrastatLocked(inv.invoice_date)) return alert('Locked - month reported to Intrastat');
                    if (confirm('Delete invoice?')) updateStockAndInvoices((product.supplier_invoices as any[]).filter(i => i.id !== inv.id))
                  }} className="text-gray-400 hover:text-red-500">×</button>
                </div>
              </div>
            ))}
            {(!product.supplier_invoices || (product.supplier_invoices as any[]).length === 0) && (
              <div className="w-full text-center py-8 text-gray-400 italic text-sm border border-dashed rounded-xl">No invoices found.</div>
            )}
          </div>
        </div>
      </div>

      {/* Related Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
          <div className="flex justify-between items-end border-b pb-2">
            <div>
              <h3 className="font-bold text-gray-800">Related Products</h3>
              <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Cross-selling suggestions</p>
            </div>
            {(product.related_products ?? []).length > 0 && (
              <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold border border-blue-100">{(product.related_products ?? []).length} Selected</span>
            )}
          </div>

          <div className="flex gap-2">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border rounded-lg flex-1 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Search products by SKU or name..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
            {allProducts
              .filter(p => p.id !== product.id && (p.name_en.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase())))
              .map(p => {
                const isSelected = (product.related_products ?? []).includes(p.id)
                return (
                  <div
                    key={p.id}
                    onClick={() => toggleRelatedProduct(p.id)}
                    className={`p-2 flex items-center gap-3 rounded-xl border cursor-pointer transition ${isSelected ? 'border-blue-200 bg-blue-50/50 shadow-sm' : 'border-gray-50 hover:border-gray-200'}`}
                  >
                    <div className="w-10 h-10 bg-white rounded-lg border p-1 flex-shrink-0">
                      <img src={p.images?.[0] || ''} alt="" className="w-full h-full object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">{p.name_en}</p>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{p.sku}</p>
                    </div>
                    <input type="checkbox" checked={isSelected} readOnly className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  </div>
                )
              })
            }
          </div>
        </div>

        {/* Sales History */}
        <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
          <div className="border-b pb-2">
            <h3 className="font-bold text-gray-800">Sales History</h3>
            <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Recent customer orders</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-gray-400 font-black uppercase tracking-widest border-b border-gray-50">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Order</th>
                  <th className="pb-2">Customer</th>
                  <th className="pb-2">Qty</th>
                  <th className="pb-2 text-right">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {salesHistoryLoading ? (
                  <tr><td colSpan={5} className="py-4 text-center">Loading...</td></tr>
                ) : salesHistory.length === 0 ? (
                  <tr><td colSpan={5} className="py-4 text-center italic text-gray-400">No sales history found.</td></tr>
                ) : (
                  salesHistory.map((item: any) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 group">
                      <td className="py-3 text-gray-600">{new Date(item.orders?.created_at).toLocaleDateString()}</td>
                      <td className="py-3">
                        <Link href={`/admin/orders/${item.order_id}`} className="font-bold text-blue-600 hover:underline">#{item.orders?.order_number}</Link>
                      </td>
                      <td className="py-3">
                        <div className="font-medium text-gray-900 max-w-[150px] truncate">{item.orders?.company_name || 'Individual'}</div>
                        <div className="text-[10px] text-gray-400 truncate max-w-[150px]">{item.orders?.customer_email}</div>
                      </td>
                      <td className="py-3 font-black text-gray-900">×{item.quantity}</td>
                      <td className="py-3 text-right font-bold text-gray-900">€{item.unit_price.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div id="invoice-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 hidden">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-black text-gray-900 uppercase tracking-widest text-sm">{editingInvoiceId ? 'Edit Supplier Invoice' : 'Add New Invoice'}</h3>
            <button onClick={() => document.getElementById('invoice-modal')?.classList.add('hidden')} className="text-gray-400 hover:text-red-500 font-bold text-xl">×</button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Invoice Number</label>
              <input name="inv_num" placeholder="INV-12345" className="border rounded-xl w-full px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-green-500 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Date</label>
                <input name="inv_date" type="date" className="border rounded-xl w-full px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-green-500 outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Quantity</label>
                <input name="inv_qty" type="number" placeholder="20" className="border rounded-xl w-full px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-green-500 outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Currency</label>
                <select
                  value={invoiceCurrency}
                  onChange={e => setInvoiceCurrency(e.target.value)}
                  className="border rounded-xl w-full px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-green-500 outline-none"
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="CHF">CHF</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Rate (1 {invoiceCurrency} = ? EUR)</label>
                <input
                  type="number"
                  step="0.000001"
                  value={conversionRate}
                  onChange={e => setConversionRate(Number(e.target.value))}
                  className="border rounded-xl w-full px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-green-500 outline-none font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Unit Cost Gross ({invoiceCurrency})</label>
              <input name="inv_cost" type="number" step="0.0001" placeholder="42.50" className="border rounded-xl w-full px-3 py-2.5 text-sm font-bold focus:ring-2 focus:ring-green-500 outline-none" />
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 italic text-[11px] text-gray-500">
              Note: Updating invoices will automatically recalculate total stock and weighted average cost for this product.
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Upload File (PDF/Image)</label>
              <input name="inv_file" type="file" className="text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:bg-green-50 file:text-green-700 hover:file:bg-green-100 cursor-pointer" />
            </div>
          </div>
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
            <button onClick={() => document.getElementById('invoice-modal')?.classList.add('hidden')} className="px-4 py-2 font-black text-[10px] uppercase tracking-widest text-gray-400 hover:text-gray-600">Cancel</button>
            <button onClick={async (e) => {
              const btn = e.currentTarget;
              btn.disabled = true;
              btn.innerText = 'SAVING...';

              const m = document.getElementById('invoice-modal');
              const num = (m?.querySelector('[name=inv_num]') as HTMLInputElement).value;
              const date = (m?.querySelector('[name=inv_date]') as HTMLInputElement).value;
              if (!num || !date) { alert('Invoice number and date are required'); btn.disabled = false; btn.innerText = 'SAVE'; return; }
              if (isIntrastatLocked(date)) { alert('This period is already reported to Intrastat and is locked.'); btn.disabled = false; btn.innerText = 'SAVE'; return; }

              const file = (m?.querySelector('[name=inv_file]') as HTMLInputElement).files?.[0];
              let path = '';
              if (file) {
                const fRes = await supabase.storage.from('invoices').upload(`manual/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`, file);
                if (fRes.data) path = supabase.storage.from('invoices').getPublicUrl(fRes.data.path).data.publicUrl;
              }

              const inv = {
                id: editingInvoiceId || crypto.randomUUID(),
                invoice_number: num,
                invoice_date: date,
                quantity: Number((m?.querySelector('[name=inv_qty]') as HTMLInputElement).value) || 0,
                unit_cost_gross: Number((m?.querySelector('[name=inv_cost]') as HTMLInputElement).value) * conversionRate,
                currency: invoiceCurrency,
                conversion_rate: conversionRate,
                url: path || ((product.supplier_invoices as any[])?.find(x => x.id === editingInvoiceId)?.url)
              };

              let updated = [];
              if (editingInvoiceId) updated = (product.supplier_invoices as any[] ?? []).map(i => i.id === editingInvoiceId ? inv : i);
              else updated = [...(product.supplier_invoices as any[] ?? []), inv];

              updateStockAndInvoices(updated);
              m?.classList.add('hidden');
              btn.disabled = false;
              btn.innerText = 'SAVE';
            }} className="bg-green-600 text-white px-6 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-green-100 hover:bg-green-700 transition">Save Invoice</button>
          </div>
        </div>
      </div>

      {mounted && document.getElementById('product-header-actions') && createPortal(
        <div className="flex gap-4 items-center">
          <Link href="/admin/products" className="group flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl text-xs font-black text-gray-400 uppercase tracking-widest hover:border-blue-200 hover:text-blue-600 transition shadow-sm">
            <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
            Back
          </Link>
          <div className="h-8 w-[1px] bg-gray-100"></div>
          <button onClick={save} disabled={saving} className="bg-blue-600 text-white px-8 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition shadow-lg shadow-blue-100 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Product'}
          </button>
          {product.id && (
            <button onClick={handleDelete} className="text-gray-300 hover:text-red-500 transition-colors tooltip tooltip-left" data-tip="Delete Product">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          )}
        </div>,
        document.getElementById('product-header-actions')!
      )}
    </div>
  )
}
