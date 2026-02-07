import React from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Customer } from '@/types/database'
import CustomerList from '@/components/admin/CustomerList'

export default async function AdminCustomersPage() {
  const supabase = await createClient()
  const { data: customers, error } = await (supabase
    .from('customers') as any)
    .select('id,email,first_name,last_name,created_at,is_b2b,customer_type')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return <div className="p-6">Error loading customers: {error.message}</div>

  return (
    <div className="p-6">
      <CustomerList customers={customers ?? []} />
    </div>
  )
}
