'use client'

import React, { useState, useEffect } from 'react'
import { searchProductsAction } from '@/app/actions/products'
import { searchCustomersAction, getCustomerLatestOrderAction } from '@/app/actions/customers'
import { adminCreateQuoteAction } from '@/app/actions/quotes'
import { MARKETS } from '@/lib/constants/markets'

interface ProductSnippet {
    id: string
    name_en: string
    sku: string
    price_eur: number
    b2b_price_eur?: number | null
    weight_kg: number
    stock_quantity?: number | null
}

interface CustomerSnippet {
    id: string
    email: string
    first_name: string | null
    last_name: string | null
    company_name: string | null
    vat_id: string | null
    phone: string | null
    is_b2b: boolean
    addresses?: any[]
    payment_terms?: string | null
    payment_terms_days?: number | null
}

interface PrefillItem {
    product_id: string
    product_name: string
    sku: string
    quantity: number
    unit_price: number
    weight_kg?: number
}

interface PrefillCustomer {
    id?: string
    email?: string | null
    first_name?: string | null
    last_name?: string | null
    company_name?: string | null
    vat_id?: string | null
    phone?: string | null
    is_b2b?: boolean
    addresses?: any[]
}

interface AdminQuoteCreatorProps {
    onClose: () => void
    onCreated: () => void
    prefillItems?: PrefillItem[]
    prefillCustomer?: PrefillCustomer | null
}

