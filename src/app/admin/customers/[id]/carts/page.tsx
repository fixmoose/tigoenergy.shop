'use client'
import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Cart } from '@/types/database'
import CartList from '@/components/admin/CartList'
import CartEditor from '@/components/admin/CartEditor'
import { useParams } from 'next/navigation'

export default function CustomerCartsPage() {
  const params = useParams()
  const [carts, setCarts] = useState<Cart[]>([])
  const [selectedCart, setSelectedCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data, error } = await supabase.from('carts').select('*').eq('user_id', params.customerId).order('updated_at', { ascending: false })
      if (error) setError(error.message)
      else {
        setCarts(data ?? [])
        if (data && data.length > 0) setSelectedCart(data[0])
      }
      setLoading(false)
    }
    load()
  }, [params.customerId])

  if (loading) return <div className="p-6">Loading...</div>
  if (error) return <div className="p-6">Error loading carts: {error}</div>

  return (
    <div className="p-6 grid grid-cols-3 gap-6">
      <div className="col-span-1">
        <h2 className="text-lg font-semibold mb-2">Carts for {params.customerId}</h2>
        <CartList carts={carts} onSelect={(id: string) => {
          const cart = carts.find(c => c.id === id)
          if (cart) setSelectedCart(cart)
        }} />
      </div>
      <div className="col-span-2">
        <CartEditor cart={selectedCart} />
      </div>
    </div>
  )
}
