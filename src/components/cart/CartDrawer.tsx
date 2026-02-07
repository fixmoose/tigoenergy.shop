'use client'

import { Fragment } from 'react'
import { useCart } from '@/contexts/CartContext'
import CartItem from './CartItem'
import CartSummary from './CartSummary'

export default function CartDrawer() {
  const { open, closeDrawer, items } = useCart()

  return (
    <div className={`fixed inset-0 z-50 pointer-events-none ${open ? '' : 'hidden'}`} aria-hidden={!open}>
      <div className="absolute inset-0 bg-black opacity-30 pointer-events-auto" onClick={closeDrawer} />

      <aside className="fixed right-0 top-0 h-full w-full sm:w-96 bg-white shadow-xl pointer-events-auto p-6 overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Your cart</h2>
          <button onClick={closeDrawer} className="text-gray-600">Close</button>
        </div>

        <div className="space-y-4">
          {items.length === 0 ? (
            <div className="text-sm text-gray-500">Your cart is empty.</div>
          ) : (
            items.map((it) => <CartItem key={it.product_id ?? it.sku} item={it} />)
          )}
        </div>

        <div className="mt-6">
          <CartSummary />
        </div>
      </aside>
    </div>
  )
}
