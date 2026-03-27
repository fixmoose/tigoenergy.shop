'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Customer } from '@/types/database'
import { adminUpdateCustomerAction, adminDeleteCustomerAction } from '@/app/actions/admin'

interface CustomerDetailsEditorProps {
    customer: Customer
}

export default function CustomerDetailsEditor({ customer }: CustomerDetailsEditorProps) {
    const router = useRouter()
    const [isEditing, setIsEditing] = useState(false)
    const [loading, setLoading] = useState(false)
    const [resetLink, setResetLink] = useState<string | null>(null)
    const [linkCopied, setLinkCopied] = useState(false)
    const [formData, setFormData] = useState({
        first_name: customer.first_name || '',
        last_name: customer.last_name || '',
        email: customer.email || '',
        phone: customer.phone || '',
        company_name: customer.company_name || '',
        vat_id: customer.vat_id || '',
        payment_terms: customer.payment_terms || 'prepayment',
        payment_terms_days: customer.payment_terms_days ?? 0
    })

    const handleSave = async () => {
        setLoading(true)
        try {
            const res = await adminUpdateCustomerAction(customer.id, formData)
            if (res.success) {
                setIsEditing(false)
                router.refresh()
            }
        } catch (error: any) {
            alert('Error updating customer: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to PERMANENTLY DELETE this customer and their auth account? This cannot be undone.')) return

        setLoading(true)
        try {
            const res = await adminDeleteCustomerAction(customer.id)
            if (res.success) {
                router.push('/admin/customers')
            }
        } catch (error: any) {
            alert('Error deleting customer: ' + error.message)
            setLoading(false)
        }
    }

    return (
        <aside className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-8 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                <div>
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Details</h3>
                    {!isEditing && <p className="text-xl font-black text-gray-900">{customer.first_name} {customer.last_name}</p>}
                </div>
                <div className="flex gap-2">
                    {!isEditing ? (
                        <div className="flex gap-2">
                            <button
                                onClick={async () => {
                                    if (!confirm('Send password reset email to this customer?')) return
                                    setLoading(true)
                                    setResetLink(null)
                                    try {
                                        const { adminResetCustomerPasswordAction } = await import('@/app/actions/admin')
                                        const res = await adminResetCustomerPasswordAction(customer.id)
                                        if (res.success) {
                                            setResetLink(res.resetLink || null)
                                        } else {
                                            alert('Failed: ' + (res.error || 'Unknown error'))
                                        }
                                    } catch (err: any) {
                                        alert('Error: ' + err.message)
                                    } finally {
                                        setLoading(false)
                                    }
                                }}
                                disabled={loading}
                                className="bg-white border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-bold text-orange-600 hover:bg-orange-50 shadow-sm disabled:opacity-50"
                            >
                                Reset Password
                            </button>
                            <button
                                onClick={() => setIsEditing(true)}
                                className="bg-white border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 shadow-sm"
                            >
                                Edit
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-3 py-1.5 text-xs font-bold text-gray-400 hover:text-gray-600"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="bg-blue-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-blue-700 shadow-sm disabled:opacity-50"
                            >
                                {loading ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {resetLink && (
                <div className="mx-8 mt-6 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-xs font-bold text-amber-800 mb-2">Reset email sent! If customer didn't receive it, copy the link below and send it directly:</p>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            readOnly
                            value={resetLink}
                            className="flex-1 text-[11px] text-gray-700 bg-white border border-amber-200 rounded-lg px-2 py-1.5 font-mono"
                            onClick={e => (e.target as HTMLInputElement).select()}
                        />
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(resetLink)
                                setLinkCopied(true)
                                setTimeout(() => setLinkCopied(false), 2000)
                            }}
                            className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 whitespace-nowrap"
                        >
                            {linkCopied ? 'Copied!' : 'Copy Link'}
                        </button>
                    </div>
                    <p className="text-[10px] text-amber-600 mt-1">Link expires in 1 hour</p>
                </div>
            )}

            <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">First Name</label>
                        {isEditing ? (
                            <input
                                type="text"
                                value={formData.first_name}
                                onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                                className="w-full text-sm font-bold text-gray-900 border-b border-gray-200 focus:border-blue-500 outline-none pb-1"
                            />
                        ) : (
                            <p className="text-sm font-bold text-gray-900">{customer.first_name || 'N/A'}</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Last Name</label>
                        {isEditing ? (
                            <input
                                type="text"
                                value={formData.last_name}
                                onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                                className="w-full text-sm font-bold text-gray-900 border-b border-gray-200 focus:border-blue-500 outline-none pb-1"
                            />
                        ) : (
                            <p className="text-sm font-bold text-gray-900">{customer.last_name || 'N/A'}</p>
                        )}
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Email</label>
                    <p className="text-sm font-bold text-gray-900">{customer.email}</p>
                    {isEditing && <p className="text-[9px] text-gray-400 mt-1">Email cannot be changed here for security.</p>}
                </div>

                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Phone</label>
                    {isEditing ? (
                        <input
                            type="text"
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full text-sm font-bold text-gray-900 border-b border-gray-200 focus:border-blue-500 outline-none pb-1"
                        />
                    ) : (
                        <p className="text-sm font-bold text-gray-900">{customer.phone || 'N/A'}</p>
                    )}
                </div>

                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Company</label>
                    {isEditing ? (
                        <input
                            type="text"
                            value={formData.company_name}
                            onChange={e => setFormData({ ...formData, company_name: e.target.value })}
                            className="w-full text-sm font-bold text-gray-900 border-b border-gray-200 focus:border-blue-500 outline-none pb-1"
                        />
                    ) : (
                        <p className="text-sm font-bold text-gray-900">{customer.company_name || 'N/A'}</p>
                    )}
                </div>

                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">VAT ID</label>
                    {isEditing ? (
                        <input
                            type="text"
                            value={formData.vat_id}
                            onChange={e => setFormData({ ...formData, vat_id: e.target.value })}
                            className="w-full text-sm font-bold text-gray-900 border-b border-gray-200 focus:border-blue-500 outline-none pb-1"
                        />
                    ) : (
                        <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-gray-900">{customer.vat_id || 'N/A'}</p>
                            {customer.vat_validated && (
                                <span className="text-[9px] font-black bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-100 uppercase tracking-widest">VIES Verified</span>
                            )}
                        </div>
                    )}
                    {!isEditing && customer.vat_validated_at && (
                        <p className="text-[10px] text-gray-400 mt-0.5">Validated: {new Date(customer.vat_validated_at).toLocaleDateString()}</p>
                    )}
                </div>

                <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Payment Terms</label>
                    {isEditing ? (
                        <div className="space-y-2">
                            <select
                                value={formData.payment_terms}
                                onChange={e => {
                                    const val = e.target.value
                                    setFormData({
                                        ...formData,
                                        payment_terms: val,
                                        payment_terms_days: val === 'net30' ? 30 : 0
                                    })
                                }}
                                className="w-full text-sm font-bold text-gray-900 border border-gray-200 rounded-lg px-2 py-1.5 focus:border-blue-500 outline-none"
                            >
                                <option value="prepayment">Prepayment (before delivery)</option>
                                <option value="net30">Net 30 days</option>
                            </select>
                            {formData.payment_terms === 'net30' && (
                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-bold text-gray-500">Days:</label>
                                    <input
                                        type="number"
                                        value={formData.payment_terms_days}
                                        onChange={e => setFormData({ ...formData, payment_terms_days: parseInt(e.target.value) || 0 })}
                                        min={1}
                                        max={120}
                                        className="w-20 text-sm font-bold text-gray-900 border border-gray-200 rounded-lg px-2 py-1 focus:border-blue-500 outline-none"
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            {(customer.payment_terms || 'prepayment') === 'prepayment' ? (
                                <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">Prepayment</span>
                            ) : (
                                <span className="text-xs font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-100">
                                    Net {customer.payment_terms_days || 30} days
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Registration & Compliance Info */}
                {!isEditing && (
                    <div className="pt-4 border-t border-gray-100 space-y-4">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Registration Info</h4>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Account Type</label>
                                <p className="text-sm font-bold text-gray-900">{customer.is_b2b ? 'B2B' : (customer.customer_type === 'guest' ? 'Guest' : 'B2C')}</p>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</label>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${customer.account_status === 'banned' ? 'bg-red-50 text-red-700' : customer.account_status === 'active' ? 'bg-amber-50 text-amber-700' : 'bg-yellow-50 text-yellow-700'}`}>
                                    {customer.account_status || 'pending'}
                                </span>
                            </div>
                        </div>

                        {customer.terms_agreed_at && (
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Terms Agreed</label>
                                <p className="text-sm font-bold text-amber-700">{new Date(customer.terms_agreed_at).toLocaleString()}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Newsletter</label>
                                <p className="text-sm font-bold text-gray-900">{customer.newsletter_subscribed ? 'Subscribed' : 'No'}</p>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Marketing</label>
                                <p className="text-sm font-bold text-gray-900">{customer.marketing_consent ? 'Opted In' : 'No'}</p>
                            </div>
                        </div>

                        {(customer as any).preferred_language && (
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Language</label>
                                <p className="text-sm font-bold text-gray-900 uppercase">{(customer as any).preferred_language}</p>
                            </div>
                        )}

                        {customer.created_at && (
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Registered</label>
                                <p className="text-sm font-bold text-gray-900">{new Date(customer.created_at).toLocaleString()}</p>
                            </div>
                        )}

                        {customer.internal_notes && (
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Internal Notes</label>
                                <p className="text-sm text-gray-600 bg-yellow-50 p-2 rounded-lg border border-yellow-100 whitespace-pre-wrap">{customer.internal_notes}</p>
                            </div>
                        )}
                    </div>
                )}

                {isEditing && (
                    <div className="pt-6 border-t border-gray-100">
                        <button
                            onClick={handleDelete}
                            disabled={loading}
                            className="w-full py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition disabled:opacity-50"
                        >
                            Delete Customer
                        </button>
                    </div>
                )}
            </div>
        </aside>
    )
}
