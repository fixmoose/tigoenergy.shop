'use client'

import { useState, useEffect, useCallback } from 'react'
import { useCart } from '@/contexts/CartContext'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useRouter } from 'next/navigation'
import type { Product } from '@/types/database'

// Short labels for the optimizer models
const OPTIMIZER_LABELS: Record<string, { short: string; full: string; desc: string; series: string }> = {
    'TS4-A-O': { short: 'A-O', full: 'TS4-A-O', desc: 'Optimization', series: 'A' },
    'TS4-A-F': { short: 'A-F', full: 'TS4-A-F', desc: 'Fire Safety', series: 'A' },
    'TS4-X-O': { short: 'X-O', full: 'TS4-X-O', desc: 'Optimization (X)', series: 'X' },
    'TS4-A-2F': { short: 'A-2F', full: 'TS4-A-2F', desc: 'Dual Fire Safety', series: 'A' },
}

function classifyProduct(sku: string): string | null {
    const s = sku.toUpperCase()
    if (s.includes('TS4-A-2F')) return 'TS4-A-2F'
    if (s.includes('TS4-A-O')) return 'TS4-A-O'
    if (s.includes('TS4-A-F')) return 'TS4-A-F'
    if (s.includes('TS4-X-O')) return 'TS4-X-O'
    if (s.includes('CCA')) return 'CCA'
    if (s.includes('RSS')) return 'RSS'
    return null
}

type Step = 'model' | 'qty' | 'accessories' | 'acc_qty' | 'summary'

