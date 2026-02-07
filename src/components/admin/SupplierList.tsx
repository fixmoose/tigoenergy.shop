'use client'

import { useState } from 'react'
import { createSupplier, deleteSupplier } from '@/app/actions/suppliers'
import type { Supplier } from '@/types/database'

export default function SupplierList({ suppliers }: { suppliers: Supplier[] }) {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        try {
            const formData = new FormData(e.currentTarget)
            await createSupplier(formData)
            setIsModalOpen(false)
        } catch (error) {
            alert('Error creating supplier: ' + (error as Error).message)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this supplier?')) return
        try {
            await deleteSupplier(id)
        } catch (error) {
            alert('Error deleting: ' + (error as Error).message)
        }
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Suppliers</h1>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                    + Add Supplier
                </button>
            </div>

            <div className="bg-white rounded border shadow-sm">
                {suppliers.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No suppliers found.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-4 py-3">Name</th>
                                    <th className="px-4 py-3">Contact</th>
                                    <th className="px-4 py-3">Location</th>
                                    <th className="px-4 py-3">VAT ID</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {suppliers.map(s => (
                                    <tr key={s.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium">{s.name}</td>
                                        <td className="px-4 py-3 text-gray-600">
                                            <div>{s.contact_person}</div>
                                            <div className="text-xs">{s.email}</div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            {s.city}, {s.country}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-xs">{s.vat_id}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => handleDelete(s.id)}
                                                className="text-red-600 hover:underline"
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden">
                        <div className="border-b px-6 py-4 flex justify-between items-center">
                            <h3 className="text-lg font-bold">Add New Supplier</h3>
                            <button onClick={() => setIsModalOpen(false)}>✕</button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
                            {/* Basic Info */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Company Name *</label>
                                    <input name="name" required className="w-full border rounded p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">VAT ID</label>
                                    <input name="vat_id" className="w-full border rounded p-2" />
                                </div>
                            </div>

                            {/* Contact */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Contact Person</label>
                                    <input name="contact_person" className="w-full border rounded p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Email</label>
                                    <input name="email" type="email" className="w-full border rounded p-2" />
                                </div>
                            </div>

                            {/* Address */}
                            <div className="border-t pt-4 mt-2">
                                <h4 className="text-sm font-semibold mb-3 text-gray-700">Address</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Address Line 1</label>
                                        <input name="address_line1" className="w-full border rounded p-2" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">City</label>
                                        <input name="city" className="w-full border rounded p-2" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Postal Code</label>
                                        <input name="postal_code" className="w-full border rounded p-2" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Country</label>
                                        <input name="country" className="w-full border rounded p-2" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-2 border rounded hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {loading ? 'Saving...' : 'Create Supplier'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
