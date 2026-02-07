'use client'
import React, { useState } from 'react'
import type { Cart } from '@/types/database'

export default function CartList({ carts, onSelect }: { carts: Cart[]; onSelect: (cartId: string) => void }) {
  const [filter, setFilter] = useState('')
  const filtered = carts.filter((c) => c.id.includes(filter) || (c.user_id ?? '').includes(filter))

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by id or user" className="border rounded px-2" />
      </div>
      <div className="space-y-2">
        {filtered.map((c) => (
          <div key={c.id} className="p-3 border rounded flex justify-between items-center">
            <div>
              <div className="font-medium">{c.id}</div>
              <div className="text-sm text-muted-foreground">User: {c.user_id ?? 'guest'}</div>
              <div className="text-sm text-muted-foreground">Items: {c.items?.length ?? 0}</div>
            </div>
            <div>
              <button onClick={() => onSelect(c.id)} className="btn btn-primary">Open</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
