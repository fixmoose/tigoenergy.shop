'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Order } from '@/types/database'
import AdminManualOrderCreator from '@/components/admin/AdminManualOrderCreator'
import { resolveInvoicePdfUrl } from '@/lib/utils/invoice-pdf-url'

function formatCurrency(amount: number) {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)
}

interface ManualInvoice {
    id: string
    invoice_number: string
    invoice_date: string
    customer_name: string | null
    company_name: string | null
    vat_id: string | null
    net_amount: number
    vat_amount: number
    total: number
    currency: string
    pdf_url: string | null
    notes: string | null
    paid: boolean
    paid_at: string | null
    created_at: string
}

export default function InvoicesPage() {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [manualInvoices, setManualInvoices] = useState<ManualInvoice[]>([])
    const [uploading, setUploading] = useState(false)
    const [uploadStatus, setUploadStatus] = useState<string[]>([])
    const [dragOver, setDragOver] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editForm, setEditForm] = useState<Partial<ManualInvoice>>({})
    const fileInputRef = useRef<HTMLInputElement>(null)
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

    async function fetchManualInvoices() {
        const res = await fetch('/api/admin/manual-invoices')
        const data = await res.json()
        if (data.success) setManualInvoices(data.data || [])
    }

    const uploadFiles = useCallback(async (files: FileList | File[]) => {
        const pdfs = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf'))
        if (pdfs.length === 0) return

        setUploading(true)
        setUploadStatus([])
        const statuses: string[] = []

        for (const file of pdfs) {
            statuses.push(`Uploading ${file.name}...`)
            setUploadStatus([...statuses])
            const form = new FormData()
            form.append('file', file)
            try {
                const res = await fetch('/api/admin/manual-invoices', { method: 'POST', body: form })
                const data = await res.json()
                if (data.success) {
                    statuses[statuses.length - 1] = `${file.name} — ${data.data.invoice_number || 'imported'}`
                } else {
                    statuses[statuses.length - 1] = `${file.name} — Error: ${data.error}`
                }
            } catch {
                statuses[statuses.length - 1] = `${file.name} — Upload failed`
            }
            setUploadStatus([...statuses])
        }

        setUploading(false)
        fetchManualInvoices()
        setTimeout(() => setUploadStatus([]), 5000)
    }, [])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files)
    }, [uploadFiles])

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(true)
    }, [])

    const handleDragLeave = useCallback(() => setDragOver(false), [])

    const startEdit = (inv: ManualInvoice) => {
        setEditingId(inv.id)
        setEditForm({ invoice_number: inv.invoice_number, invoice_date: inv.invoice_date, customer_name: inv.customer_name || '', company_name: inv.company_name || '', vat_id: inv.vat_id || '', net_amount: inv.net_amount, vat_amount: inv.vat_amount, total: inv.total })
    }

    const saveEdit = async () => {
        if (!editingId) return
        await fetch('/api/admin/manual-invoices', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingId, ...editForm }) })
        setEditingId(null)
        fetchManualInvoices()
    }

    const togglePaid = async (inv: ManualInvoice) => {
        const newPaid = !inv.paid
        await fetch('/api/admin/manual-invoices', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: inv.id, paid: newPaid, paid_at: newPaid ? new Date().toISOString() : null })
        })
        fetchManualInvoices()
    }

    const deleteInvoice = async (id: string) => {
        if (!confirm('Delete this imported invoice?')) return
        await fetch('/api/admin/manual-invoices', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
        fetchManualInvoices()
    }

    useEffect(() => {
        fetchOrders()
        fetchManualInvoices()
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

            {/* Import External Invoices — Drag & Drop */}
            <div className="space-y-4">
                <h2 className="text-lg font-bold text-slate-800">Import External Invoices</h2>
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'}`}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf"
                        multiple
                        className="hidden"
                        onChange={e => e.target.files && uploadFiles(e.target.files)}
                    />
                    <div className="text-3xl mb-2">{uploading ? '...' : '📄'}</div>
                    <p className="text-sm font-bold text-slate-600">
                        {uploading ? 'Processing...' : 'Drop PDF invoices here or click to select'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Data will be extracted automatically. You can edit after import.</p>
                </div>

                {uploadStatus.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1">
                        {uploadStatus.map((s, i) => (
                            <div key={i} className="text-xs text-slate-600">{s}</div>
                        ))}
                    </div>
                )}

                {/* Imported Invoices Table */}
                {manualInvoices.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500 uppercase">Imported Invoices ({manualInvoices.length})</span>
                        </div>
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Invoice #</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Date</th>
                                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Customer</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Net</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">VAT</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Total</th>
                                    <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Status</th>
                                    <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase w-32">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {manualInvoices.map(inv => (
                                    <tr key={inv.id} className="hover:bg-slate-50/50 transition">
                                        {editingId === inv.id ? (
                                            <>
                                                <td className="px-4 py-2"><input className="w-full border rounded px-2 py-1 text-xs font-mono" value={editForm.invoice_number || ''} onChange={e => setEditForm(f => ({ ...f, invoice_number: e.target.value }))} /></td>
                                                <td className="px-4 py-2"><input type="date" className="border rounded px-2 py-1 text-xs" value={editForm.invoice_date || ''} onChange={e => setEditForm(f => ({ ...f, invoice_date: e.target.value }))} /></td>
                                                <td className="px-4 py-2">
                                                    <input className="w-full border rounded px-2 py-1 text-xs mb-1" placeholder="Company" value={editForm.company_name || ''} onChange={e => setEditForm(f => ({ ...f, company_name: e.target.value }))} />
                                                    <input className="w-full border rounded px-2 py-1 text-xs" placeholder="Name" value={editForm.customer_name || ''} onChange={e => setEditForm(f => ({ ...f, customer_name: e.target.value }))} />
                                                </td>
                                                <td className="px-4 py-2"><input type="number" step="0.01" className="w-20 border rounded px-2 py-1 text-xs text-right" value={editForm.net_amount || 0} onChange={e => setEditForm(f => ({ ...f, net_amount: Number(e.target.value) }))} /></td>
                                                <td className="px-4 py-2"><input type="number" step="0.01" className="w-20 border rounded px-2 py-1 text-xs text-right" value={editForm.vat_amount || 0} onChange={e => setEditForm(f => ({ ...f, vat_amount: Number(e.target.value) }))} /></td>
                                                <td className="px-4 py-2"><input type="number" step="0.01" className="w-20 border rounded px-2 py-1 text-xs text-right" value={editForm.total || 0} onChange={e => setEditForm(f => ({ ...f, total: Number(e.target.value) }))} /></td>
                                                <td></td>
                                                <td className="px-4 py-2 text-right space-x-1">
                                                    <button onClick={saveEdit} className="text-xs font-bold text-green-600 hover:text-green-800">Save</button>
                                                    <button onClick={() => setEditingId(null)} className="text-xs font-bold text-slate-400 hover:text-slate-600">Cancel</button>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-4 py-3 font-mono font-bold text-slate-800">{inv.invoice_number}</td>
                                                <td className="px-4 py-3 text-slate-600">{new Date(inv.invoice_date).toLocaleDateString('en-GB')}</td>
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-slate-800">{inv.company_name || inv.customer_name || '-'}</div>
                                                    {inv.vat_id && <div className="text-[10px] text-slate-400">{inv.vat_id}</div>}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(inv.net_amount)}</td>
                                                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(inv.vat_amount)}</td>
                                                <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(inv.total)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => togglePaid(inv)}
                                                        className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase cursor-pointer transition ${inv.paid ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                                                        title={inv.paid && inv.paid_at ? `Paid on ${new Date(inv.paid_at).toLocaleDateString('en-GB')}` : 'Click to mark as paid'}
                                                    >
                                                        {inv.paid ? 'Paid' : 'Unpaid'}
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3 text-right space-x-2">
                                                    {resolveInvoicePdfUrl(inv.pdf_url) && <a href={resolveInvoicePdfUrl(inv.pdf_url)!} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-500 hover:text-blue-700">PDF</a>}
                                                    <button onClick={() => startEdit(inv)} className="text-xs font-bold text-slate-500 hover:text-slate-700">Edit</button>
                                                    <button onClick={() => deleteInvoice(inv.id)} className="text-xs font-bold text-red-400 hover:text-red-600">Del</button>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-50 font-bold border-t border-slate-200">
                                    <td colSpan={3} className="px-4 py-3 text-slate-600 text-xs">TOTAL</td>
                                    <td className="px-4 py-3 text-right text-slate-600 text-xs">{formatCurrency(manualInvoices.reduce((s, i) => s + i.net_amount, 0))}</td>
                                    <td className="px-4 py-3 text-right text-slate-600 text-xs">{formatCurrency(manualInvoices.reduce((s, i) => s + i.vat_amount, 0))}</td>
                                    <td className="px-4 py-3 text-right text-slate-800 text-xs">{formatCurrency(manualInvoices.reduce((s, i) => s + i.total, 0))}</td>
                                    <td className="px-4 py-3 text-center text-[10px] text-slate-500">
                                        {manualInvoices.filter(i => !i.paid).length > 0 && (
                                            <span className="text-red-600 font-bold">{formatCurrency(manualInvoices.filter(i => !i.paid).reduce((s, i) => s + i.total, 0))} unpaid</span>
                                        )}
                                    </td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
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
