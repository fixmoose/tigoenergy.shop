'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface OrderListItem {
  id: string
  order_number: string
  customer_email: string
  status: string | null
  payment_status: string | null
  created_at: string | null
  total: number
  market: string
  transaction_type: string | null
  delivery_country: string | null
  intrastat_reported: boolean | null
}

const TRANSACTION_TYPES: Record<string, { label: string; color: string; short: string }> = {
  domestic: { label: 'Domestic (SI)', color: 'bg-slate-100 text-slate-700', short: 'SI' },
  intra_eu_distance_sale: { label: 'EU Distance Sale', color: 'bg-blue-100 text-blue-700', short: 'EU' },
  intra_eu_service: { label: 'EU Service', color: 'bg-purple-100 text-purple-700', short: 'SVC' },
  export: { label: 'Export (Non-EU)', color: 'bg-amber-100 text-amber-700', short: 'EXP' },
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

const PAYMENT_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-800',
}

function formatCurrency(amount: number | null | undefined) {
  if (amount == null) return '€0.00'
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [transactionFilter, setTransactionFilter] = useState<string>('all')
  const [intrastatFilter, setIntrastatFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [newOrder, setNewOrder] = useState({
    customer_email: '',
    order_number: '',
    status: 'pending',
    total: 0,
    market: 'si',
    transaction_type: 'domestic'
  })

  async function fetchOrders() {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('orders')
      .select('id,order_number,customer_email,status,payment_status,created_at,total,market,transaction_type,delivery_country,intrastat_reported')
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      setError(error.message)
    } else {
      setOrders(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false
    if (transactionFilter !== 'all' && o.transaction_type !== transactionFilter) return false
    if (intrastatFilter === 'pending' && (o.transaction_type !== 'intra_eu_distance_sale' || o.intrastat_reported)) return false
    if (intrastatFilter === 'reported' && !o.intrastat_reported) return false
    if (searchQuery && !o.order_number.toLowerCase().includes(searchQuery.toLowerCase()) && !o.customer_email.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  // Orders eligible for Intrastat marking (EU distance sales not yet reported)
  const eligibleForIntrastat = filteredOrders.filter(
    (o) => o.transaction_type === 'intra_eu_distance_sale' && !o.intrastat_reported
  )

  // Group counts for filters
  const transactionCounts = orders.reduce((acc, o) => {
    const type = o.transaction_type || 'domestic'
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const intrastatPending = orders.filter(o => o.transaction_type === 'intra_eu_distance_sale' && !o.intrastat_reported).length

  // Selection handlers
  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  const selectAllEligible = () => {
    const newSet = new Set(eligibleForIntrastat.map((o) => o.id))
    setSelectedIds(newSet)
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  // Bulk Intrastat marking
  const markAsReported = async () => {
    if (selectedIds.size === 0) return
    setBulkLoading(true)

    try {
      const res = await fetch('/api/admin/orders/bulk-intrastat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: Array.from(selectedIds),
          reportDate: new Date().toISOString().split('T')[0],
        }),
      })
      const data = await res.json()
      if (data.success) {
        // Update local state
        setOrders((prev) =>
          prev.map((o) =>
            selectedIds.has(o.id)
              ? { ...o, intrastat_reported: true }
              : o
          )
        )
        clearSelection()
      } else {
        alert('Failed to mark orders: ' + data.error)
      }
    } catch (err) {
      alert('Failed to mark orders')
    } finally {
      setBulkLoading(false)
    }
  }

  const unmarkAsReported = async () => {
    if (selectedIds.size === 0) return
    setBulkLoading(true)

    try {
      const res = await fetch('/api/admin/orders/bulk-intrastat', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderIds: Array.from(selectedIds),
        }),
      })
      const data = await res.json()
      if (data.success) {
        // Update local state
        setOrders((prev) =>
          prev.map((o) =>
            selectedIds.has(o.id)
              ? { ...o, intrastat_reported: false }
              : o
          )
        )
        clearSelection()
      } else {
        alert('Failed to unmark orders: ' + data.error)
      }
    } catch (err) {
      alert('Failed to unmark orders')
    } finally {
      setBulkLoading(false)
    }
  }

  // Count selected that are eligible
  const selectedEligibleCount = Array.from(selectedIds).filter((id) =>
    eligibleForIntrastat.some((o) => o.id === id)
  ).length

  const selectedReportedCount = Array.from(selectedIds).filter((id) =>
    orders.some((o) => o.id === id && o.intrastat_reported)
  ).length

  if (loading) return <div className="p-6">Loading orders...</div>
  if (error) return <div className="p-6 text-red-600">Error loading orders: {error}</div>

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Orders</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
          >
            + Create Order
          </button>
          <Link
            href="/admin/reporting/intrastat"
            className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100"
          >
            Intrastat Report →
          </Link>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-blue-800 font-medium">
              {selectedIds.size} order{selectedIds.size !== 1 ? 's' : ''} selected
            </span>
            <button
              onClick={clearSelection}
              className="text-blue-600 hover:text-blue-800 text-sm underline"
            >
              Clear selection
            </button>
          </div>
          <div className="flex items-center gap-3">
            {selectedEligibleCount > 0 && (
              <button
                onClick={markAsReported}
                disabled={bulkLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {bulkLoading ? 'Processing...' : `Mark ${selectedEligibleCount} as Intrastat Reported`}
              </button>
            )}
            {selectedReportedCount > 0 && (
              <button
                onClick={unmarkAsReported}
                disabled={bulkLoading}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
              >
                {bulkLoading ? 'Processing...' : `Unmark ${selectedReportedCount} Intrastat`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search order # or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Transaction type filter */}
          <select
            value={transactionFilter}
            onChange={(e) => setTransactionFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="all">All Transaction Types</option>
            <option value="domestic">Domestic (SI) ({transactionCounts.domestic || 0})</option>
            <option value="intra_eu_distance_sale">EU Distance Sale ({transactionCounts.intra_eu_distance_sale || 0})</option>
            <option value="intra_eu_service">EU Service ({transactionCounts.intra_eu_service || 0})</option>
            <option value="export">Export ({transactionCounts.export || 0})</option>
          </select>

          {/* Intrastat filter */}
          <select
            value={intrastatFilter}
            onChange={(e) => setIntrastatFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="all">All Intrastat</option>
            <option value="pending">Intrastat Pending ({intrastatPending})</option>
            <option value="reported">Intrastat Reported</option>
          </select>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-6 mt-4 pt-4 border-t text-sm">
          <span className="text-slate-500">
            Showing <span className="font-medium text-slate-800">{filteredOrders.length}</span> of {orders.length} orders
          </span>
          {intrastatPending > 0 && (
            <span className="flex items-center gap-1 text-amber-600">
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
              {intrastatPending} orders need Intrastat reporting
            </span>
          )}
          {eligibleForIntrastat.length > 0 && selectedIds.size === 0 && (
            <button
              onClick={selectAllEligible}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Select all {eligibleForIntrastat.length} pending for Intrastat
            </button>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.size > 0 && selectedIds.size === filteredOrders.length}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(new Set(filteredOrders.map((o) => o.id)))
                    } else {
                      clearSelection()
                    }
                  }}
                  className="rounded border-slate-300"
                />
              </th>
              <th className="text-left px-4 py-3">Order</th>
              <th className="text-left px-4 py-3">Customer</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Country</th>
              <th className="text-right px-4 py-3">Total</th>
              <th className="text-center px-4 py-3">Intrastat</th>
              <th className="text-right px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredOrders.map((o) => {
              const transactionType = TRANSACTION_TYPES[o.transaction_type || 'domestic'] || TRANSACTION_TYPES.domestic
              const statusColor = STATUS_COLORS[o.status || 'pending'] || 'bg-gray-100 text-gray-800'
              const paymentColor = PAYMENT_COLORS[o.payment_status || 'pending'] || 'bg-gray-100 text-gray-800'
              const needsIntrastat = o.transaction_type === 'intra_eu_distance_sale' && !o.intrastat_reported
              const isSelected = selectedIds.has(o.id)

              return (
                <tr
                  key={o.id}
                  className={`hover:bg-slate-50 ${needsIntrastat ? 'bg-amber-50/30' : ''} ${isSelected ? 'bg-blue-50/50' : ''}`}
                >
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(o.id)}
                      className="rounded border-slate-300"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-slate-800">{o.order_number}</div>
                    <div className="text-xs text-slate-400">
                      {o.created_at && new Date(o.created_at).toLocaleDateString('en-GB')}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-slate-600 truncate max-w-[200px]">{o.customer_email}</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium inline-block w-fit ${statusColor}`}>
                        {o.status || 'pending'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium inline-block w-fit ${paymentColor}`}>
                        {o.payment_status || 'pending'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-xs px-2 py-1 rounded font-medium ${transactionType.color}`}>
                      {transactionType.short}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-slate-600 uppercase">{o.delivery_country || o.market}</span>
                  </td>
                  <td className="text-right px-4 py-4 font-medium text-slate-800">
                    {formatCurrency(o.total)}
                  </td>
                  <td className="text-center px-4 py-4">
                    {o.transaction_type === 'intra_eu_distance_sale' ? (
                      o.intrastat_reported ? (
                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded font-medium">✓</span>
                      ) : (
                        <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded font-medium">Pending</span>
                      )
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="text-right px-6 py-4">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {filteredOrders.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            No orders match your filters
          </div>
        )}
      </div>

      {/* Create Order Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center text-slate-800">
              <h3 className="text-lg font-bold">Create Manual Order</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                setLoading(true)
                try {
                  const res = await fetch('/api/admin/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newOrder)
                  })
                  if (!res.ok) throw new Error('Failed to create order')
                  setIsCreateModalOpen(false)
                  fetchOrders()
                } catch (err: any) {
                  alert(err.message)
                } finally {
                  setLoading(false)
                }
              }}
              className="p-6 space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Customer Email</label>
                  <input
                    required
                    type="email"
                    value={newOrder.customer_email}
                    onChange={e => setNewOrder({ ...newOrder, customer_email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Order # (optional)</label>
                  <input
                    type="text"
                    placeholder="Auto-generated if empty"
                    value={newOrder.order_number}
                    onChange={e => setNewOrder({ ...newOrder, order_number: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={newOrder.status}
                    onChange={e => setNewOrder({ ...newOrder, status: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg appearance-none bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Total Amount (€)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={newOrder.total}
                    onChange={e => setNewOrder({ ...newOrder, total: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Market</label>
                  <select
                    value={newOrder.market}
                    onChange={e => setNewOrder({ ...newOrder, market: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg appearance-none bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="si">Slovenia</option>
                    <option value="de">Germany</option>
                    <option value="at">Austria</option>
                    <option value="it">Italy</option>
                    <option value="hr">Croatia</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
