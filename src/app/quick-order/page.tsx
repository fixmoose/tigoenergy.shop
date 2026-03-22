'use client'

import { useState, useEffect, useCallback } from 'react'
import { useCart } from '@/contexts/CartContext'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useRouter } from 'next/navigation'
import type { Product } from '@/types/database'

// ─── Metro tile colors (Windows Phone inspired) ─────────────────────────────
const TILE_COLORS = {
    green: 'bg-green-600',
    teal: 'bg-teal-600',
    blue: 'bg-blue-600',
    indigo: 'bg-indigo-600',
    orange: 'bg-orange-500',
    rose: 'bg-rose-600',
    slate: 'bg-slate-600',
    back: 'bg-gray-400',
}

const MODEL_TILES: Record<string, { color: string; icon: string }> = {
    'TS4-A-O': { color: TILE_COLORS.green, icon: '⚡' },
    'TS4-A-F': { color: TILE_COLORS.orange, icon: '🔥' },
    'TS4-X-O': { color: TILE_COLORS.blue, icon: '⚡' },
    'TS4-A-2F': { color: TILE_COLORS.rose, icon: '🔥🔥' },
}

const OPTIMIZER_LABELS: Record<string, { short: string; full: string; desc: string }> = {
    'TS4-A-O': { short: 'A-O', full: 'TS4-A-O', desc: 'Optimization' },
    'TS4-A-F': { short: 'A-F', full: 'TS4-A-F', desc: 'Fire Safety' },
    'TS4-X-O': { short: 'X-O', full: 'TS4-X-O', desc: 'Optimization (X)' },
    'TS4-A-2F': { short: 'A-2F', full: 'TS4-A-2F', desc: 'Dual Fire Safety' },
}

function classifyProduct(sku: string, name?: string): string | null {
    const s = (sku + ' ' + (name || '')).toUpperCase()
    // Check A-2F first (most specific — contains "A" and "F" so must come before A-F)
    if (/TS4.?A.?2F/.test(s)) return 'TS4-A-2F'
    if (/TS4.?A.?O/.test(s)) return 'TS4-A-O'
    // A-F must come after A-O and A-2F to avoid false matches
    if (/TS4.?A.?F/.test(s) && !/TS4.?A.?2F/.test(s)) return 'TS4-A-F'
    if (/TS4.?X.?O/.test(s)) return 'TS4-X-O'
    if (s.includes('CCA')) return 'CCA'
    if (s.includes('RSS')) return 'RSS'
    return null
}

type Step = 'model' | 'qty' | 'accessories' | 'summary'

// ─── Tile component ─────────────────────────────────────────────────────────
function Tile({
    color,
    onClick,
    disabled,
    className = '',
    children,
}: {
    color: string
    onClick?: () => void
    disabled?: boolean
    className?: string
    children: React.ReactNode
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`${color} text-white rounded-sm p-4 flex flex-col justify-between transition-all
                active:scale-[0.95] active:brightness-90
                disabled:opacity-30 disabled:cursor-not-allowed
                shadow-md hover:shadow-lg
                ${className}`}
        >
            {children}
        </button>
    )
}

