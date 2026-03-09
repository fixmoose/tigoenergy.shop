'use client'
import React, { useEffect, useState } from 'react'
import CartEditor from '@/components/admin/CartEditor'
import { createClient } from '@/lib/supabase/client'
import type { Cart } from '@/types/database'
import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function CartPage() {
    const params = useParams()
    const [cart, setCart] = useState<Cart | null>(null)
    const [customer, setCustomer] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function load() {
            const supabase = createClient()
            const { data, error } = await supabase.from('carts').select('*').eq('id', params.id).limit(1).single()
            if (error) { setError(error.message); setLoading(false); return }
            setCart(data)

            if (data?.user_id) {
                const { data: cust } = await supabase
                    .from('customers')
                    .select('id, first_name, last_name, email, company_name, is_b2b, addresses')
                    .eq('id', data.user_id)
                    .single()
                setCustomer(cust)
            }
            setLoading(false)
        }
        load()
    }, [params.id])

    if (loading) return <div className="p-6 text-slate-400">Loading...</div>
    if (error) return <div className="p-6 text-red-600">Error: {error}</div>

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <Link href="/admin/carts" className="text-slate-400 hover:text-slate-700 transition">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </Link>
                <h1 className="text-2xl font-black text-slate-900">Cart Detail</h1>
            </div>
            <CartEditor cart={cart} customer={customer} />
        </div>
    )
}