export default function QuickOrderPage() {
    const { addItem, openDrawer, items: cartItems } = useCart()
    const { formatPrice, formatPriceNet, isB2B } = useCurrency()
    const router = useRouter()

    const [optimizers, setOptimizers] = useState<Product[]>([])
    const [accessories, setAccessories] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)

    // Flow state
    const [step, setStep] = useState<Step>('model')
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
    const [quantity, setQuantity] = useState(20)
    const [selectedAccessories, setSelectedAccessories] = useState<Map<string, { product: Product; qty: number }>>(new Map())

    // Fetch products
    useEffect(() => {
        fetch('/api/quick-order')
            .then(r => r.json())
            .then(data => {
                setOptimizers(data.optimizers || [])
                setAccessories(data.accessories || [])
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const stockAvailable = useCallback((p: Product) => {
        if (p.stock_status === 'out_of_stock') return 0
        if (p.stock_status === 'available_to_order') return 999999
        return Math.max(0, (p.stock_quantity ?? 0) - (p.reserved_quantity ?? 0))
    }, [])

    const getPrice = useCallback((p: Product, qty: number) => {
        // Check quantity discounts
        if (p.quantity_discounts && p.quantity_discounts.length > 0) {
            const sorted = [...p.quantity_discounts].sort((a, b) => b.quantity - a.quantity)
            for (const tier of sorted) {
                if (qty >= tier.quantity) {
                    return isB2B && tier.unit_price_b2b ? tier.unit_price_b2b : tier.unit_price
                }
            }
        }
        return isB2B && p.b2b_price_eur ? p.b2b_price_eur : p.price_eur
    }, [isB2B])

    const unitsPerBox = selectedProduct?.units_per_box || (classifyProduct(selectedProduct?.sku || '')?.startsWith('TS4-X') ? 18 : 20)

    // Add all items to cart
    async function handleAddToCart() {
        setSubmitting(true)
        try {
            // Add optimizer
            if (selectedProduct && quantity > 0) {
                await addItem({
                    product_id: selectedProduct.id,
                    sku: selectedProduct.sku,
                    name: selectedProduct.name_en,
                    quantity,
                    unit_price: getPrice(selectedProduct, quantity),
                    image_url: selectedProduct.images?.[0],
                    weight_kg: selectedProduct.weight_kg,
                    metadata: { category: selectedProduct.category, subcategory: selectedProduct.subcategory }
                })
            }

            // Add accessories
            for (const [, { product, qty }] of selectedAccessories) {
                if (qty > 0) {
                    await addItem({
                        product_id: product.id,
                        sku: product.sku,
                        name: product.name_en,
                        quantity: qty,
                        unit_price: getPrice(product, qty),
                        image_url: product.images?.[0],
                        weight_kg: product.weight_kg,
                        metadata: { category: product.category, subcategory: product.subcategory }
                    })
                }
            }

            openDrawer()
            router.push('/checkout')
        } catch (err) {
            console.error('Quick order add error:', err)
        } finally {
            setSubmitting(false)
        }
    }

    function toggleAccessory(product: Product) {
        const next = new Map(selectedAccessories)
        const key = product.id
        if (next.has(key)) {
            next.delete(key)
        } else {
            next.set(key, { product, qty: quantity }) // default to same qty as optimizer
        }
        setSelectedAccessories(next)
    }

    function updateAccessoryQty(productId: string, qty: number) {
        const next = new Map(selectedAccessories)
        const entry = next.get(productId)
        if (entry) {
            next.set(productId, { ...entry, qty: Math.max(1, qty) })
            setSelectedAccessories(next)
        }
    }

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="w-8 h-8 border-3 border-green-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    const optimizerPrice = selectedProduct ? getPrice(selectedProduct, quantity) : 0
    const optimizerTotal = optimizerPrice * quantity
    let accessoriesTotal = 0
    for (const [, { product, qty }] of selectedAccessories) {
        accessoriesTotal += getPrice(product, qty) * qty
    }
    const grandTotal = optimizerTotal + accessoriesTotal

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Compact header */}
            <div className="bg-white border-b sticky top-0 z-40">
                <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
                    <h1 className="text-lg font-bold text-gray-900">Quick Order</h1>
                    <StepIndicator current={step} />
                </div>
            </div>

            <div className="max-w-lg mx-auto px-4 py-6">
                {/* Step 1: Select Model */}
                {step === 'model' && (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-500">Select optimizer model</p>
                        <div className="grid grid-cols-2 gap-3">
                            {Object.entries(OPTIMIZER_LABELS).map(([key, info]) => {
                                const products = optimizers.filter(p => classifyProduct(p.sku) === key)
                                const product = products[0]
                                if (!product) return null
                                const available = stockAvailable(product)
                                const isOut = available <= 0 && product.stock_status !== 'available_to_order'

                                return (
                                    <button
                                        key={key}
                                        onClick={() => {
                                            setSelectedProduct(product)
                                            setStep('qty')
                                        }}
                                        disabled={isOut}
                                        className={`relative p-5 rounded-xl border-2 text-left transition-all active:scale-[0.97] ${
                                            isOut
                                                ? 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed'
                                                : 'border-gray-200 bg-white hover:border-green-500 hover:shadow-md'
                                        }`}
                                    >
                                        {product.images?.[0] && (
                                            <img
                                                src={product.images[0]}
                                                alt={info.full}
                                                className="w-16 h-16 object-contain mx-auto mb-3"
                                            />
                                        )}
                                        <div className="text-center">
                                            <div className="text-xl font-bold text-gray-900">{info.short}</div>
                                            <div className="text-xs text-gray-500 mt-0.5">{info.desc}</div>
                                            <div className="text-sm font-semibold text-green-700 mt-2">
                                                {isB2B ? formatPriceNet(product.b2b_price_eur || product.price_eur) : formatPrice(product.price_eur)}
                                            </div>
                                            {available > 0 && (
                                                <div className="text-xs text-green-600 mt-1">{available} in stock</div>
                                            )}
                                            {product.stock_status === 'available_to_order' && available <= 0 && (
                                                <div className="text-xs text-blue-600 mt-1">Available to order</div>
                                            )}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Step 2: Quantity */}
                {step === 'qty' && selectedProduct && (
                    <div className="space-y-6">
                        <button onClick={() => setStep('model')} className="text-sm text-gray-500 flex items-center gap-1">
                            <span>&larr;</span> Back
                        </button>

                        <div className="bg-white rounded-xl p-5 border shadow-sm">
                            <div className="flex items-center gap-4 mb-4">
                                {selectedProduct.images?.[0] && (
                                    <img src={selectedProduct.images[0]} alt="" className="w-14 h-14 object-contain" />
                                )}
                                <div>
                                    <div className="font-bold text-gray-900">{OPTIMIZER_LABELS[classifyProduct(selectedProduct.sku) || '']?.short || selectedProduct.sku}</div>
                                    <div className="text-xs text-gray-500">{selectedProduct.sku}</div>
                                </div>
                            </div>

                            <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setQuantity(Math.max(1, quantity - unitsPerBox))}
                                    className="w-12 h-12 rounded-lg bg-gray-100 text-xl font-bold text-gray-700 active:bg-gray-200 flex items-center justify-center"
                                >
                                    −
                                </button>
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    value={quantity}
                                    onChange={e => {
                                        const v = parseInt(e.target.value)
                                        setQuantity(isNaN(v) ? 1 : Math.max(1, v))
                                    }}
                                    onFocus={e => e.target.select()}
                                    className="flex-1 h-12 text-center text-2xl font-bold rounded-lg border-2 border-gray-200 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none"
                                />
                                <button
                                    onClick={() => setQuantity(quantity + unitsPerBox)}
                                    className="w-12 h-12 rounded-lg bg-gray-100 text-xl font-bold text-gray-700 active:bg-gray-200 flex items-center justify-center"
                                >
                                    +
                                </button>
                            </div>

                            {/* Quick qty buttons */}
                            <div className="flex gap-2 mt-3 flex-wrap">
                                {[unitsPerBox, unitsPerBox * 2, unitsPerBox * 5, unitsPerBox * 10].map(n => (
                                    <button
                                        key={n}
                                        onClick={() => setQuantity(n)}
                                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                                            quantity === n
                                                ? 'bg-green-600 text-white'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        {n} pcs
                                    </button>
                                ))}
                            </div>

                            <div className="mt-4 flex justify-between text-sm text-gray-500">
                                <span>{Math.ceil(quantity / unitsPerBox)} box{Math.ceil(quantity / unitsPerBox) !== 1 ? 'es' : ''} ({unitsPerBox}/box)</span>
                                <span className="font-semibold text-gray-900">
                                    {isB2B ? formatPriceNet(getPrice(selectedProduct, quantity)) : formatPrice(getPrice(selectedProduct, quantity))}/pc
                                </span>
                            </div>
                        </div>

                        <button
                            onClick={() => setStep('accessories')}
                            className="w-full py-4 rounded-xl bg-green-600 text-white font-bold text-lg active:bg-green-700 transition shadow-lg"
                        >
                            Continue &rarr;
                        </button>
                    </div>
                )}

                {/* Step 3: Accessories */}
                {step === 'accessories' && (
                    <div className="space-y-4">
                        <button onClick={() => setStep('qty')} className="text-sm text-gray-500 flex items-center gap-1">
                            <span>&larr;</span> Back
                        </button>

                        <p className="text-sm text-gray-500">Need any accessories?</p>

                        {accessories.length === 0 ? (
                            <p className="text-sm text-gray-400 italic">No accessories available</p>
                        ) : (
                            <div className="space-y-3">
                                {accessories.map(acc => {
                                    const type = classifyProduct(acc.sku)
                                    const isSelected = selectedAccessories.has(acc.id)
                                    const available = stockAvailable(acc)
                                    const isOut = available <= 0 && acc.stock_status !== 'available_to_order'

                                    return (
                                        <button
                                            key={acc.id}
                                            onClick={() => !isOut && toggleAccessory(acc)}
                                            disabled={isOut}
                                            className={`w-full p-4 rounded-xl border-2 text-left transition-all active:scale-[0.98] flex items-center gap-4 ${
                                                isOut
                                                    ? 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed'
                                                    : isSelected
                                                    ? 'border-green-500 bg-green-50 shadow-md'
                                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                            }`}
                                        >
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                                isSelected ? 'bg-green-600 border-green-600' : 'border-gray-300'
                                            }`}>
                                                {isSelected && (
                                                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>
                                            {acc.images?.[0] && (
                                                <img src={acc.images[0]} alt="" className="w-12 h-12 object-contain flex-shrink-0" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-gray-900">{type === 'CCA' ? 'CCA Kit' : type === 'RSS' ? 'RSS' : acc.name_en}</div>
                                                <div className="text-xs text-gray-500">{acc.sku}</div>
                                                {available > 0 && <div className="text-xs text-green-600">{available} in stock</div>}
                                            </div>
                                            <div className="text-sm font-semibold text-green-700">
                                                {isB2B ? formatPriceNet(acc.b2b_price_eur || acc.price_eur) : formatPrice(acc.price_eur)}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        )}

                        {/* Accessory quantities */}
                        {selectedAccessories.size > 0 && (
                            <div className="bg-white rounded-xl border p-4 space-y-3">
                                <p className="text-sm font-medium text-gray-700">Accessory quantities</p>
                                {Array.from(selectedAccessories.entries()).map(([id, { product, qty }]) => {
                                    const type = classifyProduct(product.sku)
                                    return (
                                        <div key={id} className="flex items-center gap-3">
                                            <span className="text-sm font-medium text-gray-900 flex-1">
                                                {type === 'CCA' ? 'CCA Kit' : type === 'RSS' ? 'RSS' : product.sku}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); updateAccessoryQty(id, qty - 1) }}
                                                    className="w-9 h-9 rounded-lg bg-gray-100 text-lg font-bold active:bg-gray-200 flex items-center justify-center"
                                                >
                                                    −
                                                </button>
                                                <input
                                                    type="number"
                                                    inputMode="numeric"
                                                    value={qty}
                                                    onChange={e => {
                                                        const v = parseInt(e.target.value)
                                                        updateAccessoryQty(id, isNaN(v) ? 1 : v)
                                                    }}
                                                    onFocus={e => e.target.select()}
                                                    onClick={e => e.stopPropagation()}
                                                    className="w-16 h-9 text-center text-lg font-bold rounded-lg border border-gray-200 focus:border-green-500 outline-none"
                                                />
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); updateAccessoryQty(id, qty + 1) }}
                                                    className="w-9 h-9 rounded-lg bg-gray-100 text-lg font-bold active:bg-gray-200 flex items-center justify-center"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => setStep('summary')}
                                className="flex-1 py-4 rounded-xl bg-green-600 text-white font-bold text-lg active:bg-green-700 transition shadow-lg"
                            >
                                {selectedAccessories.size > 0 ? 'Review Order' : 'Skip & Review'} &rarr;
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 4: Summary */}
                {step === 'summary' && selectedProduct && (
                    <div className="space-y-4">
                        <button onClick={() => setStep('accessories')} className="text-sm text-gray-500 flex items-center gap-1">
                            <span>&larr;</span> Back
                        </button>

                        <div className="bg-white rounded-xl border shadow-sm divide-y">
                            {/* Optimizer */}
                            <div className="p-4 flex items-center gap-3">
                                {selectedProduct.images?.[0] && (
                                    <img src={selectedProduct.images[0]} alt="" className="w-12 h-12 object-contain" />
                                )}
                                <div className="flex-1">
                                    <div className="font-bold text-gray-900">
                                        {OPTIMIZER_LABELS[classifyProduct(selectedProduct.sku) || '']?.short || selectedProduct.sku}
                                    </div>
                                    <div className="text-xs text-gray-500">{quantity} pcs &times; {isB2B ? formatPriceNet(optimizerPrice) : formatPrice(optimizerPrice)}</div>
                                </div>
                                <div className="font-bold text-gray-900">
                                    {isB2B ? formatPriceNet(optimizerTotal) : formatPrice(optimizerTotal)}
                                </div>
                            </div>

                            {/* Accessories */}
                            {Array.from(selectedAccessories.entries()).map(([id, { product, qty }]) => {
                                const unitP = getPrice(product, qty)
                                const type = classifyProduct(product.sku)
                                return (
                                    <div key={id} className="p-4 flex items-center gap-3">
                                        {product.images?.[0] && (
                                            <img src={product.images[0]} alt="" className="w-12 h-12 object-contain" />
                                        )}
                                        <div className="flex-1">
                                            <div className="font-bold text-gray-900">
                                                {type === 'CCA' ? 'CCA Kit' : type === 'RSS' ? 'RSS' : product.sku}
                                            </div>
                                            <div className="text-xs text-gray-500">{qty} pcs &times; {isB2B ? formatPriceNet(unitP) : formatPrice(unitP)}</div>
                                        </div>
                                        <div className="font-bold text-gray-900">
                                            {isB2B ? formatPriceNet(unitP * qty) : formatPrice(unitP * qty)}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Total */}
                        <div className="bg-white rounded-xl border p-4 flex justify-between items-center">
                            <span className="text-lg font-bold text-gray-900">Total</span>
                            <span className="text-xl font-bold text-green-700">
                                {isB2B ? formatPriceNet(grandTotal) : formatPrice(grandTotal)}
                            </span>
                        </div>

                        <button
                            onClick={handleAddToCart}
                            disabled={submitting}
                            className="w-full py-4 rounded-xl bg-green-600 text-white font-bold text-lg active:bg-green-700 transition shadow-lg disabled:opacity-50"
                        >
                            {submitting ? 'Adding...' : 'Add to Cart & Checkout'}
                        </button>

                        <button
                            onClick={() => {
                                setStep('model')
                                setSelectedProduct(null)
                                setQuantity(20)
                                setSelectedAccessories(new Map())
                            }}
                            className="w-full py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-medium active:bg-gray-50 transition"
                        >
                            Start Over
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

function StepIndicator({ current }: { current: Step }) {
    const steps: { key: Step; label: string }[] = [
        { key: 'model', label: 'Model' },
        { key: 'qty', label: 'Qty' },
        { key: 'accessories', label: 'Add-ons' },
        { key: 'summary', label: 'Review' },
    ]

    const currentIdx = steps.findIndex(s => s.key === current)

    return (
        <div className="flex items-center gap-1.5">
            {steps.map((s, i) => (
                <div
                    key={s.key}
                    className={`w-2 h-2 rounded-full transition-all ${
                        i <= currentIdx ? 'bg-green-600' : 'bg-gray-300'
                    } ${i === currentIdx ? 'w-4' : ''}`}
                    title={s.label}
                />
            ))}
        </div>
    )
}
