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


  const [deleting, setDeleting] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch Sales History on mount or product change
  useEffect(() => {
    if (!product.id) return
    const fetchHistory = async () => {
      setSalesHistoryLoading(true)
      // Check if order_items table exists first by simple query? No, just try catch.
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

        if (!error && data) {
          setSalesHistory(data)
        }
      } catch (err) {
        console.error('Failed to fetch sales history', err)
      } finally {
        setSalesHistoryLoading(false)
      }
    }
    fetchHistory()
  }, [product.id])
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<{ id: string, name: string, parent_id: string | null }[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase.from('categories').select('id, name, parent_id').then(({ data }) => {
      if (data) setCategories(data)
      setLoading(false)
    })
  }, [])
  const [uploading, setUploading] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [allProducts, setAllProducts] = useState<Array<Pick<Product, 'id' | 'name_en' | 'sku' | 'images'>>>([])
  const [searchTerm, setSearchTerm] = useState('')

  const supabase = createClient()

  // Fetch all products for related products selector
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
      if (res.error) {
        console.error('Upload error', res.error)
        continue
      }
      const url = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
      uploaded.push(url)
    }

    setUploading(false)
    setFiles([])
    return uploaded
  }

  async function save() {
    setSaving(true)
    try {
      const imageUrls = await uploadFiles()

      const payload: any = { ...product }
      if (imageUrls && imageUrls.length) payload.images = [...(payload.images ?? []), ...imageUrls]
      // payload.supplier_invoices is already in 'product' state from setField

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
      {/* 1. Top Row: 4 Cards (Identity, Categorization, Pricing, Stock) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* Card 1: Identity */}
        <div className="bg-white p-5 rounded-xl border shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-800 border-b pb-2 text-sm uppercase tracking-wide">Identity</h3>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Product Name</label>
            <input value={product.name_en ?? ''} onChange={(e) => setField('name_en', e.target.value)} className="border rounded w-full px-3 py-2 text-sm font-medium" placeholder="Product Name" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">SKU</label>
              <input value={product.sku ?? ''} onChange={(e) => setField('sku', e.target.value)} className="border rounded w-full px-2 py-1 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Slug</label>
              <input value={product.slug ?? ''} onChange={(e) => setField('slug', e.target.value)} className="border rounded w-full px-2 py-1 text-xs text-gray-500 bg-gray-50" placeholder="auto" />
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

        {/* Card 2: Categorization (Moved from Identity) */}
        <div className="bg-white p-5 rounded-xl border shadow-sm space-y-4 relative">
          <h3 className="font-semibold text-gray-800 border-b pb-2 text-sm uppercase tracking-wide">Categorization</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Category</label>
              <select
                value={product.category ?? ''}
                onChange={(e) => {
                  setField('category', e.target.value)
                  setField('subcategory', '')
                }}
                className="border rounded w-full px-2 py-2 text-sm bg-white"
              >
                <option value="">Select Category...</option>
                {categories.filter(c => !c.parent_id).map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Subcategory</label>
              <select
                value={product.subcategory ?? ''}
                onChange={(e) => setField('subcategory', e.target.value)}
                className="border rounded w-full px-2 py-2 text-sm bg-white"
                disabled={!product.category}
              >
                <option value="">Select Subcategory...</option>
                {(() => {
                  const parentCat = categories.find(c => c.name === product.category)
                  if (!parentCat) return null
                  return categories
                    .filter(c => c.parent_id === parentCat.id)
                    .map(c => <option key={c.id} value={c.name}>{c.name}</option>)
                })()}
              </select>
            </div>
            <div className="pt-2">
              <a href="/admin/settings" target="_blank" className="text-[10px] text-blue-500 hover:underline flex items-center gap-1">
                Manage Categories ↗
              </a>
            </div>
          </div>
        </div>

        {/* Card 3: Pricing (Refactored from previous card) */}
        <div className="bg-white p-5 rounded-xl border shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-800 border-b pb-2 text-sm uppercase tracking-wide">Pricing</h3>

          {/* Cost Check */}
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500 font-medium">Gross Cost:</span>
            <span className="font-mono bg-gray-100 px-1 rounded">€{product.cost_eur ? Number(product.cost_eur).toFixed(2) : '0.00'}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase">B2C <span className="text-gray-300 font-normal">Net</span></label>
              <input
                type="number"
                step="0.01"
                value={product.price_eur ?? ''}
                onChange={(e) => setField('price_eur', Number(e.target.value))}
                className="border rounded w-full px-2 py-1 text-sm font-semibold focus:ring-1 focus:ring-green-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase">B2B <span className="text-gray-300 font-normal">Net</span></label>
              <input
                type="number"
                step="0.01"
                value={product.b2b_price_eur ?? ''}
                onChange={(e) => setField('b2b_price_eur', Number(e.target.value))}
                className="border rounded w-full px-2 py-1 text-sm font-medium focus:ring-1 focus:ring-gray-500"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Margin Indicator */}
          {(() => {
            let totalSalesVal = 0;
            let totalSalesQty = 0;
            if (salesHistory && salesHistory.length > 0) {
              salesHistory.forEach((sale: any) => {
                totalSalesVal += (sale.unit_price || 0) * (sale.quantity || 0);
                totalSalesQty += (sale.quantity || 0);
              });
            }
            const avgSalePrice = totalSalesQty > 0 ? (totalSalesVal / totalSalesQty) : 0;
            const grossCost = product.cost_eur || 0;
            const marginEur = avgSalePrice - grossCost;
            const marginPercent = avgSalePrice > 0 ? (marginEur / avgSalePrice) * 100 : 0;

            /* Live Preview Margin (based on B2C input if no sales) */
            const liveB2C = product.price_eur || 0;
            const liveMargin = liveB2C - grossCost;
            const livePercent = liveB2C > 0 ? (liveMargin / liveB2C) * 100 : 0;

            return (
              <div className="text-xs pt-1 border-t mt-1">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Est. Margin:</span>
                  <span className={`font-bold ${livePercent >= 20 ? 'text-green-600' : livePercent > 0 ? 'text-orange-500' : 'text-red-500'}`}>
                    {livePercent.toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Card 4: Stock (Refactored) */}
        <div className="bg-white p-5 rounded-xl border shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-800 border-b pb-2 text-sm uppercase tracking-wide">Stock</h3>

          <div className="text-center py-2 bg-gray-50 rounded border border-dashed relative group">
            <div className="text-3xl font-bold text-gray-800 font-mono tracking-tighter">{product.stock_quantity ?? 0}</div>
            <div className="text-[10px] text-gray-400 uppercase font-bold">Units Available</div>
            <div className="absolute inset-0 bg-white/90 hidden group-hover:flex items-center justify-center text-xs text-blue-600 font-medium cursor-help" title="Add Invoice to increase stock">
              Managed via Invoices
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">Low Limit</label>
              <input type="number" value={product.low_stock_threshold ?? 10} onChange={(e) => setField('low_stock_threshold', Number(e.target.value))} className="border rounded w-full px-2 py-1 text-xs text-center" />
            </div>
            <div>
              <label className="block text-[10px] text-gray-500 mb-1">Status</label>
              <select
                value={product.stock_status ?? 'in_stock'}
                onChange={(e) => setField('stock_status', e.target.value)}
                className="border rounded w-full px-1 py-1 text-xs"
              >
                <option value="in_stock">In Stock</option>
                <option value="special_order">Special</option>
                <option value="available_to_order">Available to Order</option>
                <option value="coming_soon">Coming Soon</option>
                <option value="out_of_stock">OfS</option>
              </select>
            </div>
          </div>
        </div>

      </div>

      {/* 2. Full Width Description */}
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <RichTextEditor
          label="Product Description"
          value={(() => {
            const raw = product.description_en ?? '';
            if (/<\/?[a-z][\s\S]*>/i.test(raw)) return raw;
            if (!raw) return '';
            const lines = raw.split('\n');
            let html = '';
            let inList = false;
            let isDetailedSection = false;
            lines.forEach(line => {
              const trimmed = line.trim();
              if (!trimmed) return;
              if (['Functions', 'Features and benefits', 'Configuration', 'Required'].some(h => trimmed.includes(h))) {
                if (inList) { html += '</ul>'; inList = false; }
                html += `<h3>${trimmed}</h3>`;
                isDetailedSection = true;
              } else {
                if (isDetailedSection) {
                  if (!inList) { html += '<ul>'; inList = true; }
                  html += `<li>${trimmed}</li>`;
                } else {
                  html += `<p>${trimmed}</p>`;
                }
              }
            });
            if (inList) html += '</ul>';
            return html || raw;
          })()}
          onChange={(val) => setField('description_en', val)}
          placeholder="Detailed product description..."
        />
      </div>

      {/* 4. Procurement & Invoices Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Procurement Fields */}
        <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4 h-fit">
          <h3 className="font-semibold text-gray-800 border-b pb-2">Procurement & Customs</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm flex items-center gap-2">
                CN Code (Intrastat)
                <div className="flex gap-2">
                  <a href="https://ec.europa.eu/taxation_customs/dds2/taric/news/newstar.jsp?Lang=en" target="_blank" className="text-[10px] text-blue-500 hover:underline">TARIC News ↗</a>
                  <a href="https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp" target="_blank" className="text-[10px] text-blue-500 hover:underline">Consultation ↗</a>
                </div>
              </label>
              <input value={product.cn_code ?? ''} onChange={(e) => setField('cn_code', e.target.value)} className="border rounded w-48 px-2 py-1" placeholder="e.g. 85414020" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm">Country of Origin</label>
                <input value={product.country_of_origin ?? ''} onChange={(e) => setField('country_of_origin', e.target.value)} className="border rounded w-full px-2 py-1" placeholder="e.g. US" />
              </div>
            </div>

            {/* eTROD Compliance */}
            <div className="border-t pt-4 mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">eTROD (Environmental Fee)</h4>
              <div className="flex items-center gap-4 mb-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={product.is_electrical_equipment ?? true}
                    onChange={(e) => setField('is_electrical_equipment', e.target.checked)}
                    className="rounded"
                  />
                  Is Electrical Equipment
                </label>
              </div>
              <div>
                <label className="block text-sm">eTROD Category</label>
                <select
                  value={product.trod_category_code ?? '7'}
                  onChange={(e) => setField('trod_category_code', e.target.value || null)}
                  className="border rounded w-full px-2 py-1"
                >
                  <option value="">Not Applicable</option>
                  <option value="1">1 - Heat Exchange Equipment</option>
                  <option value="2">2 - Screens, Monitors (&gt;100 cm²)</option>
                  <option value="3">3 - Lamps (Sijalke)</option>
                  <option value="4">4 - Large Equipment (&gt;50 cm)</option>
                  <option value="5">5 - Small Equipment (≤50 cm)</option>
                  <option value="6">6 - Small IT & Telecom Equipment</option>
                  <option value="7">7-PBA - Portable Batteries & Accumulators</option>
                </select>
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium text-gray-700">Packaging Waste</h4>
                <button
                  type="button"
                  onClick={() => {
                    const current = product.packaging_material_weights || {}
                    setField('packaging_material_weights', { ...current, '': 0 })
                  }}
                  className="text-xs text-blue-600 font-bold hover:underline"
                >
                  + Add Material
                </button>
              </div>

              <div className="space-y-3">
                {Object.entries(product.packaging_material_weights || { 'cardboard': product.packaging_weight_per_unit_kg || 0 }).map(([material, weight], idx) => (
                  <div key={idx} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="block text-[10px] text-gray-400 font-bold">Material</label>
                      <select
                        value={material}
                        onChange={(e) => {
                          const newMaterial = e.target.value
                          const current = { ...product.packaging_material_weights }
                          delete current[material]
                          current[newMaterial] = weight
                          setField('packaging_material_weights', current)
                        }}
                        className="border rounded w-full px-2 py-1 text-xs"
                      >
                        <option value="cardboard">Cardboard</option>
                        <option value="plastic">Plastic</option>
                        <option value="foam">Foam/Polystyrene</option>
                        <option value="metal">Metal</option>
                        <option value="glass">Glass</option>
                        <option value="wood">Wood</option>
                        <option value="paper">Paper</option>
                        <option value="textile">Textile</option>
                      </select>
                    </div>
                    <div className="w-24">
                      <label className="block text-[10px] text-gray-400 font-bold">Weight (kg)</label>
                      <input
                        type="number"
                        step="0.001"
                        value={weight || ''}
                        onChange={(e) => {
                          const current = { ...product.packaging_material_weights }
                          current[material] = parseFloat(e.target.value) || 0
                          setField('packaging_material_weights', current)
                          // Maintain balance with legacy field if cardboard
                          if (material === 'cardboard') setField('packaging_weight_per_unit_kg', current[material])
                        }}
                        className="border rounded w-full px-2 py-1 text-xs"
                        placeholder="0.000"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const current = { ...product.packaging_material_weights }
                        delete current[material]
                        setField('packaging_material_weights', current)
                      }}
                      className="p-1.5 text-red-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Right: Supplier Invoices */}
        <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4 h-fit">
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-semibold text-gray-800">Supplier Invoices & Stock Adjustment</h3>
              <button
                type="button"
                onClick={() => {
                  const dialog = document.getElementById('invoice-modal') as HTMLDialogElement
                  dialog?.showModal()
                }}
                className="btn btn-sm btn-outline gap-2"
              >
                <span>+ Add Invoice / Stock</span>
              </button>
            </div>

            {/* Hidden Modal for Invoice Upload */}
            <dialog id="invoice-modal" className="modal">
              <div className="modal-box w-11/12 max-w-2xl bg-white p-6 rounded-xl shadow-2xl">
                <h3 className="font-bold text-lg mb-4">Add Supplier Invoice / Quantities</h3>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Invoice Number <span className="text-red-500">*</span></label>
                      <input id="inv-num" type="text" className="border rounded w-full px-3 py-2" placeholder="e.g. INV-2024-001" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Date <span className="text-red-500">*</span></label>
                      <input id="inv-date" type="date" className="border rounded w-full px-3 py-2" defaultValue={new Date().toISOString().split('T')[0]} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Quantity Received</label>
                      <input id="inv-qty" type="number" className="border rounded w-full px-3 py-2 border-blue-300 bg-blue-50" placeholder="0" />
                      <p className="text-[10px] text-blue-600 mt-1">This will be ADDED to current stock.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Unit Cost (Gross)</label>
                      <div className="flex gap-2">
                        <select
                          id="inv-currency"
                          className="border rounded px-2 py-2 w-20 bg-gray-50 text-sm font-semibold"
                          defaultValue="EUR"
                          onChange={async (e) => {
                            const cur = e.target.value;
                            const costInput = document.getElementById('inv-cost') as HTMLInputElement;
                            const display = document.getElementById('inv-converted-display');

                            if (cur === 'EUR') {
                              if (display) display.textContent = '';
                              return;
                            }

                            // Fetch rate
                            try {
                              if (display) display.textContent = 'Fetching rate...';
                              const res = await fetch(`https://api.frankfurter.app/latest?from=${cur}&to=EUR`);
                              const data = await res.json();
                              const rate = data.rates.EUR;

                              // Store rate in a data attribute
                              costInput.dataset.rate = rate;

                              // Update display
                              const val = parseFloat(costInput.value) || 0;
                              if (display) display.textContent = `≈ €${(val * rate).toFixed(2)} (Rate: ${rate})`;
                            } catch (err) {
                              if (display) display.textContent = 'Error fetching rate';
                            }
                          }}
                        >
                          <option value="EUR">€ EUR</option>
                          <option value="USD">$ USD</option>
                          <option value="GBP">£ GBP</option>
                          <option value="CHF">Fr CHF</option>
                          <option value="CNY">¥ CNY</option>
                        </select>
                        <div className="relative w-full">
                          <input
                            id="inv-cost"
                            type="number"
                            step="0.01"
                            className="border rounded w-full px-3 py-2"
                            placeholder="0.00"
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const cur = (document.getElementById('inv-currency') as HTMLSelectElement).value;
                              const display = document.getElementById('inv-converted-display');
                              const costInput = e.target;

                              if (cur === 'EUR') {
                                if (display) display.textContent = '';
                              } else {
                                const rate = parseFloat(costInput.dataset.rate || '0');
                                if (rate && display) {
                                  display.textContent = `≈ €${(val * rate).toFixed(2)} (Rate: ${rate})`;
                                }
                              }
                            }}
                          />
                          <div id="inv-converted-display" className="absolute right-0 -bottom-5 text-[10px] text-green-600 font-bold bg-green-50 px-1 rounded"></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Country of Purchase</label>
                      <input id="inv-country" type="text" className="border rounded w-full px-3 py-2" placeholder="e.g. Germany" defaultValue={product.country_of_purchase || ''} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Brief Description</label>
                      <input id="inv-desc" type="text" className="border rounded w-full px-3 py-2" placeholder="e.g. Q1 Stock Replenishment" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">File (PDF or Image) <span className="text-red-500">*</span></label>
                    <input
                      id="inv-file"
                      type="file"
                      accept=".pdf,image/*"
                      className="file-input file-input-bordered w-full"
                    />
                  </div>
                </div>

                <div className="modal-action mt-6">
                  <form method="dialog">
                    <button className="btn btn-sm btn-ghost mr-2">Cancel</button>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary bg-green-600 text-white hover:bg-green-700"
                      onClick={async () => {
                        const numInput = document.getElementById('inv-num') as HTMLInputElement
                        const dateInput = document.getElementById('inv-date') as HTMLInputElement
                        const descInput = document.getElementById('inv-desc') as HTMLInputElement
                        const qtyInput = document.getElementById('inv-qty') as HTMLInputElement
                        const costInput = document.getElementById('inv-cost') as HTMLInputElement
                        const curInput = document.getElementById('inv-currency') as HTMLSelectElement
                        const fileInput = document.getElementById('inv-file') as HTMLInputElement

                        const file = fileInput?.files?.[0]
                        if (!file || !numInput.value || !dateInput.value) {
                          alert('Please fill in Invoice Number, Date and select a file.')
                          return
                        }

                        setUploading(true)
                        // Upload
                        const path = `manual_uploads/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
                        const { data, error } = await supabase.storage.from('invoices').upload(path, file)

                        setUploading(false)

                        if (error) {
                          console.error('Upload failed', error)
                          alert('Upload failed: ' + error.message)
                          return
                        }

                        // Parse Qty & Cost
                        const qtyAdded = Number(qtyInput.value) || 0
                        let originalCost = Number(costInput.value) || 0
                        const currency = curInput.value
                        let unitCost = originalCost

                        // Handle Conversion
                        if (currency !== 'EUR') {
                          const rate = parseFloat(costInput.dataset.rate || '0')
                          if (rate) {
                            unitCost = originalCost * rate
                          } else {
                            // Fallback if no rate fetched (shouldn't happen if user waited)
                            // Try fetching again synchronously? No can't.
                            // Just alert warning?
                            if (!confirm(`Warning: Could not fetch exchange rate for ${currency}. Using 1:1 conversion. Continue?`)) return;
                          }
                        }

                        // Add to invoice list
                        const newInvoice = {
                          id: crypto.randomUUID(),
                          url: data.path, // Store path, not public URL (private bucket)
                          filename: file.name,
                          invoice_number: numInput.value,
                          invoice_date: dateInput.value,
                          quantity: qtyAdded,
                          unit_cost_gross: unitCost, // Always EUR
                          currency: currency,
                          original_unit_cost: originalCost,
                          description: descInput.value,
                          uploaded_at: new Date().toISOString(),
                          country_of_purchase: (document.getElementById('inv-country') as HTMLInputElement).value
                        }

                        // Update global field
                        setField('country_of_purchase', newInvoice.country_of_purchase)

                        const currentInvoices = product.supplier_invoices ?? []
                        setField('supplier_invoices', [...currentInvoices, newInvoice])

                        // Auto-Update Stock & Cost (Weighted Average)
                        if (qtyAdded > 0) {
                          const currentStock = product.stock_quantity ?? 0
                          const currentCost = product.cost_eur ?? 0

                          // Weighted Average Calculation
                          // Total Value = (Old Stock * Old Cost) + (New Stock * New Cost)
                          const oldValue = currentStock * currentCost
                          const newValue = qtyAdded * unitCost

                          const totalStock = currentStock + qtyAdded
                          const totalValue = oldValue + newValue

                          // Avoid division by zero
                          const newAvgCost = totalStock > 0 ? (totalValue / totalStock) : 0

                          setField('stock_quantity', totalStock)
                          setField('cost_eur', Number(newAvgCost.toFixed(4))) // Store with 4 decimal precision
                        }

                        // Reset & Close
                        numInput.value = ''
                        descInput.value = ''
                        qtyInput.value = ''
                        costInput.value = ''
                        costInput.removeAttribute('data-rate');
                        curInput.value = 'EUR';
                        const display = document.getElementById('inv-converted-display');
                        if (display) display.textContent = '';
                        (document.getElementById('inv-country') as HTMLInputElement).value = ''
                        descInput.value = ''
                        fileInput.value = ''
                        const dialog = document.getElementById('invoice-modal') as HTMLDialogElement
                        dialog.close()
                      }}
                    >
                      {uploading ? 'Uploading...' : 'Save & Add Stock'}
                    </button>
                  </form>

                </div>
              </div>
            </dialog>

            {/* List of Invoices - Horizontal Scroll */}
            <div className="flex gap-4 overflow-x-auto pb-4 pt-2">
              {((product.supplier_invoices as any[]) ?? [])
                .sort((a, b) => new Date(b.invoice_date || 0).getTime() - new Date(a.invoice_date || 0).getTime()) // Sort Newest Date First (Left)
                .map((inv) => (
                  <div key={inv.id} className="flex-none w-64 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow p-3 flex flex-col group relative">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold text-gray-800 text-sm truncate w-40" title={inv.invoice_number}>{inv.invoice_number}</div>
                        <div className="text-xs text-gray-500">{inv.invoice_date}</div>
                      </div>
                      <div className="flex gap-1">
                        {/* Preview Toggle */}
                        <button
                          type="button"
                          onClick={async (e) => {
                            const btn = e.currentTarget
                            const container = btn.closest('.group')?.querySelector('.preview-container')
                            if (container) {
                              if (container.classList.contains('hidden')) {
                                // Show
                                container.classList.remove('hidden')
                                // Generate Signed URL if needed
                                if (!container.querySelector('iframe') && !container.querySelector('img')) {
                                  const { data } = await supabase.storage.from('invoices').createSignedUrl(inv.url, 3600)
                                  if (data?.signedUrl) {
                                    const ext = inv.filename.split('.').pop()?.toLowerCase()
                                    if (ext === 'pdf') {
                                      container.innerHTML = `<iframe src="${data.signedUrl}" className="w-full h-full border-0" style="height:300px; width:100%"></iframe>`
                                    } else {
                                      container.innerHTML = `<img src="${data.signedUrl}" className="object-contain w-full h-full" style="max-height:300px" />`
                                    }
                                  }
                                }
                                btn.innerHTML = '▲'
                              } else {
                                // Hide
                                container.classList.add('hidden')
                                btn.innerHTML = '▼'
                              }
                            }
                          }}
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-xs text-gray-500"
                          title="Expand Preview"
                        >
                          ▼
                        </button>

                        {/* Download */}
                        <button
                          type="button"
                          onClick={async () => {
                            const { data } = await supabase.storage.from('invoices').download(inv.url)
                            if (data) {
                              const url = URL.createObjectURL(data)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = inv.filename
                              a.click()
                              URL.revokeObjectURL(url)
                            }
                          }}
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-green-100 text-green-600 font-bold"
                          title="Download"
                        >
                          ↓
                        </button>
                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => {
                            const filtered = (product.supplier_invoices as any[] ?? []).filter(i => i.id !== inv.id)
                            setField('supplier_invoices', filtered)
                          }}
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-100 text-red-500 font-bold"
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    </div>

                    {/* Qty & Cost */}
                    <div className="flex justify-between items-center text-xs mb-2 bg-gray-50 p-1 rounded">
                      {inv.quantity ? (
                        <span className="text-blue-700 font-semibold font-mono">+{inv.quantity} Qty</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}

                      <div className="flex flex-col items-end">
                        {inv.unit_cost_gross ? (
                          <span className="text-gray-700 font-medium">€{Number(inv.unit_cost_gross).toFixed(2)}/u</span>
                        ) : null}
                        {inv.currency && inv.currency !== 'EUR' && (
                          <span className="text-[10px] text-gray-500">
                            ({inv.currency === 'USD' ? '$' : inv.currency === 'GBP' ? '£' : inv.currency}
                            {Number(inv.original_unit_cost || 0).toFixed(2)})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    {inv.description && (
                      <p className="text-xs text-gray-600 mb-2 truncate" title={inv.description}>{inv.description}</p>
                    )}

                    <div className="text-[10px] text-gray-400 mt-auto truncate">{inv.filename}</div>

                    {/* Preview Area (Hidden by default) */}
                    <div className="preview-container hidden mt-2 border-t pt-2 w-full transition-all">
                      <div className="text-xs text-center text-gray-400 animate-pulse">Loading preview...</div>
                    </div>
                  </div>
                ))}

              {(!product.supplier_invoices || (product.supplier_invoices as any[]).length === 0) && (
                <div className="text-sm text-gray-400 italic p-4 border border-dashed rounded w-full text-center">
                  No invoices uploaded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Images & Discounts Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Images */}
        <div className="md:col-span-1 bg-white p-6 rounded-xl border shadow-sm h-fit">
          <h3 className="font-semibold text-gray-800 border-b pb-2 mb-4">Product Images</h3>
          <div className="flex gap-2 items-center">
            <input
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
            />
            <button
              type="button"
              onClick={async (e) => {
                e.preventDefault()
                const newUrls = await uploadFiles()
                if (newUrls.length > 0) {
                  setField('images', [...(product.images ?? []), ...newUrls])
                }
              }}
              disabled={!files.length || uploading}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${!files.length || uploading
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700 shadow-sm'
                }`}
            >
              {uploading ? 'Uploading...' : 'Upload Selected'}
            </button>
          </div>

          <div className="mt-2 flex gap-2 flex-wrap">
            {(product.images ?? []).map((img: string, i: number) => (
              <div
                key={i}
                className="relative w-24 h-24 rounded overflow-hidden border group cursor-move"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('sourceIndex', i.toString())
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const sourceIndex = parseInt(e.dataTransfer.getData('sourceIndex'), 10)
                  if (isNaN(sourceIndex) || sourceIndex === i) return

                  const newImages = [...(product.images ?? [])]
                  const [movedItem] = newImages.splice(sourceIndex, 1)
                  newImages.splice(i, 0, movedItem)
                  setField('images', newImages)
                }}
              >
                <img src={img} alt={`img-${i}`} className="object-cover w-full h-full" />

                {/* Default Label */}
                {i === 0 && (
                  <div className="absolute top-0 left-0 bg-green-600 text-white text-[10px] px-1.5 py-0.5 font-bold shadow-sm">
                    Default
                  </div>
                )}

                {/* Remove Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    const newImages = [...(product.images ?? [])]
                    newImages.splice(i, 1)
                    setField('images', newImages)
                  }}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-600"
                  title="Remove Image"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">Drag and drop to reorder. The first image is the default.</p>
        </div>

        {/* Quantity Discounts */}
        <div className="overflow-x-auto bg-white p-6 rounded-xl border shadow-sm h-fit">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-4 gap-2 border-b pb-2">
            <div>
              <h3 className="font-semibold text-gray-800">Quantity Discounts</h3>
              <p className="text-xs text-gray-500">Define manual price overrides for bulk quantities.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  // MLPE Presets
                  const baseB2C = product.price_eur || 0
                  const baseB2B = product.b2b_price_eur || 0
                  const presets = [
                    { quantity: 20, unit_price: baseB2C, unit_price_b2b: baseB2B, label: 'Box' },
                    { quantity: 300, unit_price: baseB2C, unit_price_b2b: baseB2B, label: '1/4 Pallet' },
                    { quantity: 600, unit_price: baseB2C, unit_price_b2b: baseB2B, label: '1/2 Pallet' },
                    { quantity: 1200, unit_price: baseB2C, unit_price_b2b: baseB2B, label: 'Full Pallet' },
                    { quantity: 1201, unit_price: baseB2C, unit_price_b2b: baseB2B, label: '> 1 Pallet' },
                  ]
                  setField('quantity_discounts', presets)
                }}
                className="btn btn-xs btn-outline"
              >
                Load MLPE Presets
              </button>
              <button
                type="button"
                onClick={() => {
                  // Standard Presets
                  const baseB2C = product.price_eur || 0
                  const baseB2B = product.b2b_price_eur || 0
                  const presets = [
                    { quantity: 5, unit_price: baseB2C, unit_price_b2b: baseB2B, label: 'Small Bulk' },
                    { quantity: 10, unit_price: baseB2C, unit_price_b2b: baseB2B, label: 'Medium Bulk' },
                    { quantity: 50, unit_price: baseB2C, unit_price_b2b: baseB2B, label: 'Large Bulk' },
                    { quantity: 100, unit_price: baseB2C, unit_price_b2b: baseB2B, label: 'Wholesale' },
                  ]
                  setField('quantity_discounts', presets)
                }}
                className="btn btn-xs btn-outline"
              >
                Load Standard Presets
              </button>
            </div>
          </div>

          {/* Discount Table */}
          <div className="bg-gray-50 rounded-lg border overflow-hidden w-full">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-left text-xs uppercase text-gray-500 font-semibold">
                <tr>
                  <th className="px-3 py-2">Label</th>
                  <th className="px-3 py-2 w-20">Min Qty</th>
                  <th className="px-3 py-2 w-24">B2C Net (€)</th>
                  <th className="px-3 py-2 w-24">B2B Net (€)</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {/* Base Tier (Read Only) */}
                <tr className="bg-blue-50/50 italic text-gray-500">
                  <td className="px-2 py-1 pl-3 text-xs">Base Price (1 Unit)</td>
                  <td className="px-2 py-1 text-center text-xs">1</td>
                  <td className="px-2 py-1 text-right text-xs">€{(product.price_eur || 0).toFixed(2)}</td>
                  <td className="px-2 py-1 text-right text-xs">€{(product.b2b_price_eur || 0).toFixed(2)}</td>
                  <td className="px-2 py-1"></td>
                </tr>

                {(product.quantity_discounts ?? []).map((tier, idx) => (
                  <tr key={idx} className="bg-white">
                    <td className="px-2 py-1">
                      <input
                        type="text"
                        value={tier.label || ''}
                        onChange={(e) => {
                          const newTiers = [...(product.quantity_discounts || [])]
                          newTiers[idx] = { ...newTiers[idx], label: e.target.value }
                          setField('quantity_discounts', newTiers)
                        }}
                        className="border-none w-full focus:ring-0 bg-transparent"
                        placeholder="e.g. Pallet"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        value={tier.quantity}
                        onChange={(e) => {
                          const newTiers = [...(product.quantity_discounts || [])]
                          newTiers[idx] = { ...newTiers[idx], quantity: Number(e.target.value) }
                          setField('quantity_discounts', newTiers)
                        }}
                        className="border rounded w-full px-2 py-1 text-center"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        step="0.01"
                        value={tier.unit_price}
                        onChange={(e) => {
                          const newTiers = [...(product.quantity_discounts || [])]
                          newTiers[idx] = { ...newTiers[idx], unit_price: Number(e.target.value) }
                          setField('quantity_discounts', newTiers)
                        }}
                        className="border rounded w-full px-2 py-1 text-right font-medium text-gray-700"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        step="0.01"
                        value={tier.unit_price_b2b ?? 0}
                        onChange={(e) => {
                          const newTiers = [...(product.quantity_discounts || [])]
                          newTiers[idx] = { ...newTiers[idx], unit_price_b2b: Number(e.target.value) }
                          setField('quantity_discounts', newTiers)
                        }}
                        className="border rounded w-full px-2 py-1 text-right font-medium text-gray-700"
                      />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          const newTiers = [...(product.quantity_discounts || [])]
                          newTiers.splice(idx, 1)
                          setField('quantity_discounts', newTiers)
                        }}
                        className="text-red-400 hover:text-red-600 font-bold"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
                {(!product.quantity_discounts || product.quantity_discounts.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-center text-gray-400 italic text-xs">
                      No discount tiers defined. Click a preset above or add manual.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <button
              type="button"
              onClick={() => {
                const newTiers = [...(product.quantity_discounts || []), { quantity: 0, unit_price: 0, label: '' }]
                setField('quantity_discounts', newTiers)
              }}
              className="w-full py-2 text-xs text-blue-600 font-medium hover:bg-blue-50 border-t"
            >
              + Add Custom Tier
            </button>
          </div>
        </div>



        {/* Related Products Card */}
        <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
          <div className="border-b pb-2">
            <h3 className="font-semibold text-gray-800">Related Products</h3>
            <p className="text-xs text-gray-500">Select products to display as related items on the product page</p>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search products by name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border rounded w-full px-3 py-2 mb-3"
          />

          {/* Selected Products */}
          {(product.related_products ?? []).length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-700 mb-2">Selected ({(product.related_products ?? []).length}):</p>
              <div className="flex flex-wrap gap-2">
                {(product.related_products ?? []).map(relId => {
                  const relProduct = allProducts.find(p => p.id === relId)
                  if (!relProduct) return null
                  return (
                    <div key={relId} className="flex items-center gap-2 bg-green-50 border border-green-200 rounded px-3 py-1">
                      <span className="text-sm">{relProduct.name_en}</span>
                      <button
                        type="button"
                        onClick={() => toggleRelatedProduct(relId)}
                        className="text-red-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Product List */}
          <div className="border rounded max-h-64 overflow-y-auto max-w-3xl">
            {allProducts
              .filter(p => {
                // Exclude current product
                if (p.id === product.id) return false
                // Filter by search term
                if (searchTerm) {
                  const term = searchTerm.toLowerCase()
                  return p.name_en.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)
                }
                return true
              })
              .map(p => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-2 hover:bg-gray-50 border-b last:border-b-0 cursor-pointer"
                  onClick={() => toggleRelatedProduct(p.id)}
                >
                  <input
                    type="checkbox"
                    checked={(product.related_products ?? []).includes(p.id)}
                    onChange={() => toggleRelatedProduct(p.id)}
                    className="w-4 h-4"
                  />
                  {p.images && p.images[0] && (
                    <img src={p.images[0]} alt={p.name_en} className="w-10 h-10 object-cover rounded" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{p.name_en}</p>
                    <p className="text-xs text-gray-500">{p.sku}</p>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Sales History Card */}
        <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
          <h3 className="font-semibold text-gray-700 mb-2">Sales History Log</h3>
          <div className="overflow-x-auto bg-white border rounded-lg max-h-60 overflow-y-auto max-w-3xl">
            <table className="table table-compact w-full">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                  <th>Order #</th>
                </tr>
              </thead>
              <tbody>
                {salesHistoryLoading ? (
                  <tr><td colSpan={6} className="text-center py-4">Loading history...</td></tr>
                ) : salesHistory.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-4 text-gray-400 italic">No sales found for this product.</td></tr>
                ) : (
                  salesHistory.map((item: any) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="text-xs">{new Date(item.created_at).toLocaleDateString()}</td>
                      <td className="text-xs font-medium truncate max-w-[150px]">
                        {item.orders?.company_name || item.orders?.customer_email || 'Unknown'}
                      </td>
                      <td className="font-bold text-blue-600">{item.quantity}</td>
                      <td className="text-xs">€{item.unit_price.toFixed(2)}</td>
                      <td className="text-xs font-semibold">€{item.total_price.toFixed(2)}</td>
                      <td className="text-xs text-gray-500">
                        <span className="badge badge-ghost badge-xs">{item.orders?.order_number}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {mounted && document.getElementById('product-header-actions') && createPortal(
        <div className="flex gap-3 items-center">
          <button
            onClick={save}
            disabled={saving || uploading}
            className={`btn btn-sm h-9 btn-primary min-w-[120px] flex items-center justify-center gap-2 transition-all shadow-sm rounded-lg text-sm ${saving ? 'opacity-80 cursor-wait' : ''}`}
            title="Save Product/Changes"
          >
            {saving ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              'Save Product/Changes'
            )}
          </button>

          {product.id && product.name_en && (
            <button
              onClick={handleDelete}
              disabled={deleting || saving}
              className="btn btn-sm h-9 min-w-[120px] bg-red-600 hover:bg-red-700 text-white border-none flex items-center justify-center gap-2 shadow-sm font-medium whitespace-nowrap transition-all rounded-lg text-sm"
              title="Delete Product"
            >
              {deleting ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Deleting...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Delete
                </>
              )}
            </button>
          )}
        </div>,
        document.getElementById('product-header-actions')!
      )}
    </div >
  )
}
