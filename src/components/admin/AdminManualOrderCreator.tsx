'use client'

import React, { useState, useEffect } from 'react'
import { searchProductsAction } from '@/app/actions/products'
import { searchCustomersAction, getCustomerLatestOrderAction } from '@/app/actions/customers'
import { adminCreateOrderWithCustomerAction, issueOrderInvoiceAction } from '@/app/actions/admin'
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
}

export default function AdminManualOrderCreator({ onClose, onCreated, isInvoiceMode = false }: { onClose: () => void, onCreated: () => void, isInvoiceMode?: boolean }) {
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
    const [items, setItems] = useState<{
        product_id: string
        product_name: string
        sku: string
        quantity: number
        unit_price: number
        b2c_price?: number
        b2b_price?: number | null
    }[]>([])
    const [vatRate, setVatRate] = useState(22)
    const [shippingCost, setShippingCost] = useState(0)
    const [market, setMarket] = useState('si')
    const [paymentMethod, setPaymentMethod] = useState('IBAN')
    const [billingSame, setBillingSame] = useState(true)
    const [pickupInPerson, setPickupInPerson] = useState(false)

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

    // Load all products on mount
    useEffect(() => {
        searchProductsAction('').then(r => {
            if (r.success) setProductResults(r.data as any)
        })
    }, [])

    const filteredProducts = productSearch.trim()
        ? productResults.filter(p =>
            p.name_en.toLowerCase().includes(productSearch.toLowerCase()) ||
            p.sku.toLowerCase().includes(productSearch.toLowerCase())
          )
        : productResults

    // Logic for automatic VAT adjustment
    useEffect(() => {
        if (selectedCustomer.is_b2b) {
            setVatRate(0)
        } else {
            const currentMarketKey = market.toUpperCase()
            const region = MARKETS[currentMarketKey]
            if (region) {
                setVatRate(region.vatRate * 100)
            }
        }
    }, [selectedCustomer.is_b2b, market])

    // Reprice existing items when B2B mode changes
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
        }])
        setProductSearch('')
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
        if (!pickupInPerson && (!shippingAddress.street || !shippingAddress.city)) {
            alert('Shipping address is required (or select Pickup in Person)')
            return
        }

        setLoading(true)
        try {
            const res = await adminCreateOrderWithCustomerAction({
                customer: selectedCustomer as any,
                order: {
                    market,
                    shipping_cost: pickupInPerson ? 0 : shippingCost,
                    vat_rate: vatRate,
                    payment_method: paymentMethod,
                    items,
                    shipping_address: pickupInPerson
                        ? { street: 'Pickup in Person', city: 'Podsmreka', postal_code: '1356', country: 'SI' }
                        : shippingAddress,
                    billing_address: billingSame ? undefined : billingAddress,
                    internal_notes: pickupInPerson ? 'Pickup in Person' : undefined,
                }
            })

            if (res.success) {
                const orderId = res.data?.orderId

                if (isInvoiceMode && orderId) {
                    await issueOrderInvoiceAction(orderId)
                }

                alert(isInvoiceMode ? 'Order and Invoice created successfully' : 'Order created successfully')
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
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 my-4" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
                {/* Header */}
                <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">{isInvoiceMode ? 'Create One-Off Invoice' : 'Create Order from Scratch'}</h2>
                        <p className="text-xs text-slate-500 mt-1">{isInvoiceMode ? 'Generate a manual document for a customer instantly.' : 'Select/Create customer, add addresses and products to generate a manual order.'}</p>
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
                                                            is_b2b: !!customer.is_b2b
                                                        })
                                                        setCustomerSearch('')
                                                        setCustomerResults([])

                                                        // Normalize address fields (customer addresses use postalCode, orders use postal_code)
                                                        const normalizeAddr = (a: any) => ({
                                                            street: a.street || '',
                                                            street2: a.street2 || '',
                                                            city: a.city || '',
                                                            postal_code: a.postalCode || a.postal_code || '',
                                                            country: (a.country || 'SI').toUpperCase()
                                                        })

                                                        // Try saved customer addresses first
                                                        const shipAddr = customer.addresses?.find((a: any) => a.isDefaultShipping) || customer.addresses?.[0]
                                                        if (shipAddr) {
                                                            setShippingAddress(normalizeAddr(shipAddr))
                                                            const billAddr = customer.addresses?.find((a: any) => a.isDefaultBilling && !a.isDefaultShipping)
                                                            if (billAddr) {
                                                                setBillingAddress(normalizeAddr(billAddr))
                                                                setBillingSame(false)
                                                            } else {
                                                                setBillingSame(true)
                                                            }
                                                        } else {
                                                            // Fallback: use latest order's shipping address
                                                            const res = await getCustomerLatestOrderAction(customer.id)
                                                            if (res.success && res.data?.shipping_address) {
                                                                setShippingAddress(normalizeAddr(res.data.shipping_address))
                                                            }
                                                            if (res.success && res.data?.billing_address) {
                                                                const bill = res.data.billing_address as any
                                                                const ship = res.data.shipping_address as any
                                                                if (bill.street !== ship?.street || bill.city !== ship?.city) {
                                                                    setBillingAddress(normalizeAddr(bill))
                                                                    setBillingSame(false)
                                                                } else {
                                                                    setBillingSame(true)
                                                                }
                                                            }
                                                        }
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
                                            onChange={e => {
                                                const isB2b = e.target.checked
                                                setSelectedCustomer({ ...selectedCustomer, is_b2b: isB2b })
                                                if (isB2b) setVatRate(0)
                                            }}
                                            className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                                        />
                                        <label htmlFor="is_b2b" className="text-xs font-bold text-slate-600 select-none cursor-pointer uppercase">B2B Mode</label>
                                    </div>
                                </div>
                            </section>

                            {/* Address Section */}
                            <section className="space-y-4">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center font-bold">2</span>
                                        <h3 className="font-bold text-slate-800 uppercase tracking-wider text-sm">Shipping & Billing</h3>
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={pickupInPerson}
                                            onChange={e => {
                                                setPickupInPerson(e.target.checked)
                                                if (e.target.checked) setShippingCost(0)
                                            }}
                                            className="w-4 h-4 text-green-600 rounded cursor-pointer"
                                        />
                                        <span className="text-xs font-bold text-slate-600 uppercase">Pickup in Person</span>
                                    </label>
                                </div>

                                {pickupInPerson && (
                                    <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 font-medium">
                                        Customer will pick up at: Podsmreka, 1356 (shipping cost €0)
                                    </div>
                                )}

                                <div className={`grid grid-cols-2 gap-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 ${pickupInPerson ? 'opacity-40 pointer-events-none' : ''}`}>
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
                                                    if (!selectedCustomer.is_b2b) {
                                                        setVatRate(region.vatRate * 100)
                                                    }
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

                            <div className="flex gap-2 mb-3">
                                <div className="relative flex-1">
                                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                    <input
                                        type="text"
                                        placeholder="Filter by name or SKU..."
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all hover:border-slate-300"
                                    />
                                    {productSearch && (
                                        <button type="button" onClick={() => setProductSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={addCustomItem}
                                    className="bg-green-50 text-green-700 px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-green-100 transition-colors border border-green-200 whitespace-nowrap"
                                >
                                    + Custom Item
                                </button>
                            </div>

                            {/* Product List */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <div className="bg-slate-50 px-3 py-2 flex items-center justify-between border-b border-slate-200">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                        {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
                                        {productSearch ? ` matching "${productSearch}"` : ''}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${selectedCustomer.is_b2b ? 'bg-blue-100 text-blue-700' : 'text-slate-400'}`}>
                                        {selectedCustomer.is_b2b ? 'B2B prices' : 'B2C prices'}
                                    </span>
                                </div>
                                <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                                    {filteredProducts.length === 0 ? (
                                        <p className="p-4 text-sm text-slate-400 text-center">No products found</p>
                                    ) : filteredProducts.map(p => {
                                        const stock = p.stock_quantity ?? 0
                                        const inStock = stock > 0
                                        const price = selectedCustomer.is_b2b && p.b2b_price_eur ? p.b2b_price_eur : p.price_eur
                                        return (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => addItem(p)}
                                                className="w-full text-left px-4 py-3 hover:bg-green-50 flex items-center gap-3 transition-colors group"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-medium text-slate-900 group-hover:text-green-700 text-sm truncate">{p.name_en}</span>
                                                        {!inStock && (
                                                            <span className="text-[9px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase">Out of stock</span>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 font-mono">{p.sku}</span>
                                                </div>
                                                <div className="flex items-center gap-3 flex-shrink-0">
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${inStock ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-500'}`}>
                                                        {inStock ? `${stock} in stock` : '0'}
                                                    </span>
                                                    <div className="text-right">
                                                        {selectedCustomer.is_b2b && p.b2b_price_eur && p.b2b_price_eur !== p.price_eur && (
                                                            <div className="text-[10px] text-slate-400 line-through">€{p.price_eur.toFixed(2)}</div>
                                                        )}
                                                        <span className={`font-bold text-sm ${selectedCustomer.is_b2b && p.b2b_price_eur ? 'text-blue-700' : 'text-slate-900'}`}>
                                                            €{price.toFixed(2)}
                                                        </span>
                                                    </div>
                                                    <svg className="w-4 h-4 text-slate-300 group-hover:text-green-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

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
                                        if (region && !selectedCustomer.is_b2b) {
                                            setVatRate(region.vatRate * 100)
                                        }
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
                                    <span className={pickupInPerson ? 'text-slate-400 line-through' : 'text-slate-500'}>Shipping</span>
                                    {pickupInPerson
                                        ? <span className="text-slate-400 text-xs font-medium italic">Pickup in person</span>
                                        : <span className="font-semibold text-slate-900">€{shippingCost.toFixed(2)}</span>
                                    }
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
                                ) : isInvoiceMode ? 'Create & Issue Invoice' : 'Create & Send Email'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
