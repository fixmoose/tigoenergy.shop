'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useCart } from '@/contexts/CartContext'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useRouter } from 'next/navigation'
import type { Product } from '@/types/database'
import { LowStockWarning, LowStockBadge } from '@/components/ui/LowStockWarning'

// ─── MLPE classification ────────────────────────────────────────────────────
const OPTIMIZER_LABELS: Record<string, { short: string; full: string; desc: string }> = {
    'TS4-A-O': { short: 'A-O', full: 'TS4-A-O', desc: 'Optimization' },
    'TS4-A-F': { short: 'A-F', full: 'TS4-A-F', desc: 'Fire Safety' },
    'TS4-X-O': { short: 'X-O', full: 'TS4-X-O', desc: 'Optimization (X)' },
    'TS4-A-2F': { short: 'A-2F', full: 'TS4-A-2F', desc: 'Dual Fire Safety' },
}

function classifyOptimizer(sku: string, name?: string): string | null {
    const s = (sku + ' ' + (name || '')).toUpperCase()
    if (/TS4.?A.?2F/.test(s)) return 'TS4-A-2F'
    if (/TS4.?A.?O/.test(s)) return 'TS4-A-O'
    if (/TS4.?A.?F/.test(s) && !/TS4.?A.?2F/.test(s)) return 'TS4-A-F'
    if (/TS4.?X.?O/.test(s)) return 'TS4-X-O'
    return null
}

function isMLPE(p: Product): boolean {
    return classifyOptimizer(p.sku, p.name_en) !== null
}

type View = 'catalog' | 'boxqty' | 'browse'

