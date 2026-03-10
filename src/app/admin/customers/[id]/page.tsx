import React from 'react'
import Link from 'next/link'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import type { Customer } from '@/types/database'
import CustomerPricingAssignment from '@/components/admin/CustomerPricingAssignment'
import CustomerDetailsEditor from '@/components/admin/CustomerDetailsEditor'
import CustomerOrderActions from '@/components/admin/CustomerOrderActions'
import AdminAddressEditor from '@/components/admin/AdminAddressEditor'
import { getPricingSchemas, getCustomerSchemas } from '@/app/actions/pricing'
import { adminVerifyB2BCustomerAction } from '@/app/actions/admin'
import DeleteCustomerButton from '@/components/admin/DeleteCustomerButton'

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

  // Fetch Orders (detailed history)
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, invoice_number, invoice_url, packing_slip_url, shipping_label_url, created_at, status, payment_status, fulfillment_status, total, currency, payment_method, confirmed_at, paid_at')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })

  // Fetch Pricing Data
  const allSchemas = await getPricingSchemas()
  const currentSchemas = await getCustomerSchemas(id)

  const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    processing: 'bg-blue-50 text-blue-700 border-blue-100',
    shipped: 'bg-purple-50 text-purple-700 border-purple-100',
    delivered: 'bg-green-50 text-green-700 border-green-100',
    cancelled: 'bg-red-50 text-red-700 border-red-100',
  }

  const PAYMENT_COLORS: Record<string, string> = {
    pending: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    paid: 'bg-green-50 text-green-700 border-green-100',
    failed: 'bg-red-50 text-red-700 border-red-100',
    refunded: 'bg-gray-50 text-gray-700 border-gray-100',
  }

  if (error) return <div className="p-6 text-red-600 font-bold bg-red-50 rounded-xl">Error loading customer: {error.message}</div>

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Customer Detail</h1>
            <p className="text-sm font-medium text-gray-500 mt-1">{customer.email}</p>
          </div>
          <div className="flex gap-3 items-center">
            <DeleteCustomerButton customerId={id} customerName={`${customer.first_name} ${customer.last_name}`} />
            {customer.is_b2b && customer.account_status !== 'active' && (
              <form action={async () => { 'use server'; await adminVerifyB2BCustomerAction(id) }}>
                <button type="submit" className="px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition shadow-sm">
                  Verify B2B & Notify
                </button>
              </form>
            )}
            <Link href="/admin/customers" className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition shadow-sm">
              Back to List
            </Link>
          </div>
        </header>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Recent Orders Section */}
            <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                <div>
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Order History</h3>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">Sales & Status tracking</p>
                </div>
                <span className="bg-white px-3 py-1 rounded-full text-[10px] font-black text-green-600 border border-green-100 uppercase tracking-widest">
                  {orders?.length || 0} Orders
                </span>
              </div>
              <div className="p-0">
                {!orders || orders.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                    </div>
                    <p className="text-gray-400 font-medium">No orders found for this customer.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {orders.map((order: any) => {
                      const needsProcessing = order.payment_status === 'paid' && !['delivered', 'shipped', 'cancelled'].includes(order.status || '')
                      return (
                        <div key={order.id} className="p-6 hover:bg-gray-50/50 transition-colors group relative">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-3">
                                <Link
                                  href={`/admin/orders/${order.id}`}
                                  className="text-lg font-black text-gray-900 hover:text-green-600 transition-colors"
                                >
                                  #{order.order_number}
                                </Link>
                                {needsProcessing && (
                                  <span className="flex items-center gap-1 text-[10px] font-black text-orange-600 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-full uppercase tracking-widest animate-pulse">
                                    Needs Processing
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                {new Date(order.created_at).toLocaleString()} • {order.payment_method?.replace(/_/g, ' ') || 'Unknown Method'}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                              <div className="flex flex-col items-end mr-4">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Total Amount</p>
                                <p className="text-lg font-black text-gray-900">{order.currency || '€'} {order.total?.toFixed(2)}</p>
                              </div>
                              <div className="flex flex-col gap-1.5 min-w-[100px]">
                                <span className={`text-[10px] px-3 py-1 rounded-lg border font-black uppercase tracking-widest text-center ${PAYMENT_COLORS[order.payment_status || 'pending']}`}>
                                  Payment: {order.payment_status || 'pending'}
                                </span>
                                <span className={`text-[10px] px-3 py-1 rounded-lg border font-black uppercase tracking-widest text-center ${STATUS_COLORS[order.status || 'pending']}`}>
                                  {order.status || 'pending'}
                                </span>
                              </div>
                              <Link
                                href={`/admin/orders/${order.id}`}
                                className="w-10 h-10 bg-white border border-gray-100 rounded-xl flex items-center justify-center text-gray-400 hover:text-green-600 hover:border-green-100 transition shadow-sm group/btn"
                              >
                                <svg className="w-5 h-5 group-hover/btn:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                              </Link>
                            </div>
                          </div>

                          <CustomerOrderActions
                            orderId={order.id}
                            orderNumber={order.order_number}
                            isPaid={order.payment_status === 'paid'}
                            hasLabel={!!order.shipping_label_url}
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* Pricing Assignment Section */}
            <CustomerPricingAssignment
              customerId={id}
              allSchemas={(allSchemas as any).data ?? allSchemas}
              currentSchemas={(currentSchemas as any).data ?? currentSchemas}
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

            {/* Order Returns Section (B2C Only) */}
            {!customer.is_b2b && (
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
            )}

            {/* Documents Section */}
            <section className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-8 py-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                <div>
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Documents</h3>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">Invoices & Logistics</p>
                </div>
                <span className="bg-white px-3 py-1 rounded-full text-[10px] font-black text-blue-400 border border-blue-100 uppercase tracking-widest">
                  Collection
                </span>
              </div>
              <div className="p-8">
                {!orders || orders.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 font-medium">
                    No order documents found for this customer.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {orders.flatMap((order: any) => {
                      const docs = []
                      if (order.invoice_url) docs.push({ type: 'Invoice', url: order.invoice_url, date: order.created_at, order: order.order_number })
                      if (order.packing_slip_url) docs.push({ type: 'Packing Slip', url: order.packing_slip_url, date: order.created_at, order: order.order_number })
                      if (order.shipping_label_url) docs.push({ type: 'Label', url: order.shipping_label_url, date: order.created_at, order: order.order_number })
                      return docs
                    }).map((doc: any, idx: number) => (
                      <a
                        key={idx}
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-4 rounded-2xl border border-gray-100 bg-white hover:bg-blue-50 hover:border-blue-100 transition group flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400 group-hover:bg-white group-hover:text-blue-600 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          </div>
                          <div>
                            <p className="text-sm font-black text-gray-900">{doc.type}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Order #{doc.order} • {new Date(doc.date).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <svg className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </a>
                    ))}
                    {orders.filter((o: any) => !o.invoice_url && !o.packing_slip_url && !o.shipping_label_url).length === orders.length && (
                      <div className="col-span-2 py-8 text-center text-gray-400 text-sm">
                        Orders exist, but no files have been generated/uploaded yet.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-8">
            {/* Customer Details Card */}
            <CustomerDetailsEditor customer={customer} />

            <aside className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-8 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Carts & Activity</h3>
                <Link href={`/admin/customers/${id}/carts`} className="text-[10px] font-black text-blue-600 uppercase hover:underline">View Carts</Link>
              </div>
              <div className="p-8">
                <p className="text-sm text-gray-500">View abandoned carts and active shopping sessions for this customer.</p>
              </div>
            </aside>

            {/* Address Book */}
            <AdminAddressEditor
              customerId={id}
              addresses={customer.addresses ?? []}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
