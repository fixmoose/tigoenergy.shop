import React from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Customer } from '@/types/database'
import CustomerPricingAssignment from '@/components/admin/CustomerPricingAssignment'
import { getPricingSchemas, getCustomerSchemas } from '@/app/actions/pricing'

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: customer, error } = await (supabase.from('customers') as any).select('*').eq('id', id).limit(1).single()

  // Fetch Support Requests
  const { data: supportRequests } = await supabase
    .from('support_requests')
    .select('*')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })

  // Fetch Order Returns
  const { data: orderReturns } = await supabase
    .from('order_returns')
    .select('*, orders(order_number)')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })

  // Fetch Pricing Data
  const allSchemas = await getPricingSchemas()
  const currentSchemas = await getCustomerSchemas(id)

  if (error) return <div className="p-6 text-red-600 font-bold bg-red-50 rounded-xl">Error loading customer: {error.message}</div>

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Customer Detail</h1>
            <p className="text-sm font-medium text-gray-500 mt-1">{customer.email}</p>
          </div>
          <div className="flex gap-3">
            <Link href="/admin/customers" className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition shadow-sm">
              Back to List
            </Link>
          </div>
        </header>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Pricing Assignment Section */}
            <CustomerPricingAssignment
              customerId={id}
              allSchemas={allSchemas}
              currentSchemas={currentSchemas as any}
            />

            {/* Support Messages Section */}
            <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                <div>
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Support Inquiries</h3>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">Communication History</p>
                </div>
                <span className="bg-white px-3 py-1 rounded-full text-[10px] font-black text-gray-400 border border-gray-100 uppercase tracking-widest">
                  {supportRequests?.length || 0} Messages
                </span>
              </div>
              <div className="p-8">
                {!supportRequests || supportRequests.length === 0 ? (
                  <div className="py-12 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                    </div>
                    <p className="text-gray-400 font-medium">No support inquiries for this customer yet.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {supportRequests.map((req: any) => (
                      <div key={req.id} className="p-6 rounded-2xl border border-gray-100 bg-white hover:border-green-100 transition-colors group">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${req.type === 'shipping' ? 'bg-blue-50 text-blue-700' :
                              req.type === 'return' ? 'bg-orange-50 text-orange-700' :
                                'bg-purple-50 text-purple-700'
                              }`}>
                              {req.type}
                            </span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                              {new Date(req.created_at).toLocaleString()}
                            </span>
                          </div>
                          {req.status === 'new' && (
                            <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
                          )}
                        </div>
                        <h4 className="text-lg font-black text-gray-900 mb-2 group-hover:text-green-600 transition-colors">{req.subject}</h4>
                        <p className="text-sm text-gray-600 font-medium leading-relaxed whitespace-pre-wrap">{req.message}</p>

                        {req.metadata?.orderNumber && (
                          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-4">
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Linked Order:</div>
                            <Link
                              href={`/admin/orders/${req.order_id}`}
                              className="text-xs font-black text-green-600 hover:underline"
                            >
                              #{req.metadata.orderNumber}
                            </Link>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Order Returns Section */}
            <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                <div>
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Order Returns</h3>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">B2C 14-Day Return Requests</p>
                </div>
                <span className="bg-white px-3 py-1 rounded-full text-[10px] font-black text-orange-400 border border-orange-100 uppercase tracking-widest">
                  {orderReturns?.length || 0} Returns
                </span>
              </div>
              <div className="p-8">
                {!orderReturns || orderReturns.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 font-medium">
                    No return requests found.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {orderReturns.map((ret: any) => (
                      <div key={ret.id} className="p-6 rounded-2xl border border-gray-100 bg-white hover:border-orange-100 transition-colors group">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${ret.status === 'requested' ? 'bg-blue-50 text-blue-700' :
                              ret.status === 'refunded' ? 'bg-green-50 text-green-700' :
                                'bg-gray-50 text-gray-700'
                              }`}>
                              {ret.status}
                            </span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                              {new Date(ret.created_at).toLocaleString()}
                            </span>
                          </div>
                          <Link
                            href={`/admin/orders/${ret.order_id}`}
                            className="text-xs font-black text-green-600 hover:underline"
                          >
                            Order #{ret.orders?.order_number}
                          </Link>
                        </div>

                        <div className="flex flex-col gap-4">
                          <div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Reason</span>
                            <p className="text-sm font-bold text-gray-900 capitalize">{ret.reason.replace(/_/g, ' ')}</p>
                          </div>

                          {ret.customer_notes && (
                            <div>
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Customer Note</span>
                              <p className="text-sm text-gray-600 italic">"{ret.customer_notes}"</p>
                            </div>
                          )}

                          <div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Items</span>
                            <div className="space-y-1">
                              {(ret.items as any[]).map((item, idx) => (
                                <div key={idx} className="text-xs font-medium text-gray-700 bg-gray-50 p-2 rounded-lg border border-gray-100 flex justify-between">
                                  <span>{item.product_name} x{item.quantity}</span>
                                  <span className="font-bold">€{(item.unit_price * item.quantity).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {ret.images && ret.images.length > 0 && (
                            <div>
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Evidence Photos</span>
                              <div className="flex gap-2 overflow-x-auto pb-2">
                                {ret.images.map((img: string, idx: number) => (
                                  <a key={idx} href={img} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-gray-200">
                                    <img src={img} className="w-full h-full object-cover" alt="" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-8">
            {/* Customer Details Card */}
            <aside className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-8 border-b border-gray-50 bg-gray-50/50">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Details</h3>
                <p className="text-xl font-black text-gray-900">{customer.first_name} {customer.last_name}</p>
              </div>
              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Company</label>
                  <p className="text-sm font-bold text-gray-900">{customer.company_name || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">VAT ID</label>
                  <p className="text-sm font-bold text-gray-900">{customer.vat_id || 'N/A'}</p>
                </div>
              </div>
            </aside>

            {/* Address Book */}
            <aside className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-8 border-b border-gray-50 bg-gray-50/50">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Addresses</h3>
              </div>
              <div className="p-8">
                <pre className="whitespace-pre-wrap text-[11px] font-mono text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  {JSON.stringify(customer.addresses ?? [], null, 2)}
                </pre>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}
