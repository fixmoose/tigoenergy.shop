'use client'

import React, { useState } from 'react'
import MyOrders from '@/components/dashboard/tabs/MyOrders'
import type { Customer } from '@/types/database'
import type { User } from '@supabase/supabase-js'

interface Props {
  customer: Customer
}

// Renders the customer's own dashboard (MyOrders) inside the admin customer
// detail page. MyOrders is driven in adminViewCustomerId mode so it fetches
// from /api/admin/customers/[id]/dashboard instead of self-auth routes.
// Collapsed by default to keep the admin page compact; admins click to open.
export default function CustomerDashboardMirror({ customer }: Props) {
  const [open, setOpen] = useState(false)

  // MyOrders requires a `user` prop, but in admin-view mode we do not use
  // user.id for any queries — all fetches are routed through the target
  // customer id. We pass a minimal synthetic user object that satisfies the
  // prop shape.
  const fakeUser = { id: customer.id, email: customer.email } as unknown as User

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full px-6 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center gap-3 hover:bg-gray-100/60 transition text-left"
      >
        <div className="w-8 h-8 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-gray-900">View as customer</h3>
          <p className="text-xs text-gray-500">
            See this customer&apos;s dashboard exactly as they see it — orders, quotes, unpaid invoices, full invoice archive.
          </p>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="p-6 bg-gray-50/50">
          <MyOrders user={fakeUser} customer={customer} adminViewCustomerId={customer.id} />
        </div>
      )}
    </div>
  )
}
