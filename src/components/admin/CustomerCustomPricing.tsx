'use client'

import { useState } from 'react'
import type { Product, CustomerCustomPricing as CustomPricingType } from '@/types/database'
import { saveCustomerCustomPrice, deleteCustomerCustomPrice } from '@/app/actions/pricing'

interface CustomerCustomPricingProps {
    customerId: string
    products: Partial<Product>[]
    initialCustomPricing: CustomPricingType[]
}

export default function CustomerCustomPricing({
    customerId,
    products,
    initialCustomPricing
}: CustomerCustomPricingProps) {
    const [selectedProductId, setSelectedProductId] = useState('')
    const [pricingType, setPricingType] = useState<'simple' | 'tiered'>('simple')
    const [fixedPrice, setFixedPrice] = useState(0)
    const [tierPrices, setTierPrices] = useState<{ min_qty: number; price: number }[]>([
        { min_qty: 1, price: 0 }
    ])
    const [loading, setLoading] = useState(false)

    const handleAddTier = () => {
        setTierPrices([...tierPrices, { min_qty: 1, price: 0 }])
    }

    const handleRemoveTier = (index: number) => {
        setTierPrices(tierPrices.filter((_, i) => i !== index))
    }

    const handleUpdateTier = (index: number, field: 'min_qty' | 'price', value: number) => {
        const newTiers = [...tierPrices]
        newTiers[index] = { ...newTiers[index], [field]: value }
        setTierPrices(newTiers)
    }

    const handleSave = async () => {
        if (!selectedProductId) return
        setLoading(true)
        try {
            const payload: any = {
                customer_id: customerId,
                product_id: selectedProductId,
                pricing_type: pricingType
            }

            if (pricingType === 'simple') {
                payload.fixed_price_eur = fixedPrice
                payload.tier_prices = null
            } else {
                payload.fixed_price_eur = null
                payload.tier_prices = tierPrices
            }

            await saveCustomerCustomPrice(payload)
            window.location.reload()
        } catch (error) {
            alert((error as Error).message)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Remove this override?')) return
        try {
            await deleteCustomerCustomPrice(id, customerId)
            window.location.reload()
        } catch (error) {
            alert((error as Error).message)
        }
    }

    return (
        <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                <div>
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Item-Level Overrides</h3>
                    <p className="text-sm font-bold text-gray-900 mt-0.5">Custom Quotes & Tiered Pricing</p>
                </div>
            </div>

            <div className="p-8 space-y-6">
                {/* Existing Overrides */}
                <div className="space-y-3">
                    {initialCustomPricing.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">No direct item overrides for this customer.</p>
                    ) : (
                        initialCustomPricing.map(cp => (
                            <div key={cp.id} className="flex items-center justify-between p-4 bg-amber-50/50 rounded-2xl border border-amber-100">
                                <div>
                                    <div className="font-bold text-amber-900">{cp.product?.name_en || 'Unknown Product'}</div>
                                    <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest mt-0.5">
                                        {cp.pricing_type === 'simple'
                                            ? `Fixed: ${cp.price_eur} EUR`
                                            : `Tiered: ${cp.tier_prices?.length} scales`}
                                    </div>
                                    {cp.pricing_type === 'tiered' && cp.tier_prices && (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {cp.tier_prices.map((t, idx) => (
                                                <span key={idx} className="bg-white px-1.5 py-0.5 rounded text-[9px] font-bold text-amber-600 border border-amber-100">
                                                    {t.min_qty}+: {t.price} EUR
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleDelete(cp.id)}
                                    className="text-amber-300 hover:text-red-500 transition-colors font-bold text-xl"
                                >
                                    &times;
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Create New Override */}
                <div className="pt-6 border-t border-gray-50">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Add New Override</h4>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Select Product</label>
                                <select
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-amber-500"
                                    value={selectedProductId}
                                    onChange={e => setSelectedProductId(e.target.value)}
                                >
                                    <option value="">Choose item...</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.name_en} ({p.sku})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Price Configuration</label>
                                <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-200">
                                    <button
                                        onClick={() => setPricingType('simple')}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${pricingType === 'simple' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-400'}`}
                                    >
                                        Fixed
                                    </button>
                                    <button
                                        onClick={() => setPricingType('tiered')}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-black uppercase transition-all ${pricingType === 'tiered' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-400'}`}
                                    >
                                        Tiered
                                    </button>
                                </div>
                            </div>
                        </div>

                        {pricingType === 'simple' ? (
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Fixed Price (EUR)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-amber-500"
                                    placeholder="Enter price..."
                                    value={fixedPrice}
                                    onChange={e => setFixedPrice(Number(e.target.value))}
                                />
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Quantity Tiers</label>
                                    <button
                                        onClick={handleAddTier}
                                        className="text-[10px] font-black text-amber-600 uppercase hover:underline"
                                    >
                                        + Add Scale
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {tierPrices.map((tier, idx) => (
                                        <div key={idx} className="flex gap-2 items-center">
                                            <div className="flex-1 flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 gap-2">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Min Qty</span>
                                                <input
                                                    type="number"
                                                    className="w-full bg-transparent outline-none text-sm font-bold text-gray-900"
                                                    value={tier.min_qty}
                                                    onChange={e => handleUpdateTier(idx, 'min_qty', Number(e.target.value))}
                                                />
                                            </div>
                                            <div className="flex-1 flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 gap-2">
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Price</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    className="w-full bg-transparent outline-none text-sm font-bold text-gray-900"
                                                    value={tier.price}
                                                    onChange={e => handleUpdateTier(idx, 'price', Number(e.target.value))}
                                                />
                                            </div>
                                            {tierPrices.length > 1 && (
                                                <button
                                                    onClick={() => handleRemoveTier(idx)}
                                                    className="text-gray-300 hover:text-red-500 transition-colors"
                                                >
                                                    &times;
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleSave}
                            disabled={loading || !selectedProductId}
                            className="w-full bg-amber-600 text-white py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-amber-700 transition shadow-lg disabled:opacity-50"
                        >
                            {loading ? 'Saving Override...' : 'Save Override'}
                        </button>
                    </div>
                </div>
            </div>
        </section>
    )
}
