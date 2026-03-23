import React from 'react'
import Link from 'next/link'
import { createAdminClient as createClient } from '@/lib/supabase/server'
import type { Order, OrderItem } from '@/types/database'
import AdminOrderActions from '@/components/admin/AdminOrderActions'
import OrderWorkflowTracker from '@/components/admin/OrderWorkflowTracker'
import WarehouseActionsLog from '@/components/admin/WarehouseActionsLog'
import OrderEmailHistory from '@/components/admin/OrderEmailHistory'
import EditableShippingAddress from '@/components/admin/EditableShippingAddress'
import EditableShippingMethod from '@/components/admin/EditableShippingMethod'
import EditableOrderItems from '@/components/admin/EditableOrderItems'

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

  // Fetch customer's saved addresses for address selector
  let customerAddresses: any[] = []
  if (order.customer_id) {
    const { data: customer } = await supabase
      .from('customers')
      .select('addresses')
      .eq('id', order.customer_id)
      .single()
    customerAddresses = customer?.addresses || []
  }

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
            {order.shipping_carrier === 'Personal Pick-up' ? (
              <span className="px-3 py-1 rounded-full text-sm font-bold bg-green-100 text-green-800 border border-green-300">
                🏪 Lastni prevzem
              </span>
            ) : order.shipping_carrier === 'InterEuropa' ? (
              <span className="px-3 py-1 rounded-full text-sm font-bold bg-purple-100 text-purple-800 border border-purple-300">
                🚛 InterEuropa paleta
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-800 border border-blue-300">
                🚚 {order.shipping_carrier || 'DPD'} dostava
              </span>
            )}
          </div>
          <p className="text-slate-500 mt-1">
            {order.customer_email} {order.created_at && `• ${new Date(order.created_at).toLocaleDateString('en-GB')}`}
          </p>
        </div>
        <Link href="/admin/orders" className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
          Back to Orders
        </Link>
      </div>

      <div className="mb-6">
        <OrderWorkflowTracker order={{
          ...order,
          warehouse_actions: (order as any).warehouse_actions || [],
          pickup_payment_proof_required: (order as any).pickup_payment_proof_required || false,
        }} />
      </div>

      {(order as any).warehouse_actions?.length > 0 && (
        <WarehouseActionsLog actions={(order as any).warehouse_actions} orderId={order.id} />
      )}

      <div className="mb-6">
        <AdminOrderActions
          orderId={order.id}
          status={order.status || null}
          paymentStatus={order.payment_status || null}
          createdAt={order.created_at || null}
          confirmedAt={order.confirmed_at || null}
          packingSlipUrl={order.packing_slip_url}
          shippingLabelUrl={order.shipping_label_url}
          invoiceUrl={order.invoice_url}
          trackingNumber={order.tracking_number}
          trackingUrl={order.tracking_url}
          shippingCarrier={order.shipping_carrier}
          customerEmail={order.customer_email}
          sendCount={(order as any).order_send_count || 0}
          orderTotal={order.total || 0}
          amountPaid={(order as any).amount_paid || 0}
          modificationUnlocked={order.modification_unlocked || false}
          paymentTerms={(order as any).payment_terms || null}
          paymentDueDate={(order as any).payment_due_date || null}
          warehouseSendLog={(order as any).warehouse_send_log || []}
        />
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

          <EditableOrderItems
            orderId={order.id}
            items={items ?? []}
            subtotal={order.subtotal || 0}
            shippingCost={order.shipping_cost || 0}
            vatRate={order.vat_rate || 0}
            vatAmount={order.vat_amount || 0}
            total={order.total || 0}
            invoiceIssued={!!order.invoice_url}
          />
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
            <EditableShippingAddress
              orderId={order.id}
              address={order.shipping_address}
              customerAddresses={customerAddresses}
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
              <EditableShippingMethod
                orderId={order.id}
                shippingCarrier={order.shipping_carrier}
                shippingCost={order.shipping_cost || 0}
                trackingNumber={order.tracking_number}
                trackingUrl={order.tracking_url}
                shippingLabelUrl={order.shipping_label_url}
                shippedAt={order.shipped_at}
                orderStatus={order.status}
              />
            </div>

          <OrderEmailHistory orderId={order.id} />
        </div>
      </div>
    </div>
  )
}
