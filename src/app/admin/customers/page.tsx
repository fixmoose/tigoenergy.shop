import React from 'react'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import type { Customer } from '@/types/database'
import CustomerList from '@/components/admin/CustomerList'

export default async function AdminCustomersPage() {
  const supabase = await createClient()
  // Try with addresses join first, fall back without it if table doesn't exist
  let customers: any[] = []
  let error: any = null

  const result = await (supabase.from('customers') as any)
    .select('*, orders(market, shipping_address)')
    .order('created_at', { ascending: false })
    .limit(200)

  error = result.error
  customers = result.data ?? []

  if (error) return <div className="p-6">Error loading customers: {error.message}</div>

  return (
    <div className="p-6">
      <CustomerList customers={customers ?? []} />
    </div>
  )
}
