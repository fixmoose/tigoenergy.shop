import React from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Cart } from '@/types/database'

export default async function AdminCartsPage() {
  const supabase = await createClient()
  const { data: carts, error } = await supabase.from('carts').select('*').order('updated_at', { ascending: false }).limit(50)

  if (error) {
    return <div className="p-6">Error loading carts: {error.message}</div>
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Carts</h1>
      <div className="space-y-2">
        {(carts ?? []).map((c: any) => (
          <div key={c.id} className="p-4 border rounded-md flex justify-between items-center">
            <div>
              <div className="font-medium">Cart: {c.id}</div>
              <div className="text-sm text-muted-foreground">Items: {c.items?.length ?? 0}</div>
              <div className="text-sm text-muted-foreground">User: {c.user_id ?? 'guest'}</div>
            </div>
            <div className="flex gap-2">
              {c.user_id ? (
                <Link href={`/admin/customers/${c.user_id}/carts`} className="text-sm text-blue-600">View customer carts</Link>
              ) : null}
              <Link href={`/admin/carts/${c.id}`} className="text-sm text-blue-600">Open</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