export default function QuickOrderPage() {
    const { addItem, openDrawer } = useCart()
    const { formatPrice, formatPriceNet, isB2B } = useCurrency()
    const router = useRouter()

    const [optimizers, setOptimizers] = useState<Product[]>([])
    const [inverters, setInverters] = useState<Product[]>([])
    const [communicators, setCommunicators] = useState<Product[]>([])
    const [otherProducts, setOtherProducts] = useState<Product[]>([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [termsAccepted, setTermsAccepted] = useState(false)

    // Cart state: productId → { product, qty }
    const [cart, setCart] = useState<Map<string, { product: Product; qty: number }>>(new Map())

    // View state
    const [view, setView] = useState<View>('catalog')
    const [boxQtyProduct, setBoxQtyProduct] = useState<Product | null>(null)
    const [customQty, setCustomQty] = useState(false)
    const [boxQty, setBoxQty] = useState(20)
    const [searchQuery, setSearchQuery] = useState('')

    // Animation state for tap feedback
    const [lastTapped, setLastTapped] = useState<string | null>(null)

    useEffect(() => {
        if (typeof window !== 'undefined' && localStorage.getItem('quick-order-terms') === 'accepted') {
            setTermsAccepted(true)
        }
        fetch('/api/quick-order')
            .then(r => r.json())
            .then(data => {
                setOptimizers(data.optimizers || [])
                setInverters(data.inverters || [])
                setCommunicators(data.communicators || [])
                setOtherProducts(data.other || [])
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

    const fmtPrice = (n: number) => isB2B ? formatPriceNet(n) : formatPrice(n)

    // Add item to cart (tap-to-increment for non-MLPE)
    function tapProduct(product: Product) {
        const next = new Map(cart)
        const existing = next.get(product.id)
        if (existing) {
            next.set(product.id, { product, qty: existing.qty + 1 })
        } else {
            next.set(product.id, { product, qty: 1 })
        }
        setCart(next)
        // Trigger tap animation
        setLastTapped(product.id)
        setTimeout(() => setLastTapped(null), 300)
    }

    // Remove one from cart (long-press or decrement)
    function decrementProduct(productId: string) {
        const next = new Map(cart)
        const existing = next.get(productId)
        if (existing) {
            if (existing.qty <= 1) {
                next.delete(productId)
            } else {
                next.set(productId, { ...existing, qty: existing.qty - 1 })
            }
            setCart(next)
        }
    }

    // Add MLPE with box qty
    function addMLPEToCart(product: Product, qty: number) {
        const next = new Map(cart)
        next.set(product.id, { product, qty })
        setCart(next)
        setBoxQtyProduct(null)
        setCustomQty(false)
        setView('catalog')
    }

    // Checkout: add all cart items to the global cart context
    async function handleCheckout() {
        setSubmitting(true)
        try {
            for (const [, { product, qty }] of cart) {
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

    // Cart totals
    const cartItemCount = Array.from(cart.values()).reduce((sum, { qty }) => sum + qty, 0)
    const cartTotal = Array.from(cart.values()).reduce((sum, { product, qty }) => sum + getPrice(product, qty) * qty, 0)

    // Check if any cart item exceeds available stock
    const hasOverStock = Array.from(cart.values()).some(({ product, qty }) => {
        const avail = stockAvailable(product)
        return avail < 999999 && qty > avail
    })

    const unitsPerBox = boxQtyProduct?.units_per_box || (classifyOptimizer(boxQtyProduct?.sku || '', boxQtyProduct?.name_en)?.startsWith('TS4-X') ? 18 : 20)

    // ─── Loading ────────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900">
                <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    // ─── Terms ──────────────────────────────────────────────────────────────────
    if (!termsAccepted) {
        return (
            <div className="fixed inset-0 z-[60] bg-slate-900 flex flex-col overflow-y-auto">
                <div className="flex-1 flex flex-col justify-center px-6 py-8">
                    <img src="/tigo-leaf.png" alt="" className="w-12 h-12 brightness-0 invert opacity-80 mb-6" />
                    <h1 className="text-2xl font-bold text-white mb-4">Quick Order</h1>
                    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 mb-6">
                        <p className="text-slate-300 text-sm leading-relaxed mb-3">
                            This is a simplified mobile ordering interface. Due to the compact format,
                            some product details, specifications, and legal text may not be fully visible.
                        </p>
                        <p className="text-slate-300 text-sm leading-relaxed mb-3">
                            By proceeding, you acknowledge and agree that:
                        </p>
                        <ul className="text-slate-400 text-sm space-y-2 ml-4 list-disc">
                            <li>Product images are for reference only</li>
                            <li>Full specs available on the desktop version</li>
                            <li>All orders subject to our <a href="/terms" className="text-teal-400 underline">Terms & Conditions</a></li>
                            <li>Prices confirmed at checkout</li>
                        </ul>
                    </div>
                    <button
                        onClick={() => { localStorage.setItem('quick-order-terms', 'accepted'); setTermsAccepted(true) }}
                        className="w-full bg-green-600 text-white py-4 rounded-lg font-bold text-lg active:scale-[0.98] active:bg-green-700 transition-all"
                    >
                        I Agree — Continue
                    </button>
                    <button onClick={() => router.push('/')} className="w-full text-slate-400 py-3 text-sm mt-2 active:text-white transition">
                        Go Back
                    </button>
                </div>
            </div>
        )
    }

    // ─── Box Qty selector (MLPE only) ───────────────────────────────────────────
    if (view === 'boxqty' && boxQtyProduct) {
        const label = OPTIMIZER_LABELS[classifyOptimizer(boxQtyProduct.sku, boxQtyProduct.name_en) || '']

        if (!customQty) {
            return (
                <div className="fixed inset-0 z-[60] bg-slate-900 flex flex-col overflow-y-auto overflow-x-hidden">
                    <div className="px-4 pt-4 pb-2">
                        <div className="flex items-center gap-3">
                            <button onClick={() => { setView('catalog'); setBoxQtyProduct(null) }} className="text-slate-400 active:text-white transition p-1">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <h1 className="text-xl font-medium text-white flex-1">{label?.short || boxQtyProduct.sku} — Quantity</h1>
                        </div>
                    </div>
                    <div className="flex-1 px-4 pb-4 pt-2">
                        <div className="grid grid-cols-2 gap-3">
                            {[1, 2, 5, 10].map(mult => {
                                const n = mult * unitsPerBox
                                return (
                                    <button
                                        key={n}
                                        onClick={() => addMLPEToCart(boxQtyProduct, n)}
                                        className="bg-teal-600 text-white rounded-lg p-4 aspect-square flex flex-col justify-between
                                            active:scale-[0.95] active:bg-teal-700 transition-all shadow-md"
                                    >
                                        <div className="text-4xl font-bold">{n}</div>
                                        <div>
                                            <div className="text-white/70 text-sm">{mult} box{mult > 1 ? 'es' : ''}</div>
                                            <div className="text-white/90 text-sm font-semibold mt-1">
                                                {fmtPrice(getPrice(boxQtyProduct, n) * n)}
                                            </div>
                                        </div>
                                    </button>
                                )
                            })}
                            <button
                                onClick={() => { setBoxQty(unitsPerBox); setCustomQty(true) }}
                                className="bg-indigo-600 text-white rounded-lg p-4 aspect-square flex flex-col justify-between
                                    active:scale-[0.95] active:bg-indigo-700 transition-all shadow-md"
                            >
                                <div className="text-3xl font-bold">#</div>
                                <div>
                                    <div className="text-white/90 text-sm font-medium">Custom</div>
                                    <div className="text-white/60 text-xs">Enter amount</div>
                                </div>
                            </button>
                            <button
                                onClick={() => { setView('catalog'); setBoxQtyProduct(null) }}
                                className="bg-gray-500 text-white rounded-lg p-4 aspect-square flex flex-col justify-between
                                    active:scale-[0.95] active:bg-gray-600 transition-all shadow-md"
                            >
                                <svg className="w-8 h-8 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                                <div className="text-white/70 text-sm">Back</div>
                            </button>
                        </div>
                    </div>
                </div>
            )
        }

        // Custom qty input
        return (
            <div className="fixed inset-0 z-[60] bg-slate-900 flex flex-col overflow-y-auto overflow-x-hidden">
                <div className="px-4 pt-4 pb-2">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setCustomQty(false)} className="text-slate-400 active:text-white transition p-1">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </button>
                        <h1 className="text-xl font-medium text-white flex-1">{label?.short || boxQtyProduct.sku} — Custom Qty</h1>
                    </div>
                </div>
                <div className="flex-1 px-4 pb-4 pt-4">
                    <div className="bg-slate-800 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-white/70 text-sm">{unitsPerBox} per box</span>
                            <span className="text-white/90 text-sm font-semibold">
                                {fmtPrice(getPrice(boxQtyProduct, boxQty))}/pc
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={() => setBoxQty(Math.max(1, boxQty - unitsPerBox))}
                                className="w-14 h-14 rounded-lg bg-slate-700 text-white text-2xl font-bold active:bg-slate-600 flex items-center justify-center">−</button>
                            <input type="number" inputMode="numeric" value={boxQty}
                                onChange={e => { const v = parseInt(e.target.value); setBoxQty(isNaN(v) ? 1 : Math.max(1, v)) }}
                                onFocus={e => e.target.select()}
                                className="flex-1 h-14 text-center text-3xl font-bold bg-slate-700 text-white rounded-lg border-0 outline-none focus:ring-2 focus:ring-teal-400" />
                            <button onClick={() => setBoxQty(boxQty + unitsPerBox)}
                                className="w-14 h-14 rounded-lg bg-slate-700 text-white text-2xl font-bold active:bg-slate-600 flex items-center justify-center">+</button>
                        </div>
                        <div className="text-center mt-3 text-white/50 text-sm">
                            {Math.ceil(boxQty / unitsPerBox)} box{Math.ceil(boxQty / unitsPerBox) !== 1 ? 'es' : ''} &middot; {fmtPrice(getPrice(boxQtyProduct, boxQty) * boxQty)} total
                        </div>
                    </div>
                    <button onClick={() => addMLPEToCart(boxQtyProduct, boxQty)}
                        className="w-full mt-4 bg-green-600 text-white py-4 rounded-lg font-bold text-lg active:scale-[0.98] active:bg-green-700 transition-all">
                        Add {boxQty} pcs to Order
                    </button>
                </div>
            </div>
        )
    }

    // ─── Browse All (Shop More) ─────────────────────────────────────────────────
    if (view === 'browse') {
        const allProducts = [...optimizers, ...inverters, ...communicators, ...otherProducts]
        const filtered = searchQuery.length >= 2
            ? allProducts.filter(p => {
                const q = searchQuery.toLowerCase()
                return (p.name_en || '').toLowerCase().includes(q) ||
                       (p.sku || '').toLowerCase().includes(q) ||
                       (p.category || '').toLowerCase().includes(q)
            })
            : allProducts

        return (
            <div className="fixed inset-0 z-[60] bg-slate-900 flex flex-col overflow-x-hidden">
                <div className="px-4 pt-4 pb-2">
                    <div className="flex items-center gap-3 mb-3">
                        <button onClick={() => { setView('catalog'); setSearchQuery('') }} className="text-slate-400 active:text-white transition p-1">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </button>
                        <h1 className="text-xl font-medium text-white flex-1">All Products</h1>
                    </div>
                    <input
                        type="search"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search products..."
                        className="w-full bg-slate-800 text-white rounded-lg px-4 py-3 text-sm border border-slate-700 placeholder-slate-500 outline-none focus:ring-2 focus:ring-teal-400"
                    />
                </div>
                <div className="flex-1 overflow-y-auto px-4 pb-24 pt-2">
                    <div className="grid grid-cols-2 gap-3">
                        {filtered.map(p => (
                            <ProductTile key={p.id} product={p} qty={cart.get(p.id)?.qty || 0}
                                onTap={() => isMLPE(p) ? (() => { setBoxQtyProduct(p); setView('boxqty'); setCustomQty(false) })() : tapProduct(p)}
                                onDecrement={() => decrementProduct(p.id)}
                                isAnimating={lastTapped === p.id}
                                fmtPrice={fmtPrice} stockAvailable={stockAvailable} />
                        ))}
                    </div>
                    {filtered.length === 0 && (
                        <p className="text-center text-slate-500 mt-8">No products found</p>
                    )}
                </div>
                {/* Floating checkout bar */}
                {cartItemCount > 0 && (
                    <div className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 px-4 py-3 z-[70]">
                        {hasOverStock && <div className="mb-2"><LowStockWarning variant="dark" /></div>}
                        <button onClick={handleCheckout} disabled={submitting}
                            className="w-full bg-green-600 text-white py-3 rounded-lg font-bold text-base active:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                            <span>{submitting ? 'Adding...' : 'Checkout'}</span>
                            <span className="bg-green-700 px-2 py-0.5 rounded text-sm">{cartItemCount} items &middot; {fmtPrice(cartTotal)}</span>
                        </button>
                    </div>
                )}
            </div>
        )
    }

    // ─── Main Catalog View ──────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-[60] bg-slate-900 flex flex-col overflow-x-hidden">
            {/* Header */}
            <div className="px-4 pt-4 pb-2">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.push('/')} className="text-slate-400 active:text-white transition p-1">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <h1 className="text-xl font-medium text-white flex-1">Quick Order</h1>
                </div>
            </div>

            {/* Scrollable catalog */}
            <div className="flex-1 overflow-y-auto px-4 pb-24 pt-2">
                {/* Section: MLPE Optimizers */}
                {optimizers.length > 0 && (
                    <>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Optimizers</p>
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            {Object.keys(OPTIMIZER_LABELS).map(key => {
                                const product = optimizers.find(p => classifyOptimizer(p.sku, p.name_en) === key)
                                if (!product) return null
                                return (
                                    <ProductTile key={product.id} product={product} qty={cart.get(product.id)?.qty || 0}
                                        label={OPTIMIZER_LABELS[key]?.short}
                                        onTap={() => { setBoxQtyProduct(product); setView('boxqty'); setCustomQty(false) }}
                                        onDecrement={() => decrementProduct(product.id)}
                                        isAnimating={lastTapped === product.id}
                                        fmtPrice={fmtPrice} stockAvailable={stockAvailable} />
                                )
                            })}
                        </div>
                    </>
                )}

                {/* Section: Inverters */}
                {inverters.length > 0 && (
                    <>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Inverters</p>
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            {inverters.map(p => (
                                <ProductTile key={p.id} product={p} qty={cart.get(p.id)?.qty || 0}
                                    onTap={() => tapProduct(p)}
                                    onDecrement={() => decrementProduct(p.id)}
                                    isAnimating={lastTapped === p.id}
                                    fmtPrice={fmtPrice} stockAvailable={stockAvailable} />
                            ))}
                        </div>
                    </>
                )}

                {/* Section: Communicators */}
                {communicators.length > 0 && (
                    <>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">Communicators</p>
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            {communicators.map(p => (
                                <ProductTile key={p.id} product={p} qty={cart.get(p.id)?.qty || 0}
                                    onTap={() => tapProduct(p)}
                                    onDecrement={() => decrementProduct(p.id)}
                                    isAnimating={lastTapped === p.id}
                                    fmtPrice={fmtPrice} stockAvailable={stockAvailable} />
                            ))}
                        </div>
                    </>
                )}

                {/* Section: Other Products */}
                {otherProducts.length > 0 && (
                    <>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">More Products</p>
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            {otherProducts.map(p => (
                                <ProductTile key={p.id} product={p} qty={cart.get(p.id)?.qty || 0}
                                    onTap={() => tapProduct(p)}
                                    onDecrement={() => decrementProduct(p.id)}
                                    isAnimating={lastTapped === p.id}
                                    fmtPrice={fmtPrice} stockAvailable={stockAvailable} />
                            ))}
                        </div>
                    </>
                )}

                {/* Shop More button */}
                <button onClick={() => setView('browse')}
                    className="w-full bg-slate-800 border border-slate-700 text-white py-3 rounded-lg text-sm font-medium active:bg-slate-700 transition-all mb-4">
                    Browse All Products
                </button>
            </div>

            {/* Floating checkout bar */}
            {cartItemCount > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 px-4 py-3 z-[70]">
                    {hasOverStock && <div className="mb-2"><LowStockWarning variant="dark" /></div>}
                    <button onClick={handleCheckout} disabled={submitting}
                        className="w-full bg-green-600 text-white py-3 rounded-lg font-bold text-base active:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                        <span>{submitting ? 'Adding...' : 'Checkout'}</span>
                        <span className="bg-green-700 px-2 py-0.5 rounded text-sm">{cartItemCount} items &middot; {fmtPrice(cartTotal)}</span>
                    </button>
                </div>
            )}
        </div>
    )
}

// ─── Product Tile Component ─────────────────────────────────────────────────
function ProductTile({
    product,
    qty,
    label,
    onTap,
    onDecrement,
    isAnimating,
    fmtPrice,
    stockAvailable,
}: {
    product: Product
    qty: number
    label?: string
    onTap: () => void
    onDecrement: () => void
    isAnimating: boolean
    fmtPrice: (n: number) => string
    stockAvailable: (p: Product) => number
}) {
    const available = stockAvailable(product)
    const isOut = available <= 0 && product.stock_status !== 'available_to_order'
    const displayName = label || product.name_en?.replace(/^Tigo\s+/i, '').slice(0, 30) || product.sku

    return (
        <button
            disabled={isOut}
            onClick={onTap}
            className={`bg-slate-800 border rounded-lg overflow-hidden relative
                transition-all disabled:opacity-30 disabled:cursor-not-allowed flex flex-col
                ${qty > 0 ? 'border-green-500' : 'border-slate-700'}
                ${isAnimating ? 'scale-[0.93]' : 'active:scale-[0.97]'}`}
        >
            {/* Qty badge */}
            {qty > 0 && (
                <div className="absolute top-2 right-2 z-10 bg-green-500 rounded-full min-w-[24px] h-6 flex items-center justify-center px-1"
                    onClick={e => { e.stopPropagation(); onDecrement() }}>
                    <span className="text-white text-xs font-bold">{qty}</span>
                </div>
            )}

            {/* Product image */}
            <div className="aspect-[4/3] bg-white p-2 flex items-center justify-center">
                {product.images?.[0] ? (
                    <img src={product.images[0]} alt="" className="w-full h-full object-contain" />
                ) : (
                    <div className="text-3xl text-slate-300">📦</div>
                )}
            </div>

            {/* Info bar */}
            <div className="p-2.5 text-left flex-1">
                <div className="text-white text-sm font-bold leading-tight line-clamp-2">{displayName}</div>
                <div className="text-slate-500 text-[10px] mt-0.5 truncate">{product.sku}</div>
                <div className="flex items-baseline justify-between mt-1">
                    <span className="text-teal-400 text-xs font-semibold">
                        {fmtPrice(product.b2b_price_eur || product.price_eur)}
                    </span>
                    {available > 0 && available < 999999 && (
                        <span className="text-slate-500 text-[10px]">{available} pcs</span>
                    )}
                </div>
                {qty > 0 && <LowStockBadge available={available} ordered={qty} variant="dark" />}
            </div>
        </button>
    )
}
