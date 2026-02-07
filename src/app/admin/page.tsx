import React from 'react'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0 // always fresh for admin

export default async function AdminHome() {
  const supabase = await createClient()

  // Use head:true with count: 'exact' to get totals
  const [{ count: productsCount }, { count: ordersCount }, { count: customersCount }, { count: cartsCount }] = await Promise.all([
    supabase.from('products').select('id', { head: true, count: 'exact' }),
    supabase.from('orders').select('id', { head: true, count: 'exact' }),
    supabase.from('customers').select('id', { head: true, count: 'exact' }),
    supabase.from('carts').select('id', { head: true, count: 'exact' }),
  ])

  return (
    <section>
      <h2 className="text-xl font-semibold mb-4">Overview</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-500">Products</div>
          <div className="text-2xl font-bold">{productsCount ?? 0}</div>
        </div>

        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-500">Orders</div>
          <div className="text-2xl font-bold">{ordersCount ?? 0}</div>
        </div>

        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-500">Customers</div>
          <div className="text-2xl font-bold">{customersCount ?? 0}</div>
        </div>

        <div className="p-4 bg-white rounded shadow">
          <div className="text-sm text-gray-500">Active Carts</div>
          <div className="text-2xl font-bold">{cartsCount ?? 0}</div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-medium mb-2">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <a className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors" href="/admin/products">Manage Products</a>
          <a className="inline-block bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors" href="/admin/pricing">Manage Pricing</a>
          <a className="inline-block bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition-colors" href="/admin/orders">View Orders</a>
        </div>
      </div>
    </section>
  )
}
