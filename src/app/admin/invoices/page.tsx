'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Order } from '@/types/database'
import AdminManualOrderCreator from '@/components/admin/AdminManualOrderCreator'

function formatCurrency(amount: number) {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)
}

export default function InvoicesPage() {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const supabase = createClient()

    async function fetchOrders() {
        setLoading(true)
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .not('status', 'eq', 'cancelled')
            .order('invoice_created_at', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false })

        if (data) setOrders(data as Order[])
        setLoading(false)
    }

    useEffect(() => {
        fetchOrders()
    }, [])

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-800">Invoices & Financial Documents</h1>
                <div className="flex gap-2">
                    <Link href="/admin/reporting/oss" className="px-4 py-2 bg-blue-50 text-blue-700 rounded-xl font-medium text-sm hover:bg-blue-100 transition">
                        OSS Reporting
                    </Link>
                    <Link href="/admin/reporting/intrastat" className="px-4 py-2 bg-amber-50 text-amber-700 rounded-xl font-medium text-sm hover:bg-amber-100 transition">
                        Intrastat Report
                    </Link>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="text-left px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Invoice #</th>
                            <th className="text-left px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Order #</th>
                            <th className="text-left px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Customer</th>
                            <th className="text-left px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Date</th>
                            <th className="text-right px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Amount</th>
                            <th className="text-center px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Status</th>
                            <th className="text-right px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-xs">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="text-center py-10 text-slate-400">Loading documents...</td>
                            </tr>
                        ) : projects_with_invoices()}
                    </tbody>
                </table>

                {(!loading && orders.length === 0) && (
                    <div className="py-20 text-center">
                        <div className="text-4xl mb-4">📑</div>
                        <h3 className="text-lg font-bold text-slate-800">No invoices found</h3>
                        <p className="text-slate-500 mt-1">Orders awaiting invoice will appear here.</p>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-100">
                    <p className="text-blue-100 text-sm font-medium uppercase tracking-wider">Awaiting Invoice</p>
                    <h2 className="text-3xl font-black mt-1">{orders.filter(o => !o.invoice_url).length}</h2>
                    <p className="text-blue-100 text-xs mt-2">Orders ready for financial processing.</p>
                </div>
                <div className="bg-red-600 rounded-2xl p-6 text-white shadow-lg shadow-red-100">
                    <p className="text-red-100 text-sm font-medium uppercase tracking-wider">Open Invoices</p>
                    <h2 className="text-3xl font-black mt-1">{orders.filter(o => o.invoice_url && o.payment_status !== 'paid').length}</h2>
                    <p className="text-red-100 text-xs mt-2">
                        {formatCurrency(orders.filter(o => o.invoice_url && o.payment_status !== 'paid').reduce((acc, o) => acc + (o.total || 0), 0))} outstanding
                    </p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">Total Invoiced (Q1)</p>
                    <h2 className="text-3xl font-black text-slate-800 mt-1">
                        {formatCurrency(orders.filter(o => o.invoice_url).reduce((acc, o) => acc + (o.total || 0), 0))}
                    </h2>
                    <p className="text-slate-500 text-xs mt-2">Export data for balance sheet.</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                    <p className="text-slate-500 text-sm font-medium uppercase tracking-wider">Manual Invoices</p>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="w-full mt-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition shadow-lg shadow-slate-100"
                    >
                        + Create One-Off Invoice
                    </button>
                </div>
            </div>

            {isCreateModalOpen && (
                <AdminManualOrderCreator
                    onClose={() => setIsCreateModalOpen(false)}
                    onCreated={() => {
                        setIsCreateModalOpen(false)
                        fetchOrders()
                    }}
                    isInvoiceMode={true}
                />
            )}
        </div>
    )

    function projects_with_invoices() {
        return orders.map((order) => (
            <tr key={order.id} className="hover:bg-slate-50/50 transition">
                <td className="px-6 py-4">
                    {order.invoice_number ? (
                        <span className="font-mono font-bold text-slate-900">{order.invoice_number}</span>
                    ) : (
                        <span className="text-slate-400 italic">Not generated</span>
                    )}
                </td>
                <td className="px-6 py-4">
                    <Link href={`/admin/orders/${order.id}`} className="text-blue-600 hover:underline font-medium">
                        {order.order_number}
                    </Link>
                </td>
                <td className="px-6 py-4">
                    <div className="font-medium text-slate-800">{order.company_name || `${(order.shipping_address as any)?.first_name} ${(order.shipping_address as any)?.last_name}`}</div>
                    <div className="text-xs text-slate-500">{order.customer_email}</div>
                </td>
                <td className="px-6 py-4 text-slate-600">
                    {order.invoice_created_at ? new Date(order.invoice_created_at).toLocaleDateString('en-GB') : new Date(order.created_at!).toLocaleDateString('en-GB')}
                </td>
                <td className="px-6 py-4 text-right font-bold text-slate-900">
                    {formatCurrency(order.total)}
                </td>
                <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center gap-1">
                        {order.invoice_url ? (
                            <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase">Issued</span>
                        ) : (
                            <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold uppercase">Pending</span>
                        )}
                        {order.invoice_url && (
                            order.payment_status === 'paid' ? (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold uppercase">Paid</span>
                            ) : (
                                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-[10px] font-bold uppercase">Open</span>
                            )
                        )}
                    </div>
                </td>
                <td className="px-6 py-4 text-right">
                    {order.invoice_url ? (
                        <a
                            href={order.invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm font-bold text-blue-600 hover:text-blue-700"
                        >
                            <span>📥</span> Download
                        </a>
                    ) : (
                        <Link
                            href={`/admin/orders/${order.id}`}
                            className="text-sm font-bold text-slate-400 hover:text-blue-600"
                        >
                            Manage
                        </Link>
                    )}
                </td>
            </tr>
        ))
    }
}
