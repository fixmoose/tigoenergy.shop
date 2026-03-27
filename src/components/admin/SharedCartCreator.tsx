'use client'

import React, { useState, useEffect } from 'react'
import { searchProductsAction } from '@/app/actions/products'

interface ProductSnippet {
    id: string
    name_en: string
    sku: string
    price_eur: number
    b2b_price_eur?: number | null
}

export default function SharedCartCreator() {
    const [loading, setLoading] = useState(false)
    const [items, setItems] = useState<{
        product_id: string,
        product_name: string,
        sku: string,
        quantity: number,
        unit_price: number,
        price_eur: number,
        b2b_price_eur?: number | null
    }[]>([])

    // Product Search
    const [productSearch, setProductSearch] = useState('')
    const [productResults, setProductResults] = useState<ProductSnippet[]>([])
    const [sharedLink, setSharedLink] = useState<string | null>(null)
    const [isB2b, setIsB2b] = useState(false)

    useEffect(() => {
        if (productSearch.length > 2) {
            const delay = setTimeout(async () => {
                const results = await searchProductsAction(productSearch)
                if (results.success) {
                    setProductResults(results.data as any)
                }
            }, 300)
            return () => clearTimeout(delay)
        } else {
            setProductResults([])
        }
    }, [productSearch])

    const addItem = (p: ProductSnippet) => {
        const price = isB2b && p.b2b_price_eur ? p.b2b_price_eur : p.price_eur
        setItems([...items, {
            product_id: p.id,
            product_name: p.name_en,
            sku: p.sku,
            quantity: 1,
            unit_price: price || 0,
            price_eur: p.price_eur,
            b2b_price_eur: p.b2b_price_eur
        }])
        setProductSearch('')
        setProductResults([])
    }

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index))
    }

    const updateItemQty = (index: number, qty: number) => {
        const newItems = [...items]
        newItems[index].quantity = Math.max(1, qty)
        setItems(newItems)
    }

    const toggleB2b = (val: boolean) => {
        setIsB2b(val)
        const updated = items.map(item => {
            const price = val && item.b2b_price_eur ? item.b2b_price_eur : item.price_eur
            return { ...item, unit_price: price || 0 }
        })
        setItems(updated)
    }

    const generateLink = async () => {
        if (items.length === 0) return
        setLoading(true)
        try {
            // We'll create a new cart in the database
            const res = await fetch('/api/admin/shared-carts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items, is_b2b: isB2b })
            })
            const data = await res.json()
            if (data.success) {
                const link = `${window.location.origin}/cart/share/${data.cartId}`
                setSharedLink(link)
            } else {
                alert('Error creating shared cart: ' + data.error)
            }
        } catch (err: any) {
            alert('Error: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const copyToClipboard = () => {
        if (!sharedLink) return
        navigator.clipboard.writeText(sharedLink)
        alert('Link copied to clipboard!')
    }

    const subtotal = items.reduce((acc, item) => acc + (item.unit_price * item.quantity), 0)

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-50">
                <h2 className="text-xl font-bold text-slate-900">Create & Share a Cart</h2>
                <p className="text-sm text-slate-500 mt-1">Add items to build a pre-filled cart for a customer. Copy the link or email it to them.</p>
            </div>

            <div className="p-8 space-y-8">
                {/* Search */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="relative">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-widest">Search Products</label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="SKU or Product Name..."
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all pr-12"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                        </div>

                        {productResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white border border-slate-100 rounded-xl shadow-2xl max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
                                {productResults.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => addItem(p)}
                                        className="w-full text-left p-4 hover:bg-slate-50 flex items-center justify-between border-b last:border-0 border-slate-50 group transition-colors"
                                    >
                                        <div>
                                            <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors uppercase text-sm tracking-tight">{p.name_en}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{p.sku}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-black text-slate-900">€{(isB2b && p.b2b_price_eur ? p.b2b_price_eur : p.price_eur).toFixed(2)}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col justify-end">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-widest">Pricing Mode</label>
                        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100 w-fit">
                            <button
                                onClick={() => toggleB2b(false)}
                                className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${!isB2b ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                B2C
                            </button>
                            <button
                                onClick={() => toggleB2b(true)}
                                className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${isB2b ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                B2B
                            </button>
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Cart Contents</h3>
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-full font-bold">{items.length} Items</span>
                    </div>

                    {items.length === 0 ? (
                        <div className="py-12 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-300">
                            <svg className="w-12 h-12 mb-3 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            <p className="text-sm font-medium">No products added yet.</p>
                        </div>
                    ) : (
                        <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                    <tr>
                                        <th className="py-4 px-6">Product</th>
                                        <th className="py-4 px-6 w-32 text-center">Quantity</th>
                                        <th className="py-4 px-6 w-32 text-right">Unit Price</th>
                                        <th className="py-4 px-6 w-32 text-right">Subtotal</th>
                                        <th className="py-4 px-6 w-16"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {items.map((item, idx) => (
                                        <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                                            <td className="py-4 px-6">
                                                <div className="font-bold text-slate-800 text-sm tracking-tight">{item.product_name}</div>
                                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{item.sku}</div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center justify-center">
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => updateItemQty(idx, parseInt(e.target.value))}
                                                        className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-center font-black text-slate-700 bg-white focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                                                    />
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <div className="font-bold text-slate-600">€{item.unit_price.toFixed(2)}</div>
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <div className="font-black text-slate-900">€{(item.unit_price * item.quantity).toFixed(2)}</div>
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                <button onClick={() => removeItem(idx)} className="text-slate-200 hover:text-red-500 transition-colors">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50/50 border-t border-slate-100">
                                    <tr>
                                        <td colSpan={3} className="py-4 px-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Total EUR</td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="text-xl font-black text-blue-600">€{subtotal.toFixed(2)}</div>
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-6 pt-4">
                    {!sharedLink ? (
                        <button
                            onClick={generateLink}
                            disabled={loading || items.length === 0}
                            className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-slate-200 disabled:opacity-50 flex items-center justify-center gap-3 active:scale-[0.98]"
                        >
                            {loading ? (
                                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                    Generate Shareable Link
                                </>
                            )}
                        </button>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100/50">
                                <label className="block text-[10px] font-black text-blue-600 uppercase mb-3 tracking-[0.2em]">Your Share Link</label>
                                <div className="flex gap-2">
                                    <input
                                        readOnly
                                        value={sharedLink}
                                        className="flex-1 bg-white border border-blue-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-600 outline-none"
                                    />
                                    <button
                                        onClick={copyToClipboard}
                                        className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition-all flex items-center gap-2 whitespace-nowrap"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                        Copy Link
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <a
                                    href={`mailto:?subject=Your Initra Energija Cart&body=Hello, here is a link to your shopping cart with the items we discussed: ${sharedLink}`}
                                    className="flex items-center justify-center gap-2 py-4 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                    Email Link
                                </a>
                                <button
                                    onClick={() => { setSharedLink(null); setItems([]); }}
                                    className="flex items-center justify-center gap-2 py-4 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all"
                                >
                                    Create Another
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
