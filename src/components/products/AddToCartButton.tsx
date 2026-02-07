'use client'

import { useState } from 'react'
import type { Product } from '@/types/database'
import { useTranslations } from 'next-intl'
import { EffectivePrice } from '@/lib/db/pricing'

function getCookie(name: string) {
  if (typeof document === 'undefined') return undefined
  const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return m ? decodeURIComponent(m[2]) : undefined
}

function setCookie(name: string, value: string, days = 30) {
  if (typeof document === 'undefined') return
  const maxAge = days * 24 * 60 * 60
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`
}

export default function AddToCartButton({ product, userId, pricing }: { product: Product; userId?: string | null; pricing?: EffectivePrice }) {
  const tc = useTranslations('common')
  const productName = product.name_en
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function handleAdd() {
    setMessage(null)

    setLoading(true)
    try {
      const cartId = getCookie('cartId')
      const unitPrice = pricing?.isDiscounted ? pricing.discountedPrice : product.price_eur

      const res = await fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          cartId,
          item: {
            product_id: product.id,
            sku: product.sku,
            name: productName,
            quantity,
            unit_price: unitPrice,
            image_url: product.images?.[0],
            metadata: {
              category: product.category,
              subcategory: product.subcategory
            }
          }
        }),
      })

      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || 'Failed to add to cart')

      // Persist cartId for guest users
      if (!userId && payload?.cartId) setCookie('cartId', payload.cartId, 30)

      setMessage('Added to cart')
    } catch (err: any) {
      setMessage(err?.message ?? 'Error')
    } finally {
      setLoading(false)
    }
  }

  // Check stock status
  // Check stock status
  const isAvailableToOrder = product.stock_status === 'available_to_order'
  const isOutOfStock = product.stock_status === 'out_of_stock' || ((product.stock_quantity ?? 0) <= 0 && !isAvailableToOrder)
  const isComingSoon = product.stock_status === 'coming_soon'
  const canAddToCart = !isOutOfStock && !isComingSoon

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center border rounded overflow-hidden">
        <button className="px-3" onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Decrease" disabled={!canAddToCart}>
          -
        </button>
        <input
          className="w-12 text-center outline-none border-none focus:ring-0"
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => {
            const val = parseInt(e.target.value)
            setQuantity(isNaN(val) ? 1 : Math.max(1, val))
          }}
          onFocus={(e) => e.target.select()}
          disabled={!canAddToCart}
        />
        <button className="px-3" onClick={() => setQuantity(quantity + 1)} aria-label="Increase" disabled={!canAddToCart}>
          +
        </button>
      </div>

      <button
        onClick={handleAdd}
        disabled={loading || !canAddToCart}
        className={`px-6 py-2 rounded font-medium transition-colors ${canAddToCart
          ? 'bg-green-600 text-white hover:bg-green-700'
          : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
      >
        {isComingSoon ? tc('comingSoon') : isOutOfStock ? tc('outOfStock') : loading ? tc('adding') : tc('addToCart')}
      </button>

      {message && <div className="text-sm text-gray-600">{message}</div>}
    </div>
  )
}