export default function AdminQuoteCreator({ onClose, onCreated, prefillItems, prefillCustomer }: AdminQuoteCreatorProps) {
    const [loading, setLoading] = useState(false)

    // Customer Data
    const [customerSearch, setCustomerSearch] = useState('')
    const [customerResults, setCustomerResults] = useState<CustomerSnippet[]>([])
    const [selectedCustomer, setSelectedCustomer] = useState<Partial<CustomerSnippet>>(
        prefillCustomer ? {
            id: prefillCustomer.id,
            email: prefillCustomer.email || '',
            first_name: prefillCustomer.first_name || '',
            last_name: prefillCustomer.last_name || '',
            company_name: prefillCustomer.company_name || '',
            vat_id: prefillCustomer.vat_id || '',
            phone: prefillCustomer.phone || '',
            is_b2b: !!prefillCustomer.is_b2b,
            addresses: prefillCustomer.addresses || [],
        } : {
            email: '',
            first_name: '',
            last_name: '',
            company_name: '',
            vat_id: '',
            phone: '',
            is_b2b: false
        }
    )

    // Quote Data
    const [items, setItems] = useState<{
        product_id: string
        product_name: string
        sku: string
        quantity: number
        unit_price: number
        b2c_price?: number
        b2b_price?: number | null
        weight_kg?: number
    }[]>(prefillItems?.map(it => ({
        product_id: it.product_id,
        product_name: it.product_name,
        sku: it.sku,
        quantity: it.quantity,
        unit_price: it.unit_price,
        weight_kg: it.weight_kg,
    })) ?? [])
    const prefillAddr = prefillCustomer?.addresses?.find((a: any) => a.isDefaultShipping && !a.isViesAddress)
        || prefillCustomer?.addresses?.find((a: any) => !a.isViesAddress)
        || prefillCustomer?.addresses?.[0]

    const [vatRate, setVatRate] = useState(22)
    const [shippingCost, setShippingCost] = useState(0)
    const prefillCountry = prefillAddr?.country?.toUpperCase()
    const prefillMarket = prefillCountry ? Object.values(MARKETS).find(m => m.country === prefillCountry) : null
    const [market, setMarket] = useState(prefillMarket?.key.toLowerCase() || 'si')
    const [language, setLanguage] = useState('sl')
    const [expiresDays, setExpiresDays] = useState(30)
    const [internalNotes, setInternalNotes] = useState('')
    const [includeAddress, setIncludeAddress] = useState(!!prefillCustomer?.addresses?.length)
    const [shippingAddrMode, setShippingAddrMode] = useState<'manual' | string>('manual')

    const [shippingAddress, setShippingAddress] = useState(
        prefillAddr ? {
            street: prefillAddr.street || '',
            street2: prefillAddr.street2 || '',
            city: prefillAddr.city || '',
            postal_code: prefillAddr.postalCode || prefillAddr.postal_code || '',
            country: (prefillAddr.country || 'SI').toUpperCase()
        } : {
            street: '',
            street2: '',
            city: '',
            postal_code: '',
            country: 'SI'
        }
    )

    const normalizeAddr = (a: any) => ({
        street: a.street || '',
        street2: a.street2 || '',
        city: a.city || '',
        postal_code: a.postalCode || a.postal_code || '',
        country: (a.country || 'SI').toUpperCase()
    })

    const customerAddresses = (selectedCustomer as any)?.addresses as any[] | undefined

    // Product Search
    const [productSearch, setProductSearch] = useState('')
    const [productResults, setProductResults] = useState<ProductSnippet[]>([])

    useEffect(() => {
        if (customerSearch.length > 2) {
            const delay = setTimeout(async () => {
                const results = await searchCustomersAction(customerSearch)
                if (results.success) setCustomerResults(results.data as any)
            }, 300)
            return () => clearTimeout(delay)
        } else {
            setCustomerResults([])
        }
    }, [customerSearch])

    useEffect(() => {
        searchProductsAction('').then(r => {
            if (r.success) {
                setProductResults(r.data as any)
                // Enrich prefilled items with b2b/b2c prices from catalog
                if (prefillItems && prefillItems.length > 0) {
                    const catalog = r.data as ProductSnippet[]
                    setItems(prev => prev.map(item => {
                        if (item.b2c_price !== undefined) return item // already enriched
                        const match = catalog.find(p => p.id === item.product_id || p.sku === item.sku)
                        if (!match) return item
                        const isB2B = !!selectedCustomer.is_b2b
                        const b2bPrice = match.b2b_price_eur ?? null
                        const b2cPrice = match.price_eur
                        return {
                            ...item,
                            b2c_price: b2cPrice,
                            b2b_price: b2bPrice,
                            unit_price: isB2B && b2bPrice ? b2bPrice : b2cPrice,
                        }
                    }))
                }
            }
        })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const filteredProducts = productSearch.trim()
        ? productResults.filter(p =>
            p.name_en.toLowerCase().includes(productSearch.toLowerCase()) ||
            p.sku.toLowerCase().includes(productSearch.toLowerCase())
        )
        : productResults

    // VAT auto-adjustment
    useEffect(() => {
        const region = MARKETS[market.toUpperCase()]
        if (selectedCustomer.is_b2b && market !== 'si') {
            setVatRate(0)
        } else if (region) {
            setVatRate(region.vatRate * 100)
        }
    }, [selectedCustomer.is_b2b, market])

    // Reprice items on B2B toggle
    useEffect(() => {
        setItems(prev => prev.map(item => {
            if (item.product_id?.startsWith('custom-') || item.b2c_price === undefined) return item
            const newPrice = selectedCustomer.is_b2b && item.b2b_price
                ? item.b2b_price
                : (item.b2c_price ?? item.unit_price)
            return { ...item, unit_price: newPrice }
        }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCustomer.is_b2b])

    const addItem = (p: ProductSnippet) => {
        const price = selectedCustomer.is_b2b && p.b2b_price_eur ? p.b2b_price_eur : p.price_eur
        setItems(prev => [...prev, {
            product_id: p.id,
            product_name: p.name_en,
            sku: p.sku,
            quantity: 1,
            unit_price: price || 0,
            b2c_price: p.price_eur,
            b2b_price: p.b2b_price_eur ?? null,
            weight_kg: p.weight_kg,
        }])
        setProductSearch('')
    }

    const addCustomItem = () => {
        setItems([...items, {
            product_id: 'custom-' + Date.now(),
            product_name: 'Custom Product',
            sku: 'CUSTOM',
            quantity: 1,
            unit_price: 0,
        }])
    }

    const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index))
    const updateItemQty = (index: number, qty: number) => {
        const newItems = [...items]
        newItems[index].quantity = Math.max(1, qty)
        setItems(newItems)
    }

    const handleSubmit = async (sendImmediately: boolean) => {
        if (!selectedCustomer.email) return alert('Email is required')
        if (items.length === 0) return alert('Add at least one item')

        setLoading(true)
        try {
            const res = await adminCreateQuoteAction({
                customer: selectedCustomer as any,
                quote: {
                    market,
                    language,
                    shipping_cost: shippingCost,
                    vat_rate: vatRate / 100,
                    items,
                    shipping_address: includeAddress ? shippingAddress : undefined,
                    internal_notes: internalNotes || undefined,
                    expires_days: expiresDays,
                },
                sendImmediately,
            })

            if (res.success) {
                alert(sendImmediately ? `Quote ${res.quoteNumber} created and sent!` : `Quote ${res.quoteNumber} saved as draft`)
                onCreated()
                onClose()
            } else {
                alert(res.error)
            }
        } catch (err: any) {
            alert(err.message)
        } finally {
            setLoading(false)
        }
    }

    const subtotal = items.reduce((acc, item) => acc + (item.unit_price * item.quantity), 0)
    const vatAmount = (subtotal + shippingCost) * (vatRate / 100)
    const total = subtotal + shippingCost + vatAmount

    const allRegions = Object.values(MARKETS)
        .filter(m => m.key !== 'SHOP' && m.key !== 'EU')
        .sort((a, b) => a.countryName.localeCompare(b.countryName))

    const LANG_OPTIONS = [
        { code: 'sl', label: 'Slovenščina' },
        { code: 'hr', label: 'Hrvatski' },
        { code: 'de', label: 'Deutsch' },
        { code: 'en', label: 'English' },
        { code: 'it', label: 'Italiano' },
        { code: 'fr', label: 'Français' },
        { code: 'cs', label: 'Čeština' },
        { code: 'pl', label: 'Polski' },
    ]

    return (
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 my-4" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
                {/* Header */}
                <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Create Quote / Ponudba</h2>
                        <p className="text-xs text-slate-500 mt-1">Create a quote for a customer. They will receive an email with a link to accept it.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left Side */}
                    <div className="flex-1 p-8 overflow-y-auto border-r border-slate-100 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Customer Section */}
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold">1</span>
                                    <h3 className="font-bold text-slate-800 uppercase tracking-wider text-sm">Customer</h3>
                                </div>

                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search existing customer..."
                                        value={customerSearch}
                                        onChange={(e) => setCustomerSearch(e.target.value)}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    />
                                    {customerResults.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                            {customerResults.map(c => (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={async () => {
                                                        const customer = c as any
                                                        setSelectedCustomer({
                                                            id: customer.id,
                                                            email: customer.email || '',
                                                            first_name: customer.first_name || '',
                                                            last_name: customer.last_name || '',
                                                            company_name: customer.company_name || '',
                                                            vat_id: customer.vat_id || '',
                                                            phone: customer.phone || '',
                                                            is_b2b: !!customer.is_b2b,
                                                            addresses: customer.addresses || [],
                                                        })
                                                        setCustomerSearch('')
                                                        setCustomerResults([])

                                                        // Auto-set address if available
                                                        const shipAddr = customer.addresses?.find((a: any) => a.isDefaultShipping && !a.isViesAddress)
                                                            || customer.addresses?.find((a: any) => !a.isViesAddress)
                                                            || customer.addresses?.[0]

                                                        if (shipAddr) {
                                                            setShippingAddress(normalizeAddr(shipAddr))
                                                            setShippingAddrMode(shipAddr.id || 'manual')
                                                            setIncludeAddress(true)

                                                            const country = (shipAddr.country || 'SI').toUpperCase()
                                                            const matchedMarket = Object.values(MARKETS).find(m => m.country === country)
                                                            if (matchedMarket) setMarket(matchedMarket.key.toLowerCase())
                                                        }

                                                        // Try to load latest order for more address info
                                                        if (customer.id) {
                                                            try {
                                                                const latest = await getCustomerLatestOrderAction(customer.id)
                                                                if (latest.success && latest.data?.shipping_address && !shipAddr) {
                                                                    setShippingAddress(normalizeAddr(latest.data.shipping_address))
                                                                    setIncludeAddress(true)
                                                                }
                                                            } catch { }
                                                        }
                                                    }}
                                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center gap-2 border-b last:border-b-0"
                                                >
                                                    <span className="font-medium">{c.first_name} {c.last_name}</span>
                                                    <span className="text-slate-400 text-sm">{c.email}</span>
                                                    {c.company_name && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{c.company_name}</span>}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <input placeholder="Email *" value={selectedCustomer.email || ''} onChange={e => setSelectedCustomer({ ...selectedCustomer, email: e.target.value })} className="px-3 py-2 border rounded-lg text-sm col-span-2" />
                                    <input placeholder="First Name" value={selectedCustomer.first_name || ''} onChange={e => setSelectedCustomer({ ...selectedCustomer, first_name: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                                    <input placeholder="Last Name" value={selectedCustomer.last_name || ''} onChange={e => setSelectedCustomer({ ...selectedCustomer, last_name: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                                    <input placeholder="Company" value={selectedCustomer.company_name || ''} onChange={e => setSelectedCustomer({ ...selectedCustomer, company_name: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                                    <input placeholder="VAT ID" value={selectedCustomer.vat_id || ''} onChange={e => setSelectedCustomer({ ...selectedCustomer, vat_id: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                                </div>

                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={selectedCustomer.is_b2b || false} onChange={e => setSelectedCustomer({ ...selectedCustomer, is_b2b: e.target.checked })} className="rounded" />
                                    B2B Customer
                                </label>
                            </section>

                            {/* Settings Section */}
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center font-bold">2</span>
                                    <h3 className="font-bold text-slate-800 uppercase tracking-wider text-sm">Settings</h3>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-slate-500 block mb-1">Market</label>
                                        <select value={market} onChange={e => setMarket(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                                            {allRegions.map(r => (
                                                <option key={r.key} value={r.key.toLowerCase()}>{r.countryName} ({r.country})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 block mb-1">Quote Language</label>
                                        <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm">
                                            {LANG_OPTIONS.map(l => (
                                                <option key={l.code} value={l.code}>{l.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 block mb-1">VAT Rate (%)</label>
                                        <input type="number" value={vatRate} onChange={e => setVatRate(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border rounded-lg text-sm" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 block mb-1">Shipping Cost (€)</label>
                                        <input type="number" step="0.01" value={shippingCost} onChange={e => setShippingCost(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border rounded-lg text-sm" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-500 block mb-1">Valid for (days)</label>
                                        <input type="number" value={expiresDays} onChange={e => setExpiresDays(parseInt(e.target.value) || 30)} className="w-full px-3 py-2 border rounded-lg text-sm" />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-slate-500 block mb-1">Internal Notes</label>
                                    <textarea value={internalNotes} onChange={e => setInternalNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Only visible to admin..." />
                                </div>
                            </section>
                        </div>

                        {/* Optional Address */}
                        <section className="space-y-4">
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                <input type="checkbox" checked={includeAddress} onChange={e => setIncludeAddress(e.target.checked)} className="rounded" />
                                Pre-fill shipping address (optional — customer can choose at acceptance)
                            </label>

                            {includeAddress && (
                                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                                    {customerAddresses && customerAddresses.length > 0 && (
                                        <select value={shippingAddrMode} onChange={e => {
                                            setShippingAddrMode(e.target.value)
                                            if (e.target.value !== 'manual') {
                                                const addr = customerAddresses.find((a: any) => a.id === e.target.value)
                                                if (addr) setShippingAddress(normalizeAddr(addr))
                                            }
                                        }} className="w-full px-3 py-2 border rounded-lg text-sm">
                                            <option value="manual">Enter manually</option>
                                            {customerAddresses.map((a: any) => (
                                                <option key={a.id} value={a.id}>
                                                    {a.label || a.street} — {a.city}, {a.country}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                    <div className="grid grid-cols-2 gap-3">
                                        <input placeholder="Street" value={shippingAddress.street} onChange={e => setShippingAddress({ ...shippingAddress, street: e.target.value })} className="col-span-2 px-3 py-2 border rounded-lg text-sm" />
                                        <input placeholder="City" value={shippingAddress.city} onChange={e => setShippingAddress({ ...shippingAddress, city: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                                        <input placeholder="Postal Code" value={shippingAddress.postal_code} onChange={e => setShippingAddress({ ...shippingAddress, postal_code: e.target.value })} className="px-3 py-2 border rounded-lg text-sm" />
                                        <input placeholder="Country" value={shippingAddress.country} onChange={e => setShippingAddress({ ...shippingAddress, country: e.target.value.toUpperCase() })} className="px-3 py-2 border rounded-lg text-sm" />
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* Products Section */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center font-bold">3</span>
                                <h3 className="font-bold text-slate-800 uppercase tracking-wider text-sm">Products</h3>
                            </div>

                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search products..."
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none"
                                />
                                {productSearch && filteredProducts.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                        {filteredProducts.slice(0, 20).map(p => (
                                            <button key={p.id} type="button" onClick={() => addItem(p)}
                                                className="w-full text-left px-4 py-3 hover:bg-amber-50 flex items-center justify-between border-b last:border-b-0">
                                                <div>
                                                    <span className="font-medium text-sm">{p.name_en}</span>
                                                    <span className="text-xs text-slate-400 ml-2">{p.sku}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="font-semibold text-sm">€{(selectedCustomer.is_b2b && p.b2b_price_eur ? p.b2b_price_eur : p.price_eur).toFixed(2)}</span>
                                                    {p.stock_quantity != null && (
                                                        <span className={`ml-2 text-xs ${p.stock_quantity > 0 ? 'text-amber-600' : 'text-red-500'}`}>
                                                            ({p.stock_quantity})
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button type="button" onClick={addCustomItem}
                                className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                                + Add Custom Item
                            </button>

                            {items.length > 0 && (
                                <div className="border rounded-xl overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                                            <tr>
                                                <th className="text-left px-4 py-2">Product</th>
                                                <th className="text-left px-4 py-2">SKU</th>
                                                <th className="text-center px-4 py-2 w-20">Qty</th>
                                                <th className="text-right px-4 py-2 w-28">Unit Price</th>
                                                <th className="text-right px-4 py-2 w-24">Total</th>
                                                <th className="w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {items.map((item, i) => (
                                                <tr key={i}>
                                                    <td className="px-4 py-2">
                                                        {item.product_id.startsWith('custom-') ? (
                                                            <input value={item.product_name} onChange={e => {
                                                                const n = [...items]; n[i].product_name = e.target.value; setItems(n)
                                                            }} className="px-2 py-1 border rounded text-sm w-full" />
                                                        ) : (
                                                            <span className="font-medium">{item.product_name}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-2 text-slate-400">{item.sku}</td>
                                                    <td className="px-4 py-2 text-center">
                                                        <input type="number" min="1" value={item.quantity} onChange={e => updateItemQty(i, parseInt(e.target.value))}
                                                            className="w-16 text-center px-2 py-1 border rounded text-sm" />
                                                    </td>
                                                    <td className="px-4 py-2 text-right">
                                                        <input type="number" step="0.01" value={item.unit_price} onChange={e => {
                                                            const n = [...items]; n[i].unit_price = parseFloat(e.target.value) || 0; setItems(n)
                                                        }} className="w-24 text-right px-2 py-1 border rounded text-sm" />
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-medium">
                                                        €{(item.unit_price * item.quantity).toFixed(2)}
                                                    </td>
                                                    <td className="px-2 py-2">
                                                        <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    </div>

                    {/* Right Side - Summary */}
                    <div className="w-80 p-8 bg-slate-50/80 flex flex-col overflow-y-auto">
                        <div className="flex items-center gap-2 mb-6">
                            <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center font-bold">$</span>
                            <h3 className="font-bold text-slate-800 uppercase tracking-wider text-sm">Quote Summary</h3>
                        </div>

                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Subtotal ({items.length} items)</span>
                                <span className="font-semibold">€{subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Shipping</span>
                                <span className="font-semibold">€{shippingCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">VAT ({vatRate}%)</span>
                                <span className="font-semibold">€{vatAmount.toFixed(2)}</span>
                            </div>
                            <div className="border-t pt-3 flex justify-between text-lg">
                                <span className="font-bold text-slate-800">Total</span>
                                <span className="font-bold text-amber-600">€{total.toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-700">
                            Valid for <strong>{expiresDays} days</strong> from creation. Customer will choose shipping or pickup when accepting.
                        </div>

                        <div className="mt-auto pt-8 space-y-3">
                            <button
                                onClick={() => handleSubmit(true)}
                                disabled={loading || items.length === 0}
                                className="w-full py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 disabled:opacity-50 transition-colors"
                            >
                                {loading ? 'Creating...' : 'Save & Send to Customer'}
                            </button>
                            <button
                                onClick={() => handleSubmit(false)}
                                disabled={loading || items.length === 0}
                                className="w-full py-3 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 disabled:opacity-50 transition-colors"
                            >
                                Save as Draft
                            </button>
                            <button
                                onClick={onClose}
                                className="w-full py-2 text-slate-400 text-sm hover:text-slate-600"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
