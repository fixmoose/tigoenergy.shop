'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import type { Customer } from '@/types/database'
import { createCustomer } from '@/app/actions/customers'
import { createClient } from '@/lib/supabase/client'

type Tab = 'guest' | 'b2c' | 'b2b'

interface CustomerListProps {
    customers: Customer[]
}

interface UploadedDoc {
    id: string
    name: string
    date: string
    status: 'pending' | 'reviewed' | 'rejected'
    customerId?: string
    adminNote?: string
}

export default function CustomerList({ customers }: CustomerListProps) {
    const supabase = createClient()
    const [activeTab, setActiveTab] = useState<Tab>('b2c')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    // Admin Actions State
    const [docsModal, setDocsModal] = useState<{ isOpen: boolean, customerId: string | null }>({ isOpen: false, customerId: null })
    const [allDocs, setAllDocs] = useState<UploadedDoc[]>([])
    const [noteInput, setNoteInput] = useState('')

    // Load docs for "Pending" badges
    useEffect(() => {
        const storedDocs = localStorage.getItem('tigo_uploaded_docs')
        if (storedDocs) {
            setAllDocs(JSON.parse(storedDocs))
        }
    }, [])

    // Save docs back to storage
    const saveDocs = (newDocs: UploadedDoc[]) => {
        setAllDocs(newDocs)
        localStorage.setItem('tigo_uploaded_docs', JSON.stringify(newDocs))
    }

    const getPendingCount = (customerId: string) => {
        return allDocs.filter(d => d.customerId === customerId && d.status === 'pending').length
    }

    const handleDocAction = (docId: string, action: 'approve' | 'reject') => {
        const reason = action === 'reject' ? prompt('Enter reason for rejection:') : null
        if (action === 'reject' && !reason) return // Cancelled

        const updated = allDocs.map(d => {
            if (d.id === docId) {
                return {
                    ...d,
                    status: (action === 'approve' ? 'reviewed' : 'rejected') as 'reviewed' | 'rejected',
                    adminNote: reason || undefined
                } as UploadedDoc
            }
            return d
        })
        saveDocs(updated)
        // Force re-render of badge
    }

    const handleDeleteUser = async (customerId: string) => {
        if (!confirm('Are you sure you want to DELETE this user? This is irreversible.')) return

        const { error } = await supabase.from('customers').delete().eq('id', customerId)
        if (error) alert('Error: ' + error.message)
        else {
            alert('User deleted.')
            window.location.reload()
        }
    }

    const handleBanUser = async (customerId: string) => {
        if (!confirm('Are you sure you want to BAN this user? preventing future login.')) return

        const { error } = await supabase.from('customers').update({ account_status: 'banned' }).eq('id', customerId)
        if (error) alert('Error: ' + error.message)
        else {
            alert('User blocked.')
            window.location.reload()
        }
    }

    // New Customer Form State
    const [formData, setFormData] = useState({
        email: '',
        first_name: '',
        last_name: '',
        type: 'b2c' as Tab
    })

    // Filter Logic
    const filteredCustomers = customers.filter(c => {
        // Guest
        if (activeTab === 'guest') {
            return c.customer_type === 'guest'
        }
        // B2B
        if (activeTab === 'b2b') {
            return c.is_b2b === true
        }
        // B2C (Default: Not B2B and Not Guest)
        return !c.is_b2b && c.customer_type !== 'guest'
    })

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            await createCustomer({
                email: formData.email,
                first_name: formData.first_name,
                last_name: formData.last_name,
                is_b2b: formData.type === 'b2b',
                customer_type: formData.type === 'guest' ? 'guest' : undefined
            })
            setIsModalOpen(false)
            // Ideally trigger a refresh or optimistically update
            window.location.reload()
        } catch (error) {
            alert('Failed to create customer: ' + (error as Error).message)
        } finally {
            setLoading(false)
        }
    }

    const selectedCustomerDocs = allDocs.filter(d => d.customerId === docsModal.customerId)

    return (
        <div>
            {/* Header Actions */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Customers</h1>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm flex items-center gap-2"
                >
                    <span>+ Add Customer</span>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
                <button
                    onClick={() => setActiveTab('guest')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'guest' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                        }`}
                >
                    Guests
                </button>
                <button
                    onClick={() => setActiveTab('b2c')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'b2c' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                        }`}
                >
                    B2C Accounts
                </button>
                <button
                    onClick={() => setActiveTab('b2b')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'b2b' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                        }`}
                >
                    B2B Accounts
                </button>
            </div>

            {/* List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {filteredCustomers.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        No {activeTab.toUpperCase()} customers found.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                                <tr>
                                    <th className="px-4 py-3">Customer</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Email</th>
                                    <th className="px-4 py-3">Docs</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredCustomers.map((c) => {
                                    const pendingDocs = getPendingCount(c.id)
                                    return (
                                        <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-slate-900">{c.first_name} {c.last_name}</div>
                                                <div className="text-xs text-slate-400 font-mono">{c.id}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {c.account_status === 'banned' ? (
                                                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">Banned</span>
                                                ) : (
                                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Active</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">
                                                {c.email}
                                            </td>
                                            <td className="px-4 py-3">
                                                {pendingDocs > 0 ? (
                                                    <button
                                                        onClick={() => setDocsModal({ isOpen: true, customerId: c.id })}
                                                        className="inline-flex items-center gap-1.5 bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full text-xs font-bold hover:bg-orange-200"
                                                    >
                                                        <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                                                        {pendingDocs} Pending Review
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-400 text-xs">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right space-x-2">
                                                {pendingDocs > 0 && (
                                                    <button
                                                        onClick={() => setDocsModal({ isOpen: true, customerId: c.id })}
                                                        className="text-orange-600 hover:text-orange-800 font-medium text-xs underline"
                                                    >
                                                        Review
                                                    </button>
                                                )}
                                                <Link
                                                    href={`/admin/customers/${c.id}`}
                                                    className="text-blue-600 hover:text-blue-800 font-medium text-xs"
                                                >
                                                    Details
                                                </Link>
                                                <div className="inline-block border-l border-gray-300 mx-2 h-3 align-middle"></div>
                                                <button onClick={() => handleBanUser(c.id)} className="text-gray-500 hover:text-red-600 text-xs font-medium" title="Block User">
                                                    Block
                                                </button>
                                                <button onClick={() => handleDeleteUser(c.id)} className="text-gray-400 hover:text-red-600 text-xs font-medium" title="Delete User">
                                                    ✕
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Document Review Modal */}
            {docsModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="text-lg font-bold text-slate-800">Review Documents</h3>
                            <button onClick={() => setDocsModal({ isOpen: false, customerId: null })} className="text-slate-400 hover:text-slate-600">
                                ✕
                            </button>
                        </div>
                        <div className="p-6">
                            {selectedCustomerDocs.length === 0 ? (
                                <p className="text-center text-slate-500">No documents found for this user.</p>
                            ) : (
                                <div className="space-y-4">
                                    {selectedCustomerDocs.map(doc => (
                                        <div key={doc.id} className="border border-slate-200 rounded-lg p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-blue-50 p-3 rounded text-blue-600">
                                                    📄
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800">{doc.name}</p>
                                                    <p className="text-xs text-slate-500">{doc.date} • {doc.status.toUpperCase()}</p>
                                                    {doc.adminNote && <p className="text-xs text-red-500 mt-1">Reason: {doc.adminNote}</p>}
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <button className="text-sm border px-3 py-1.5 rounded hover:bg-slate-50">View</button>
                                                {doc.status === 'pending' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleDocAction(doc.id, 'reject')}
                                                            className="text-sm bg-red-50 text-red-600 px-3 py-1.5 rounded hover:bg-red-100 border border-red-100"
                                                        >
                                                            Reject
                                                        </button>
                                                        <button
                                                            onClick={() => handleDocAction(doc.id, 'approve')}
                                                            className="text-sm bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 shadow-sm"
                                                        >
                                                            Approve
                                                        </button>
                                                    </>
                                                )}
                                                {doc.status === 'reviewed' && <span className="text-green-600 font-bold text-sm px-3 py-1.5">Approved</span>}
                                                {doc.status === 'rejected' && <span className="text-red-600 font-bold text-sm px-3 py-1.5">Rejected</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Manual Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-800">Add New Customer</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Customer Type</label>
                                <div className="flex gap-2">
                                    {(['guest', 'b2c', 'b2b'] as const).map(type => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, type })}
                                            className={`flex-1 py-2 text-sm rounded-lg border ${formData.type === type
                                                ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium'
                                                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                                }`}
                                        >
                                            {type.toUpperCase()}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.first_name}
                                        onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.last_name}
                                        onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                                <input
                                    required
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                                >
                                    {loading ? 'Creating...' : 'Create Customer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
