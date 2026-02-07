import React from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Order, OrderItem } from '@/types/database'
import AdminOrderActions from '@/components/admin/AdminOrderActions'

const TRANSACTION_TYPES: Record<string, { label: string; color: string }> = {
  domestic: { label: 'Domestic (SI)', color: 'bg-slate-100 text-slate-700' },
  eu: { label: 'EU', color: 'bg-blue-100 text-blue-700' },
  export: { label: 'Export (Non-EU)', color: 'bg-amber-100 text-amber-700' },
}

function formatCurrency(amount: number | null | undefined) {
  if (amount == null) return '€0.00'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)
}

function formatWeight(kg: number | null | undefined) {
  if (kg == null) return '0 kg'
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3 }).format(kg) + ' kg'
}

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single() as { data: Order | null; error: any }

  if (error || !order) {
    return <div className="p-6 text-red-600">Error loading order: {error?.message || 'Not found'}</div>
  }

  const { data: items } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', id) as { data: OrderItem[] | null; error: any }

  const complianceTotals = (items || []).reduce(
    (acc, item) => {
      if (item.applies_trod_fee) {
        acc.etrodUnits += item.quantity
        acc.etrodWeight += (item.weight_kg || 0) * item.quantity
      }
      if (item.applies_packaging_fee) {
        acc.packagingWeight += item.packaging_weight_kg || 0
      }
      return acc
    },
    { etrodUnits: 0, etrodWeight: 0, packagingWeight: 0 }
  )

  const transactionType = TRANSACTION_TYPES[order.transaction_type || 'domestic']

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">Order {order.order_number}</h1>
            <span className={`px-2 py-1 rounded text-xs font-medium ${transactionType.color}`}>
              {transactionType.label}
            </span>
          </div>
          <p className="text-slate-500 mt-1">
            {order.customer_email} {order.created_at && `• ${new Date(order.created_at).toLocaleDateString('en-GB')}`}
          </p>
        </div>
        <Link href="/admin/orders" className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
          Back to Orders
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="font-semibold text-slate-800 mb-4">Order Details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Status:</span>
                <span className="ml-2 font-medium">{order.status}</span>
              </div>
              <div>
                <span className="text-slate-500">Payment:</span>
                <span className="ml-2 font-medium">{order.payment_status}</span>
              </div>
              <div>
                <span className="text-slate-500">Market:</span>
                <span className="ml-2 font-medium uppercase">{order.market}</span>
              </div>
              <div>
                <span className="text-slate-500">Language:</span>
                <span className="ml-2 font-medium uppercase">{order.language}</span>
              </div>
              {order.company_name && (
                <div className="col-span-2">
                  <span className="text-slate-500">Company:</span>
                  <span className="ml-2 font-medium">{order.company_name}</span>
                  {order.vat_id && <span className="ml-2 text-slate-400">({order.vat_id})</span>}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="px-6 py-4 border-b bg-slate-50">
              <h2 className="font-semibold text-slate-800">Items</h2>
            </div>
            <table className="w-full">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="text-left px-6 py-3">Product</th>
                  <th className="text-right px-4 py-3">Qty</th>
                  <th className="text-right px-4 py-3">Unit Price</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-center px-4 py-3">Compliance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(items ?? []).map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{item.product_name}</div>
                      <div className="text-xs text-slate-500">{item.sku}</div>
                      {item.cn_code && <div className="text-xs text-slate-400 font-mono">CN: {item.cn_code}</div>}
                    </td>
                    <td className="text-right px-4 py-4 text-slate-800">{item.quantity}</td>
                    <td className="text-right px-4 py-4 text-slate-600">
                      {item.b2c_unit_price && item.b2c_unit_price > item.unit_price && (
                        <div className="text-[10px] text-slate-400 line-through">
                          {formatCurrency(item.b2c_unit_price)}
                        </div>
                      )}
                      {formatCurrency(item.unit_price)}
                    </td>
                    <td className="text-right px-4 py-4 font-medium text-slate-800">{formatCurrency(item.total_price)}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col items-center gap-1">
                        {item.applies_trod_fee && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                            eTROD-{item.trod_category_code}
                          </span>
                        )}
                        {item.packaging_data && Object.keys(item.packaging_data).length > 0 ? (
                          <div className="flex flex-wrap justify-center gap-1">
                            {Object.entries(item.packaging_data).map(([mat, w]) => (
                              <span key={mat} className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-100 whitespace-nowrap">
                                {mat}: {formatWeight(w as number)}
                              </span>
                            ))}
                          </div>
                        ) : item.applies_packaging_fee && item.packaging_weight_kg ? (
                          <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
                            {formatWeight(item.packaging_weight_kg)}
                          </span>
                        ) : null}
                        {!item.applies_trod_fee && !item.applies_packaging_fee && (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t">
                <tr>
                  <td className="px-6 py-3 text-slate-500">Subtotal</td>
                  <td colSpan={3} className="text-right px-4 py-3 font-medium text-slate-800">
                    {formatCurrency(order.subtotal)}
                  </td>
                  <td></td>
                </tr>
                <tr>
                  <td className="px-6 py-3 text-slate-500">Shipping</td>
                  <td colSpan={3} className="text-right px-4 py-3 text-slate-600">
                    {formatCurrency(order.shipping_cost)}
                  </td>
                  <td></td>
                </tr>
                <tr>
                  <td className="px-6 py-3 text-slate-500">VAT ({order.vat_rate}%)</td>
                  <td colSpan={3} className="text-right px-4 py-3 text-slate-600">
                    {formatCurrency(order.vat_amount)}
                  </td>
                  <td></td>
                </tr>
                <tr className="font-bold text-lg">
                  <td className="px-6 py-4 text-slate-800">Total</td>
                  <td colSpan={3} className="text-right px-4 py-4 text-slate-800">
                    {formatCurrency(order.total)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <span className="text-green-600">♻️</span> Compliance Data
            </h3>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Transaction Type</p>
                <span className={`px-2 py-1 rounded text-sm font-medium ${transactionType.color}`}>
                  {transactionType.label}
                </span>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-1">Delivery Country</p>
                <p className="font-medium text-slate-800">{order.delivery_country || 'Not set'}</p>
              </div>

              <div className="pt-3 border-t">
                <p className="text-xs text-slate-500 mb-2">eTROD (WEEE & Packaging)</p>
                {complianceTotals.etrodUnits > 0 ? (
                  <div className="bg-green-50 rounded-lg p-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-green-700">Units:</span>
                      <span className="font-medium text-green-800">{complianceTotals.etrodUnits}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-green-700">Weight:</span>
                      <span className="font-medium text-green-800">{formatWeight(complianceTotals.etrodWeight)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm">No eTROD items</p>
                )}
              </div>

              <div className="pt-3 border-t">
                <p className="text-xs text-slate-500 mb-2">Packaging Waste</p>
                {complianceTotals.packagingWeight > 0 ? (
                  <div className="bg-amber-50 rounded-lg p-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-amber-700">Total Weight:</span>
                      <span className="font-medium text-amber-800">{formatWeight(complianceTotals.packagingWeight)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm">No packaging data</p>
                )}
              </div>

              <div className="pt-3 border-t">
                <p className="text-xs text-slate-500 mb-2">Intrastat</p>
                <div className="flex items-center gap-2">
                  {order.intrastat_reported ? (
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                      Reported {order.intrastat_report_date}
                    </span>
                  ) : order.transaction_type === 'eu' ? (
                    <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">Pending</span>
                  ) : (
                    <span className="text-slate-400 text-sm">N/A</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="font-semibold text-slate-800 mb-3">Shipping Address</h3>
            {order.shipping_address ? (
              <div className="text-sm text-slate-600 space-y-1">
                <p className="font-medium text-slate-800">
                  {order.shipping_address.first_name} {order.shipping_address.last_name}
                </p>
                {order.shipping_address.company && <p>{order.shipping_address.company}</p>}
                <p>{order.shipping_address.street}</p>
                <p>{order.shipping_address.postal_code} {order.shipping_address.city}</p>
                <p className="font-medium">{order.shipping_address.country}</p>
              </div>
            ) : (
              <p className="text-slate-400 text-sm">No address</p>
            )}
          </div>

          {order.tracking_number && (
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-semibold text-slate-800 mb-3">Shipping</h3>
              <div className="text-sm space-y-2">
                <div>
                  <span className="text-slate-500">Carrier:</span>
                  <span className="ml-2 font-medium">{order.shipping_carrier}</span>
                </div>
                <div>
                  <span className="text-slate-500">Tracking:</span>
                  <a href={order.tracking_url || '#'} target="_blank" rel="noopener noreferrer" className="ml-2 font-medium text-blue-600 hover:underline">
                    {order.tracking_number}
                  </a>
                </div>
                {order.shipped_at && (
                  <div>
                    <span className="text-slate-500">Shipped:</span>
                    <span className="ml-2">{new Date(order.shipped_at).toLocaleDateString('en-GB')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <AdminOrderActions
            orderId={order.id}
            status={order.status || null}
            createdAt={order.created_at || null}
            confirmedAt={order.confirmed_at || null}
          />
        </div>
      </div>
    </div>
  )
}
