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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Carts</h1>
        <Link
          href="/admin/carts/share"
          className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-600 transition-all flex items-center gap-2 shadow-lg shadow-slate-200"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
          Create Shared Cart
        </Link>
      </div>
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
