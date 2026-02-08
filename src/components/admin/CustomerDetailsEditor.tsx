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
    const [formData, setFormData] = useState({
        first_name: customer.first_name || '',
        last_name: customer.last_name || '',
        email: customer.email || '',
        phone: customer.phone || '',
        company_name: customer.company_name || '',
        vat_id: customer.vat_id || ''
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
                        <button
                            onClick={() => setIsEditing(true)}
                            className="bg-white border border-gray-200 px-3 py-1.5 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 shadow-sm"
                        >
                            Edit
                        </button>
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
                        <p className="text-sm font-bold text-gray-900">{customer.vat_id || 'N/A'}</p>
                    )}
                </div>

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