export default function QuickOrderPage() {
    const { addItem, openDrawer } = useCart()
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
    const [customQty, setCustomQty] = useState(false)

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

    const unitsPerBox = selectedProduct?.units_per_box || (classifyProduct(selectedProduct?.sku || '', selectedProduct?.name_en)?.startsWith('TS4-X') ? 18 : 20)

    const fmtPrice = (n: number) => isB2B ? formatPriceNet(n) : formatPrice(n)

    async function handleAddToCart() {
        setSubmitting(true)
        try {
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
            console.error('Quick order error:', err)
        } finally {
            setSubmitting(false)
        }
    }

    function toggleAccessory(product: Product) {
        const next = new Map(selectedAccessories)
        if (next.has(product.id)) {
            next.delete(product.id)
        } else {
            next.set(product.id, { product, qty: quantity })
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

    if (loading) {
        return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900">
                <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
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
        <div className="fixed inset-0 z-[60] bg-slate-900 flex flex-col overflow-y-auto">
            {/* Metro header — flat, no border */}
            <div className="px-5 pt-6 pb-2">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-light text-white tracking-wide">
                        {step === 'model' && 'Quick Order'}
                        {step === 'qty' && (OPTIMIZER_LABELS[classifyProduct(selectedProduct?.sku || '', selectedProduct?.name_en) || '']?.short || 'Quantity')}
                        {step === 'accessories' && 'Accessories'}
                        {step === 'summary' && 'Review'}
                    </h1>
                    <StepDots current={step} />
                </div>
                {step === 'model' && (
                    <p className="text-slate-400 text-sm mt-1">Select your optimizer</p>
                )}
            </div>

            {/* Content area — tiles */}
            <div className="flex-1 px-4 pb-4 pt-2 overflow-y-auto">

                {/* ═══════ STEP 1: MODEL ═══════ */}
                {step === 'model' && (
                    <div className="grid grid-cols-2 gap-2 max-w-lg mx-auto">
                        {Object.entries(OPTIMIZER_LABELS).map(([key, info]) => {
                            const products = optimizers.filter(p => classifyProduct(p.sku, p.name_en) === key)
                            const product = products[0]
                            if (!product) return null
                            const available = stockAvailable(product)
                            const isOut = available <= 0 && product.stock_status !== 'available_to_order'
                            const tile = MODEL_TILES[key]

                            return (
                                <Tile
                                    key={key}
                                    color={tile.color}
                                    disabled={isOut}
                                    onClick={() => {
                                        setSelectedProduct(product)
                                        setQuantity(product.units_per_box || 20)
                                        setCustomQty(false)
                                        setStep('qty')
                                    }}
                                    className="aspect-square"
                                >
                                    <div className="text-3xl">{tile.icon}</div>
                                    <div>
                                        <div className="text-2xl font-bold leading-tight">{info.short}</div>
                                        <div className="text-white/70 text-xs mt-0.5">{info.desc}</div>
                                        <div className="text-white/90 text-sm font-semibold mt-1.5">
                                            {fmtPrice(product.b2b_price_eur || product.price_eur)}
                                        </div>
                                        {available > 0 && available < 999999 && (
                                            <div className="text-white/60 text-xs">{available} pcs</div>
                                        )}
                                    </div>
                                </Tile>
                            )
                        })}
                    </div>
                )}

                {/* ═══════ STEP 2: QUANTITY ═══════ */}
                {step === 'qty' && selectedProduct && !customQty && (
                    <div className="grid grid-cols-2 gap-2 max-w-lg mx-auto">
                        {[1, 2, 5, 10].map(mult => {
                            const n = mult * unitsPerBox
                            return (
                                <Tile
                                    key={n}
                                    color={TILE_COLORS.teal}
                                    onClick={() => {
                                        setQuantity(n)
                                        setStep('accessories')
                                    }}
                                    className="aspect-square"
                                >
                                    <div className="text-4xl font-bold">{n}</div>
                                    <div>
                                        <div className="text-white/70 text-sm">{mult} box{mult > 1 ? 'es' : ''}</div>
                                        <div className="text-white/90 text-sm font-semibold mt-1">
                                            {fmtPrice(getPrice(selectedProduct, n) * n)}
                                        </div>
                                    </div>
                                </Tile>
                            )
                        })}

                        {/* Custom qty tile */}
                        <Tile
                            color={TILE_COLORS.indigo}
                            onClick={() => setCustomQty(true)}
                            className="aspect-square"
                        >
                            <div className="text-3xl font-bold">#</div>
                            <div>
                                <div className="text-white/90 text-sm font-medium">Custom</div>
                                <div className="text-white/60 text-xs">Enter amount</div>
                            </div>
                        </Tile>

                        {/* Back tile */}
                        <Tile
                            color={TILE_COLORS.back}
                            onClick={() => { setStep('model'); setSelectedProduct(null) }}
                            className="aspect-square"
                        >
                            <svg className="w-8 h-8 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            <div className="text-white/70 text-sm">Back</div>
                        </Tile>
                    </div>
                )}

                {/* Custom quantity input */}
                {step === 'qty' && selectedProduct && customQty && (
                    <div className="max-w-lg mx-auto space-y-4">
                        <div className="bg-slate-800 rounded-sm p-6">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-white/70 text-sm">{unitsPerBox} per box</span>
                                <span className="text-white/90 text-sm font-semibold">
                                    {fmtPrice(getPrice(selectedProduct, quantity))}/pc
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setQuantity(Math.max(1, quantity - unitsPerBox))}
                                    className="w-14 h-14 rounded-sm bg-slate-700 text-white text-2xl font-bold active:bg-slate-600 flex items-center justify-center"
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
                                    className="flex-1 h-14 text-center text-3xl font-bold bg-slate-700 text-white rounded-sm border-0 outline-none focus:ring-2 focus:ring-teal-400"
                                />
                                <button
                                    onClick={() => setQuantity(quantity + unitsPerBox)}
                                    className="w-14 h-14 rounded-sm bg-slate-700 text-white text-2xl font-bold active:bg-slate-600 flex items-center justify-center"
                                >
                                    +
                                </button>
                            </div>
                            <div className="text-center mt-3 text-white/50 text-sm">
                                {Math.ceil(quantity / unitsPerBox)} box{Math.ceil(quantity / unitsPerBox) !== 1 ? 'es' : ''} &middot; {fmtPrice(getPrice(selectedProduct, quantity) * quantity)} total
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <Tile
                                color={TILE_COLORS.teal}
                                onClick={() => { setCustomQty(false); setStep('accessories') }}
                                className="py-5"
                            >
                                <div className="text-lg font-bold">Continue</div>
                                <div className="text-white/60 text-xs">{quantity} pcs &rarr;</div>
                            </Tile>
                            <Tile
                                color={TILE_COLORS.back}
                                onClick={() => setCustomQty(false)}
                                className="py-5"
                            >
                                <div className="text-lg font-bold">Preset</div>
                                <div className="text-white/60 text-xs">&larr; boxes</div>
                            </Tile>
                        </div>
                    </div>
                )}

                {/* ═══════ STEP 3: ACCESSORIES ═══════ */}
                {step === 'accessories' && (
                    <div className="grid grid-cols-2 gap-2 max-w-lg mx-auto">
                        {accessories.map(acc => {
                            const type = classifyProduct(acc.sku, acc.name_en)
                            const isSelected = selectedAccessories.has(acc.id)
                            const available = stockAvailable(acc)
                            const isOut = available <= 0 && acc.stock_status !== 'available_to_order'
                            const label = type === 'CCA' ? 'CCA Kit' : type === 'RSS' ? 'RSS' : acc.name_en

                            return (
                                <Tile
                                    key={acc.id}
                                    color={isSelected ? TILE_COLORS.green : TILE_COLORS.slate}
                                    disabled={isOut}
                                    onClick={() => toggleAccessory(acc)}
                                    className="aspect-square relative"
                                >
                                    {isSelected && (
                                        <div className="absolute top-2 right-2">
                                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                    )}
                                    {acc.images?.[0] ? (
                                        <img src={acc.images[0]} alt="" className="w-12 h-12 object-contain brightness-0 invert opacity-80" />
                                    ) : (
                                        <div className="text-3xl">{type === 'CCA' ? '🔌' : '📡'}</div>
                                    )}
                                    <div>
                                        <div className="text-lg font-bold leading-tight">{label}</div>
                                        <div className="text-white/60 text-xs">{acc.sku}</div>
                                        <div className="text-white/90 text-sm font-semibold mt-1">
                                            {fmtPrice(acc.b2b_price_eur || acc.price_eur)}
                                        </div>
                                    </div>
                                </Tile>
                            )
                        })}

                        {/* Accessory qty adjusters if selected */}
                        {Array.from(selectedAccessories.entries()).map(([id, { product, qty }]) => {
                            const type = classifyProduct(product.sku, product.name_en)
                            return (
                                <div key={`qty-${id}`} className="col-span-2 bg-slate-800 rounded-sm p-3 flex items-center gap-3">
                                    <span className="text-white text-sm font-medium flex-1">
                                        {type === 'CCA' ? 'CCA Kit' : type === 'RSS' ? 'RSS' : product.sku} qty
                                    </span>
                                    <button
                                        onClick={() => updateAccessoryQty(id, qty - 1)}
                                        className="w-10 h-10 rounded-sm bg-slate-700 text-white text-lg font-bold active:bg-slate-600 flex items-center justify-center"
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
                                        className="w-16 h-10 text-center text-lg font-bold bg-slate-700 text-white rounded-sm border-0 outline-none focus:ring-2 focus:ring-teal-400"
                                    />
                                    <button
                                        onClick={() => updateAccessoryQty(id, qty + 1)}
                                        className="w-10 h-10 rounded-sm bg-slate-700 text-white text-lg font-bold active:bg-slate-600 flex items-center justify-center"
                                    >
                                        +
                                    </button>
                                </div>
                            )
                        })}

                        {/* Skip / Continue tile */}
                        <Tile
                            color={TILE_COLORS.teal}
                            onClick={() => setStep('summary')}
                            className="aspect-square"
                        >
                            <svg className="w-8 h-8 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                            <div>
                                <div className="text-lg font-bold">
                                    {selectedAccessories.size > 0 ? 'Continue' : 'Skip'}
                                </div>
                                <div className="text-white/60 text-xs">Review order</div>
                            </div>
                        </Tile>

                        {/* Back tile */}
                        <Tile
                            color={TILE_COLORS.back}
                            onClick={() => setStep('qty')}
                            className="aspect-square"
                        >
                            <svg className="w-8 h-8 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            <div className="text-white/70 text-sm">Back</div>
                        </Tile>
                    </div>
                )}

                {/* ═══════ STEP 4: SUMMARY ═══════ */}
                {step === 'summary' && selectedProduct && (
                    <div className="max-w-lg mx-auto space-y-2">
                        {/* Optimizer summary tile */}
                        <div className={`${MODEL_TILES[classifyProduct(selectedProduct.sku, selectedProduct.name_en) || '']?.color || TILE_COLORS.green} rounded-sm p-4 flex items-center gap-4`}>
                            {selectedProduct.images?.[0] && (
                                <img src={selectedProduct.images[0]} alt="" className="w-14 h-14 object-contain brightness-0 invert opacity-80" />
                            )}
                            <div className="flex-1">
                                <div className="text-white text-xl font-bold">
                                    {OPTIMIZER_LABELS[classifyProduct(selectedProduct.sku, selectedProduct.name_en) || '']?.short}
                                </div>
                                <div className="text-white/70 text-sm">{quantity} pcs &times; {fmtPrice(optimizerPrice)}</div>
                            </div>
                            <div className="text-white text-xl font-bold">{fmtPrice(optimizerTotal)}</div>
                        </div>

                        {/* Accessory summary tiles */}
                        {Array.from(selectedAccessories.entries()).map(([id, { product, qty }]) => {
                            const unitP = getPrice(product, qty)
                            const type = classifyProduct(product.sku, product.name_en)
                            return (
                                <div key={id} className={`${TILE_COLORS.slate} rounded-sm p-4 flex items-center gap-4`}>
                                    {product.images?.[0] && (
                                        <img src={product.images[0]} alt="" className="w-10 h-10 object-contain brightness-0 invert opacity-80" />
                                    )}
                                    <div className="flex-1">
                                        <div className="text-white text-lg font-bold">
                                            {type === 'CCA' ? 'CCA Kit' : type === 'RSS' ? 'RSS' : product.sku}
                                        </div>
                                        <div className="text-white/70 text-sm">{qty} pcs &times; {fmtPrice(unitP)}</div>
                                    </div>
                                    <div className="text-white text-lg font-bold">{fmtPrice(unitP * qty)}</div>
                                </div>
                            )
                        })}

                        {/* Total bar */}
                        <div className="bg-slate-800 rounded-sm p-4 flex justify-between items-center border border-slate-700">
                            <span className="text-white/70 text-lg">Total</span>
                            <span className="text-white text-2xl font-bold">{fmtPrice(grandTotal)}</span>
                        </div>

                        {/* Action tiles */}
                        <div className="grid grid-cols-2 gap-2 pt-2">
                            <Tile
                                color={TILE_COLORS.green}
                                onClick={handleAddToCart}
                                disabled={submitting}
                                className="col-span-2 py-5"
                            >
                                <div className="text-xl font-bold text-center w-full">
                                    {submitting ? 'Adding...' : 'Checkout'}
                                </div>
                                <div className="text-white/60 text-xs text-center w-full">Add to cart & proceed</div>
                            </Tile>

                            <Tile
                                color={TILE_COLORS.back}
                                onClick={() => setStep('accessories')}
                                className="py-4"
                            >
                                <svg className="w-6 h-6 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                <div className="text-white/70 text-sm">Back</div>
                            </Tile>

                            <Tile
                                color={TILE_COLORS.slate}
                                onClick={() => {
                                    setStep('model')
                                    setSelectedProduct(null)
                                    setQuantity(20)
                                    setSelectedAccessories(new Map())
                                }}
                                className="py-4"
                            >
                                <svg className="w-6 h-6 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <div className="text-white/70 text-sm">Start Over</div>
                            </Tile>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function StepDots({ current }: { current: Step }) {
    const steps: Step[] = ['model', 'qty', 'accessories', 'summary']
    const idx = steps.indexOf(current)

    return (
        <div className="flex items-center gap-1.5">
            {steps.map((s, i) => (
                <div
                    key={s}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                        i <= idx ? 'bg-teal-400' : 'bg-slate-600'
                    } ${i === idx ? 'w-5' : 'w-1.5'}`}
                />
            ))}
        </div>
    )
}
