'use client'
import React, { useEffect, useState } from 'react'
import type { Cart } from '@/types/database'

export default function CartEditor({ cart }: { cart: Cart | null }) {
  const [localCart, setLocalCart] = useState<Cart | null>(cart ?? null)
  const [saving, setSaving] = useState(false)

  useEffect(() => setLocalCart(cart ?? null), [cart])

  if (!localCart) return <div>Select a cart to edit</div>

  async function updateItem(index: number, quantity: number) {
    if (!localCart) return
    const items = [...(localCart.items ?? [])]
    items[index] = { ...items[index], quantity }
    setLocalCart({ ...(localCart as Cart), items })
  }

  async function save() {
    if (!localCart) return
    setSaving(true)
    await fetch(`/api/admin/customers/${localCart.user_id ?? localCart.id}/carts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update', cartId: localCart.id, items: localCart.items }),
    })
    setSaving(false)
    alert('Saved')
  }

  async function convert() {
    if (!localCart) return
    setSaving(true)
    const res = await fetch(`/api/admin/customers/${localCart.user_id ?? localCart.id}/carts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'convert', cartId: localCart.id }),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      alert(`Order created: ${data.order?.order_number}`)
      // Optionally navigate to order page
    } else {
      alert(`Error: ${data.error}`)
    }
  }

  return (
    <div className="p-4 border rounded">
      <h3 className="font-semibold mb-2">Cart {localCart.id}</h3>
      <div className="space-y-2">
        {(localCart.items ?? []).map((it: any, i: number) => {
          const price = Number(it.total_price ?? (it.unit_price * it.quantity))
          return (
            <div key={i} className="flex items-center gap-4">
              <div className="flex-1">{it.name ?? it.sku}</div>
              <div>
                <input type="number" value={it.quantity || 0} onChange={(e) => updateItem(i, Number(e.target.value))} className="w-20 border rounded px-2" />
              </div>
              <div className="w-24 text-right">{price.toFixed(2)}</div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex gap-2">
        <button onClick={save} disabled={saving} className="btn btn-primary">Save</button>
        <button onClick={convert} disabled={saving} className="btn btn-secondary">Convert to Order</button>
      </div>
    </div>
  )
}
