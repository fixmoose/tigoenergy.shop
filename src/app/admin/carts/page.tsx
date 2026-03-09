import React from 'react'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import type { Cart } from '@/types/database'

function countryToFlag(code: string) {
    const upper = (code || '').toUpperCase()
    if (upper.length !== 2) return '🌍'
    return String.fromCodePoint(...upper.split('').map(c => 0x1F1E6 - 65 + c.charCodeAt(0)))
}

export default async function AdminCartsPage() {
    const supabase = await createAdminClient()
    const { data: carts, error } = await supabase.from('carts').select('*').order('updated_at', { ascending: false }).limit(100)

    if (error) return <div className="p-6">Error loading carts: {error.message}</div>

    const userIds = [...new Set((carts ?? []).map((c: any) => c.user_id).filter(Boolean))]
    const { data: customers } = userIds.length > 0
        ? await supabase.from('customers').select('id, first_name, last_name, email, company_name, is_b2b, addresses').in('id', userIds)
        : { data: [] }

    const customerMap: Record<string, any> = {}
    for (const c of customers ?? []) customerMap[c.id] = c

    function getCountry(customer: any): string {
        if (!customer) return ''
        const addrs = customer.addresses ?? []
        const def = addrs.find((a: any) => a.isDefaultShipping) || addrs[0]
        return def?.country || ''
    }

    function cartValue(cart: any): number {
        return (cart.items ?? []).reduce((sum: number, it: any) => {
            return sum + Number(it.total_price ?? (it.unit_price * it.quantity) ?? 0)
        }, 0)
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Abandoned Carts</h1>
                    <p className="text-sm text-slate-500 mt-1">{(carts ?? []).length} active cart{(carts ?? []).length !== 1 ? 's' : ''}</p>
                </div>
                <Link
                    href="/admin/carts/share"
                    className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-600 transition-all flex items-center gap-2 shadow-lg shadow-slate-200"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                    Create Shared Cart
                </Link>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="text-left px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Customer</th>
                            <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider hidden md:table-cell">Location</th>
                            <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Items</th>
                            <th className="text-right px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider hidden sm:table-cell">Value</th>
                            <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider hidden lg:table-cell">Last Activity</th>
                            <th className="text-right px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {(carts ?? []).map((c: any) => {
                            const cust = customerMap[c.user_id]
                            const country = getCountry(cust)
                            const value = cartValue(c)
                            const itemCount = (c.items ?? []).length
                            return (
                                <tr key={c.id} className="hover:bg-slate-50/50 transition">
                                    <td className="px-6 py-4">
                                        {cust ? (
                                            <div>
                                                <p className="font-bold text-slate-900">
                                                    {cust.first_name} {cust.last_name}
                                                    {cust.is_b2b && <span className="ml-1.5 text-[8px] font-black px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100 uppercase">B2B</span>}
                                                </p>
                                                <p className="text-xs text-slate-500">{cust.email}</p>
                                                {cust.company_name && <p className="text-xs text-slate-400 italic">{cust.company_name}</p>}
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 italic text-xs">Guest · {c.id.slice(0, 8)}…</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 hidden md:table-cell">
                                        {country ? (
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">{countryToFlag(country)}</span>
                                                <span className="text-xs font-bold text-slate-600">{country}</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-300">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-center">
                                        {itemCount > 0 ? (
                                            <span className="px-2.5 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-700">{itemCount}</span>
                                        ) : (
                                            <span className="text-slate-300 text-xs">empty</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-right hidden sm:table-cell">
                                        {value > 0 ? (
                                            <span className="font-bold text-slate-900">€{value.toFixed(2)}</span>
                                        ) : (
                                            <span className="text-slate-300">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-xs text-slate-400 hidden lg:table-cell">
                                        {c.updated_at ? new Date(c.updated_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {cust && (
                                                <Link href={`/admin/customers/${cust.id}/carts`} className="text-xs text-slate-400 hover:text-slate-700">All carts</Link>
                                            )}
                                            <Link href={`/admin/carts/${c.id}`} className="text-xs font-bold text-blue-600 hover:text-blue-700 px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-100">
                                                Open
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>

                {(carts ?? []).length === 0 && (
                    <div className="py-20 text-center text-slate-400">
                        <p className="text-4xl mb-3">🛒</p>
                        <p className="font-medium">No active carts</p>
                    </div>
                )}
            </div>
        </div>
    )
}
