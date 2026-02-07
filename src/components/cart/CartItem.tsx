'use client'

import { useState } from 'react'
import type { CartItem as DBCartItem } from '@/types/database'
import { useCart } from '@/contexts/CartContext'
import { useCurrency } from '@/contexts/CurrencyContext'

export default function CartItem({ item }: { item: DBCartItem }) {
  const { updateQuantity, removeItem } = useCart()
  const { formatPrice } = useCurrency()
  const [qty, setQty] = useState(item.quantity || 1)

  async function onChange(q: number) {
    setQty(q)
    await updateQuantity(item.product_id ?? item.sku, q)
  }

  return (
    <div className="flex items-start gap-4 border-b pb-4">
      <div className="w-20 h-20 bg-gray-50 flex items-center justify-center">
        <img src={item.image_url ?? '/placeholder.png'} alt={item.name} className="max-h-full object-contain" />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">{item.name}</div>
            <div className="text-sm text-gray-500">{item.sku}</div>
          </div>
          <div className="font-semibold">{formatPrice(item.unit_price || 0)}</div>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button className="px-2 py-1 border" onClick={() => onChange(Math.max(1, qty - 1))}>-</button>
          <input className="w-12 text-center border" value={qty} onChange={(e) => onChange(Math.max(1, Number(e.target.value || 1)))} />
          <button className="px-2 py-1 border" onClick={() => onChange(qty + 1)}>+</button>

          <button onClick={() => removeItem(item.product_id ?? item.sku)} className="ml-4 text-sm text-red-600">Remove</button>
        </div>

        <div className="mt-2 text-sm text-gray-600">Total: {formatPrice(item.total_price || (item.unit_price || 0) * (item.quantity || 0))}</div>
      </div>
    </div>
  )
}
