'use client'

import { useRouter } from 'next/navigation'
import { useCart } from '@/contexts/CartContext'
import { useCurrency } from '@/contexts/CurrencyContext'

export default function CartSummary() {
  const { subtotal, count } = useCart()
  const { formatPrice } = useCurrency()
  const router = useRouter()

  return (
    <div className="border-t pt-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">Items</div>
        <div className="font-medium">{count}</div>
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="text-sm text-gray-600">Subtotal</div>
        <div className="font-semibold">{formatPrice(subtotal)}</div>
      </div>

      <div className="mt-4">
        <button onClick={() => router.push('/cart')} className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition">Go to cart</button>
      </div>
    </div>
  )
}
