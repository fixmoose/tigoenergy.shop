import React from 'react'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const revalidate = 0 // always fresh for admin

export default async function AdminHome() {
  const supabase = await createClient()

  const [
    { count: productsCount },
    { count: ordersCount },
    { count: customersCount },
    { count: cartsCount },
    { data: recentOrders },
    { data: recentCustomers },
    { data: pendingOrders },
  ] = await Promise.all([
    supabase.from('products').select('id', { head: true, count: 'exact' }),
    supabase.from('orders').select('id', { head: true, count: 'exact' }),
    supabase.from('customers').select('id', { head: true, count: 'exact' }),
    supabase.from('carts').select('id', { head: true, count: 'exact' }),
    supabase.from('orders')
      .select('id, order_number, status, payment_status, total, currency, created_at, customer_id')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('customers')
      .select('id, first_name, last_name, email, company_name, customer_type, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('orders')
      .select('id, order_number, total, currency, created_at')
      .in('payment_status', ['unpaid', 'pending'])
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  // Build unified activity feed sorted by date
  type ActivityItem = {
    id: string
    type: 'order' | 'customer'
    label: string
    sub: string
    date: string
    href: string
    badge?: string
    badgeColor?: string
  }

  const activities: ActivityItem[] = [
    ...(recentOrders || []).map(o => ({
      id: o.id,
      type: 'order' as const,
      label: `Order #${o.order_number}`,
      sub: `EUR ${o.total?.toFixed(2)} · ${o.status}`,
      date: o.created_at,
      href: `/admin/orders/${o.id}`,
      badge: o.payment_status === 'unpaid' || o.payment_status === 'pending' ? 'Awaiting Payment' : undefined,
      badgeColor: 'bg-amber-100 text-amber-700',
    })),
    ...(recentCustomers || []).map(c => ({
      id: c.id,
      type: 'customer' as const,
      label: c.company_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email,
      sub: c.customer_type === 'b2b' ? `B2B · ${c.email}` : `B2C · ${c.email}`,
      date: c.created_at,
      href: `/admin/customers/${c.id}`,
      badge: c.customer_type === 'b2b' ? 'B2B' : undefined,
      badgeColor: 'bg-blue-100 text-blue-700',
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20)

  return (
    <section className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Products', count: productsCount, href: '/admin/products', color: 'bg-blue-50 text-blue-700' },
          { label: 'Orders', count: ordersCount, href: '/admin/orders', color: 'bg-green-50 text-green-700' },
          { label: 'Customers', count: customersCount, href: '/admin/customers', color: 'bg-purple-50 text-purple-700' },
          { label: 'Active Carts', count: cartsCount, href: '/admin/carts', color: 'bg-orange-50 text-orange-700' },
        ].map(s => (
          <Link key={s.label} href={s.href} className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="text-sm text-gray-500 mb-1">{s.label}</div>
            <div className={`text-3xl font-black ${s.color.split(' ')[1]}`}>{s.count ?? 0}</div>
          </Link>
        ))}
      </div>

      {/* Pending Payments Alert */}
      {(pendingOrders?.length ?? 0) > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="font-bold text-amber-800 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            {pendingOrders!.length} order{pendingOrders!.length > 1 ? 's' : ''} awaiting payment
          </h3>
          <div className="space-y-2">
            {pendingOrders!.map(o => (
              <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 hover:bg-amber-50 transition-colors">
                <span className="font-medium text-sm">Order #{o.order_number}</span>
                <span className="text-sm text-gray-600">EUR {o.total?.toFixed(2)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Link className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors" href="/admin/products">Manage Products</Link>
          <Link className="inline-block bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors" href="/admin/pricing">Manage Pricing</Link>
          <Link className="inline-block bg-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors" href="/admin/orders">All Orders</Link>
          <Link className="inline-block bg-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors" href="/admin/customers">All Customers</Link>
        </div>
      </div>

      {/* Activity Feed */}
      <div>
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Recent Activity</h3>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50">
          {activities.length === 0 ? (
            <p className="p-6 text-gray-400 text-sm text-center">No recent activity</p>
          ) : activities.map(item => (
            <Link key={`${item.type}-${item.id}`} href={item.href} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
              {/* Icon */}
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${item.type === 'order' ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`}>
                {item.type === 'order' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                )}
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-gray-900 truncate">{item.label}</span>
                  {item.badge && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.badgeColor}`}>{item.badge}</span>
                  )}
                </div>
                <div className="text-xs text-gray-500 truncate">{item.sub}</div>
              </div>
              {/* Date */}
              <div className="text-xs text-gray-400 flex-shrink-0">
                {new Date(item.date).toLocaleDateString('sl-SI', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
