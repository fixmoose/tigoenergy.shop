'use client'
import React, { useEffect, useState } from 'react'
import CartEditor from '@/components/admin/CartEditor'
import { createClient } from '@/lib/supabase/client'
import type { Cart } from '@/types/database'
import { useParams } from 'next/navigation'

export default function CartPage() {
  const params = useParams()
  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data, error } = await supabase.from('carts').select('*').eq('id', params.id).limit(1).single()
      if (error) setError(error.message)
      else setCart(data)
      setLoading(false)
    }
    load()
  }, [params.id])

  if (loading) return <div className="p-6">Loading...</div>
  if (error) return <div className="p-6">Error loading cart: {error}</div>

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Cart {params.id}</h1>
      <CartEditor cart={cart} />
    </div>
  )
}
