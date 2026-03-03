'use client'

import React, { useState, useEffect } from 'react'
import { searchProductsAction } from '@/app/actions/products'
import { searchCustomersAction } from '@/app/actions/customers'
import { adminCreateOrderWithCustomerAction } from '@/app/actions/admin'
import { MARKETS } from '@/lib/constants/markets'

interface ProductSnippet {
    id: string
    name_en: string
    sku: string
    price_eur: number
    b2b_price_eur?: number | null
    weight_kg: number
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
}

export default function AdminManualOrderCreator({ onClose, onCreated }: { onClose: () => void, onCreated: () => void }) {
    const [loading, setLoading] = useState(false)

    // Customer Data
    const [customerSearch, setCustomerSearch] = useState('')
    const [customerResults, setCustomerResults] = useState<CustomerSnippet[]>([])
    const [selectedCustomer, setSelectedCustomer] = useState<Partial<CustomerSnippet>>({
        email: '',
        first_name: '',
        last_name: '',
        company_name: '',
        vat_id: '',
        phone: '',
        is_b2b: false
    })

    // Order Data
    const [items, setItems] = useState<{ product_id: string, product_name: string, sku: string, quantity: number, unit_price: number }[]>([])
    const [vatRate, setVatRate] = useState(22)
    const [shippingCost, setShippingCost] = useState(0)
    const [market, setMarket] = useState('si')
    const [paymentMethod, setPaymentMethod] = useState('IBAN')
    const [billingSame, setBillingSame] = useState(true)

    const [shippingAddress, setShippingAddress] = useState({
        street: '',
        street2: '',
        city: '',
        postal_code: '',
        country: 'SI'
    })

    const [billingAddress, setBillingAddress] = useState({
        street: '',
        street2: '',
        city: '',
        postal_code: '',
        country: 'SI'
    })

    // Product Search
    const [productSearch, setProductSearch] = useState('')
    const [productResults, setProductResults] = useState<ProductSnippet[]>([])

    useEffect(() => {
        if (customerSearch.length > 2) {
            const delay = setTimeout(async () => {
                const results = await searchCustomersAction(customerSearch)
                if (results.success) {
                    setCustomerResults(results.data as any)
                }
            }, 300)
            return () => clearTimeout(delay)
        } else {
            setCustomerResults([])
        }
    }, [customerSearch])

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
        const price = selectedCustomer.is_b2b && p.b2b_price_eur ? p.b2b_price_eur : p.price_eur
        setItems([...items, {
            product_id: p.id,
            product_name: p.name_en,
            sku: p.sku,
            quantity: 1,
            unit_price: price || 0
        }])
        setProductSearch('')
        setProductResults([])
    }

    const addCustomItem = () => {
        setItems([...items, {
            product_id: 'custom-' + Date.now(),
            product_name: 'Custom Product',
            sku: 'CUSTOM',
            quantity: 1,
            unit_price: 0
        }])
    }

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index))
    }

    const updateItemQty = (index: number, qty: number) => {
        const newItems = [...items]
        newItems[index].quantity = Math.max(1, qty)
        setItems(newItems)
    }

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault()
        if (!selectedCustomer.email) {
            alert('Email is required')
            return
        }
        if (items.length === 0) {
            alert('Add at least one item')
            return
        }
        if (!shippingAddress.street || !shippingAddress.city) {
            alert('Shipping address is required')
            return
        }

        setLoading(true)
        try {
            const res = await adminCreateOrderWithCustomerAction({
                customer: selectedCustomer as any,
                order: {
                    market,
                    shipping_cost: shippingCost,
                    vat_rate: vatRate,
                    payment_method: paymentMethod,
                    items,
                    shipping_address: shippingAddress,
                    billing_address: billingSame ? undefined : billingAddress
                }
            })

            if (res.success) {
                alert('Order created successfully')
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

    // Get sorted countries from MARKETS
    const allRegions = Object.values(MARKETS)
        .filter(m => m.key !== 'SHOP' && m.key !== 'EU')
        .sort((a, b) => a.countryName.localeCompare(b.countryName))

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl min-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Create Order from Scratch</h2>
                        <p className="text-xs text-slate-500 mt-1">Select/Create customer, add addresses and products to generate a manual order.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left Side - Customer & Products & Addresses */}
                    <div className="flex-1 p-8 overflow-y-auto border-r border-slate-100 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Customer Section */}
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold">1</span>
                                    <h3 className="font-bold text-slate-800 uppercase tracking-wider text-sm">Customer Information</h3>
                                </div>

                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search existing customer (email, name...)"
                                        value={customerSearch}
                                        onChange={(e) => setCustomerSearch(e.target.value)}
                                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all pr-10 hover:border-slate-300"
                                    />
                                    {customerResults.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                            {customerResults.map(c => (
                                                <button
                                                    key={c.id}
                                                    type="button"
                                                    onClick={() => {
                                                        const customer = c as any
                                                        setSelectedCustomer({
                                                            id: customer.id,
                                                            email: customer.email || '',
                                                            first_name: customer.first_name || '',
                                                            last_name: customer.last_name || '',
                                                            company_name: customer.company_name || '',
                                                            vat_id: customer.vat_id || '',
                                                            phone: customer.phone || '',
                                                            is_b2b: !!customer.is_b2b
                                                        })
                                                        // Pre-fill shipping address
                                                        const shipAddr = customer.addresses?.find((a: any) => a.type === 'shipping') || customer.addresses?.[0]
                                                        if (shipAddr) {
                                                            setShippingAddress({
                                                                street: shipAddr.street || '',
                                                                street2: shipAddr.street2 || '',
                                                                city: shipAddr.city || '',
                                                                postal_code: shipAddr.postal_code || '',
                                                                country: shipAddr.country?.toUpperCase() || 'SI'
                                                            })
                                                        }
                                                        // Pre-fill billing address
                                                        const billAddr = customer.addresses?.find((a: any) => a.type === 'billing')
                                                        if (billAddr) {
                                                            setBillingAddress({
                                                                street: billAddr.street || '',
                                                                street2: billAddr.street2 || '',
                                                                city: billAddr.city || '',
                                                                postal_code: billAddr.postal_code || '',
                                                                country: billAddr.country?.toUpperCase() || 'SI'
                                                            })
                                                            setBillingSame(false)
                                                        } else {
                                                            setBillingSame(true)
                                                        }
                                                        setCustomerSearch('')
                                                        setCustomerResults([])
                                                    }}
                                                    className="w-full text-left p-3 hover:bg-slate-50 flex flex-col border-b last:border-0 border-slate-100"
                                                >
                                                    <span className="font-medium text-slate-900">{c.first_name} {c.last_name || c.company_name}</span>
                                                    <span className="text-xs text-slate-500">{c.email}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email Address</label>
                                        <input
                                            required
                                            type="email"
                                            value={selectedCustomer.email}
                                            onChange={e => setSelectedCustomer({ ...selectedCustomer, email: e.target.value })}
                                            className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">First Name</label>
                                        <input
                                            type="text"
                                            value={selectedCustomer.first_name || ''}
                                            onChange={e => setSelectedCustomer({ ...selectedCustomer, first_name: e.target.value })}
                                            className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Last Name</label>
                                        <input
                                            type="text"
                                            value={selectedCustomer.last_name || ''}
                                            onChange={e => setSelectedCustomer({ ...selectedCustomer, last_name: e.target.value })}
                                            className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg outline-none"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Company Name</label>
                                        <input
                                            type="text"
                                            value={selectedCustomer.company_name || ''}
                                            onChange={e => setSelectedCustomer({ ...selectedCustomer, company_name: e.target.value })}
                                            className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">VAT ID</label>
                                        <input
                                            type="text"
                                            value={selectedCustomer.vat_id || ''}
                                            onChange={e => setSelectedCustomer({ ...selectedCustomer, vat_id: e.target.value })}
                                            className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg outline-none font-mono uppercase text-xs"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 mt-4">
                                        <input
                                            type="checkbox"
                                            id="is_b2b"
                                            checked={selectedCustomer.is_b2b}
                                            onChange={e => setSelectedCustomer({ ...selectedCustomer, is_b2b: e.target.checked })}
                                            className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                                        />
                                        <label htmlFor="is_b2b" className="text-xs font-bold text-slate-600 select-none cursor-pointer uppercase">B2B Mode</label>
                                    </div>
                                </div>
                            </section>

                            {/* Address Section */}
                            <section className="space-y-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center font-bold">2</span>
                                    <h3 className="font-bold text-slate-800 uppercase tracking-wider text-sm">Shipping & Billing</h3>
                                </div>

                                <div className="grid grid-cols-2 gap-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Street Address</label>
                                        <input
                                            type="text"
                                            placeholder="Shipping Street"
                                            value={shippingAddress.street}
                                            onChange={e => setShippingAddress({ ...shippingAddress, street: e.target.value })}
                                            className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg outline-none"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <input
                                            type="text"
                                            placeholder="Address line 2"
                                            value={shippingAddress.street2}
                                            onChange={e => setShippingAddress({ ...shippingAddress, street2: e.target.value })}
                                            className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg outline-none"
                                        />
                                    </div>
                                    <div>
                                        <input
                                            type="text"
                                            placeholder="City"
                                            value={shippingAddress.city}
                                            onChange={e => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                                            className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg outline-none"
                                        />
                                    </div>
                                    <div>
                                        <input
                                            type="text"
                                            placeholder="Postal"
                                            value={shippingAddress.postal_code}
                                            onChange={e => setShippingAddress({ ...shippingAddress, postal_code: e.target.value })}
                                            className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg outline-none"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <select
                                            value={shippingAddress.country}
                                            onChange={e => {
                                                const country = e.target.value
                                                setShippingAddress({ ...shippingAddress, country })
                                                // Sync market context if not manually overridden or just for better defaults
                                                const region = allRegions.find(r => r.country === country)
                                                if (region) {
                                                    setMarket(region.key.toLowerCase())
                                                    setVatRate(region.vatRate * 100)
                                                }
                                            }}
                                            className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg outline-none appearance-none"
                                        >
                                            <option value="">-- Select Country --</option>
                                            {allRegions.map(r => (
                                                <option key={r.country} value={r.country}>{r.countryName}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="col-span-2 flex items-center gap-3 mt-4 pt-4 border-t border-slate-200/60">
                                        <input
                                            type="checkbox"
                                            id="billing_same"
                                            checked={billingSame}
                                            onChange={e => setBillingSame(e.target.checked)}
                                            className="w-4 h-4 text-orange-600 rounded cursor-pointer"
                                        />
                                        <label htmlFor="billing_same" className="text-xs font-bold text-slate-600 select-none cursor-pointer uppercase">Billing same as shipping</label>
                                    </div>
                                </div>

                                {!billingSame && (
                                    <div className="bg-orange-50/30 p-4 rounded-2xl border border-orange-100 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <h4 className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Billing Address Override</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="col-span-2">
                                                <input
                                                    type="text"
                                                    placeholder="Billing Street"
                                                    value={billingAddress.street}
                                                    onChange={e => setBillingAddress({ ...billingAddress, street: e.target.value })}
                                                    className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg outline-none"
                                                />
                                            </div>
                                            <div>
                                                <input
                                                    type="text"
                                                    placeholder="City"
                                                    value={billingAddress.city}
                                                    onChange={e => setBillingAddress({ ...billingAddress, city: e.target.value })}
                                                    className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg outline-none"
                                                />
                                            </div>
                                            <div>
                                                <input
                                                    type="text"
                                                    placeholder="Postal"
                                                    value={billingAddress.postal_code}
                                                    onChange={e => setBillingAddress({ ...billingAddress, postal_code: e.target.value })}
                                                    className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg outline-none"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <select
                                                    value={billingAddress.country}
                                                    onChange={e => setBillingAddress({ ...billingAddress, country: e.target.value })}
                                                    className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg outline-none appearance-none"
                                                >
                                                    <option value="">-- Select Country --</option>
                                                    {allRegions.map(r => (
                                                        <option key={r.country} value={r.country}>{r.countryName}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </section>
                        </div>

                        {/* Order Items Section */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center font-bold">3</span>
                                <h3 className="font-bold text-slate-800 uppercase tracking-wider text-sm">Add Products</h3>
                            </div>

                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Search products (SKU, name...)"
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all pr-10 hover:border-slate-300"
                                />
                                <button
                                    type="button"
                                    onClick={addCustomItem}
                                    className="bg-green-50 text-green-700 px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-green-100 transition-colors border border-green-200 whitespace-nowrap"
                                >
                                    + Custom Item
                                </button>
                            </div>
                            {productResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                    {productResults.map(p => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => addItem(p)}
                                            className="w-full text-left p-3 hover:bg-slate-50 flex items-center justify-between border-b last:border-0 border-slate-100"
                                        >
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-900">{p.name_en}</span>
                                                <span className="text-[10px] text-slate-400 uppercase tracking-tighter">{p.sku}</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="font-bold text-slate-900">€{selectedCustomer.is_b2b && p.b2b_price_eur ? p.b2b_price_eur : p.price_eur}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {items.length > 0 && (
                                <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                            <tr>
                                                <th className="py-3 px-4">Product Details</th>
                                                <th className="py-3 px-4 text-center w-24">Qty</th>
                                                <th className="py-3 px-4 text-right w-32">Unit Price</th>
                                                <th className="py-3 px-4 text-right w-32">Total</th>
                                                <th className="py-3 px-4 w-12"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {items.map((item, idx) => (
                                                <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                                                    <td className="py-3 px-4">
                                                        {item.product_id?.startsWith('custom-') ? (
                                                            <div className="flex flex-col gap-1">
                                                                <input
                                                                    type="text"
                                                                    value={item.product_name}
                                                                    onChange={(e) => {
                                                                        const newItems = [...items]
                                                                        newItems[idx].product_name = e.target.value
                                                                        setItems(newItems)
                                                                    }}
                                                                    className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-sm font-medium focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                                                                    placeholder="Product Name"
                                                                />
                                                                <span className="text-[10px] text-slate-400 uppercase font-black">Custom Item</span>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="font-medium text-slate-800">{item.product_name}</div>
                                                                <div className="text-[10px] text-slate-400 uppercase">{item.sku}</div>
                                                            </>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <input
                                                            type="number"
                                                            value={item.quantity}
                                                            onChange={(e) => updateItemQty(idx, parseInt(e.target.value))}
                                                            className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-center font-bold bg-white focus:border-blue-500 outline-none"
                                                        />
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="relative group/price">
                                                            <span className="absolute left-2 top-1.5 text-slate-400 text-sm group-focus-within/price:text-blue-500 transition-colors">€</span>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={item.unit_price}
                                                                onChange={(e) => {
                                                                    const newItems = [...items]
                                                                    newItems[idx].unit_price = parseFloat(e.target.value) || 0
                                                                    setItems(newItems)
                                                                }}
                                                                className="w-full pl-6 pr-2 py-1.5 border border-slate-300 rounded-lg text-right font-black bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                                                        €{(item.unit_price * item.quantity).toFixed(2)}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <button type="button" onClick={() => removeItem(idx)} className="p-1 text-slate-300 hover:text-red-500 transition-colors">
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
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
                    <div className="w-96 bg-slate-50 p-8 flex flex-col border-l border-slate-100 shadow-[inset_1px_0_0_0_rgba(0,0,0,0.02)]">
                        <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs mb-6">Order Summary</h3>

                        <div className="space-y-4 flex-1">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Market Context</label>
                                <select
                                    value={market}
                                    onChange={e => {
                                        const m = e.target.value
                                        setMarket(m)
                                        const region = MARKETS[m.toUpperCase()]
                                        if (region) setVatRate(region.vatRate * 100)
                                    }}
                                    className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg text-sm appearance-none outline-none focus:border-blue-500 shadow-sm"
                                >
                                    <option value="shop">International (SHOP)</option>
                                    {allRegions.map(r => (
                                        <option key={r.key} value={r.key.toLowerCase()}>{r.countryName} ({r.key})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Payment Method</label>
                                <select
                                    value={paymentMethod}
                                    onChange={e => setPaymentMethod(e.target.value)}
                                    className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg text-sm appearance-none outline-none focus:border-blue-500 shadow-sm"
                                >
                                    <option value="IBAN">IBAN Bank Transfer</option>
                                    <option value="WISE">Quick Pay (Wise/Card)</option>
                                    <option value="CASH">Cash on Delivery</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Shipping (€)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={shippingCost}
                                        onChange={e => setShippingCost(parseFloat(e.target.value) || 0)}
                                        className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none font-bold text-slate-700"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">VAT (%)</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        value={vatRate}
                                        onChange={e => setVatRate(parseFloat(e.target.value) || 0)}
                                        className="w-full bg-white px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none font-bold text-slate-700"
                                    />
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-200 space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Subtotal</span>
                                    <span className="font-semibold text-slate-900">€{subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Shipping</span>
                                    <span className="font-semibold text-slate-900">€{shippingCost.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">VAT ({vatRate}%)</span>
                                    <span className="font-semibold text-slate-900">€{vatAmount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-2xl font-black text-slate-900 pt-6">
                                    <span>Total</span>
                                    <span className="text-blue-600">€{total.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 space-y-3">
                            <p className="text-[10px] text-slate-400 leading-tight">By creating this order, an account will be created if not exists. The customer will receive an email with login details and payment instructions.</p>
                            <button
                                onClick={() => handleSubmit()}
                                disabled={loading || items.length === 0}
                                className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-slate-200 transition-all flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Processing...
                                    </>
                                ) : 'Create & Send Email'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
