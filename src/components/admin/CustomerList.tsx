'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Customer } from '@/types/database'
import { createCustomer } from '@/app/actions/customers'
import { adminCreateCustomerAction, adminUpdateCustomerAction, adminResetCustomerPasswordAction } from '@/app/actions/admin'
import { createClient } from '@/lib/supabase/client'

type Tab = 'all' | 'guest' | 'b2c' | 'b2b'

interface CustomerListProps {
    customers: (Customer & { orders?: any[] })[]
}

const MARKET_MAP: Record<string, { domain: string, flag: string }> = {
    'de': { domain: 'tigoenergy.de', flag: '🇩🇪' },
    'si': { domain: 'tigoenergy.si', flag: '🇸🇮' },
    'fr': { domain: 'tigoenergy.fr', flag: '🇫🇷' },
    'it': { domain: 'tigoenergy.it', flag: '🇮🇹' },
    'es': { domain: 'tigoenergy.es', flag: '🇪🇸' },
    'nl': { domain: 'tigoenergy.nl', flag: '🇳🇱' },
    'pl': { domain: 'tigoenergy.pl', flag: '🇵🇱' },
    'at': { domain: 'tigoenergy.at', flag: '🇦🇹' },
    'ch': { domain: 'tigoenergy.ch', flag: '🇨🇭' },
    'be': { domain: 'tigoenergy.be', flag: '🇧🇪' },
    'uk': { domain: 'tigoenergy.org.uk', flag: '🇬🇧' },
    'hr': { domain: 'tigoenergy.shop', flag: '🇭🇷' },
    'cz': { domain: 'tigoenergy.shop', flag: '🇨🇿' },
    'sk': { domain: 'tigoenergy.shop', flag: '🇸🇰' },
    'hu': { domain: 'tigoenergy.shop', flag: '🇭🇺' },
    'ro': { domain: 'tigoenergy.shop', flag: '🇷🇴' },
    'bg': { domain: 'tigoenergy.shop', flag: '🇧🇬' },
    'pt': { domain: 'tigoenergy.shop', flag: '🇵🇹' },
    'dk': { domain: 'tigoenergy.shop', flag: '🇩🇰' },
    'se': { domain: 'tigoenergy.shop', flag: '🇸🇪' },
    'fi': { domain: 'tigoenergy.shop', flag: '🇫🇮' },
    'ie': { domain: 'tigoenergy.shop', flag: '🇮🇪' },
    'lt': { domain: 'tigoenergy.shop', flag: '🇱🇹' },
    'lv': { domain: 'tigoenergy.shop', flag: '🇱🇻' },
    'ee': { domain: 'tigoenergy.shop', flag: '🇪🇪' },
    'lu': { domain: 'tigoenergy.shop', flag: '🇱🇺' },
    'mt': { domain: 'tigoenergy.shop', flag: '🇲🇹' },
    'cy': { domain: 'tigoenergy.shop', flag: '🇨🇾' },
    'rs': { domain: 'tigoenergy.shop', flag: '🇷🇸' },
    'ba': { domain: 'tigoenergy.shop', flag: '🇧🇦' },
    'mk': { domain: 'tigoenergy.shop', flag: '🇲🇰' },
    'me': { domain: 'tigoenergy.shop', flag: '🇲🇪' },
    'al': { domain: 'tigoenergy.shop', flag: '🇦🇱' },
    'no': { domain: 'tigoenergy.shop', flag: '🇳🇴' },
    'gr': { domain: 'tigoenergy.shop', flag: '🇬🇷' },
    'global': { domain: 'tigoenergy.shop', flag: '🌍' }
}

// VAT prefix → country code (VIES uses 2-letter EU prefixes, some differ from ISO)
const VAT_PREFIX_TO_COUNTRY: Record<string, string> = {
    'AT': 'at', 'BE': 'be', 'BG': 'bg', 'CY': 'cy', 'CZ': 'cz',
    'DE': 'de', 'DK': 'dk', 'EE': 'ee', 'EL': 'gr', 'ES': 'es',
    'FI': 'fi', 'FR': 'fr', 'HR': 'hr', 'HU': 'hu', 'IE': 'ie',
    'IT': 'it', 'LT': 'lt', 'LU': 'lu', 'LV': 'lv', 'MT': 'mt',
    'NL': 'nl', 'PL': 'pl', 'PT': 'pt', 'RO': 'ro', 'SE': 'se',
    'SI': 'si', 'SK': 'sk', 'GB': 'uk', 'XI': 'uk',
    'RS': 'rs', 'BA': 'ba', 'MK': 'mk', 'ME': 'me', 'AL': 'al',
    'NO': 'no', 'CH': 'ch',
}

function getMarketInfo(customer: any) {
    // 1. Try VAT ID prefix (most reliable for B2B)
    if (customer.vat_id) {
        const vatPrefix = customer.vat_id.replace(/\s/g, '').slice(0, 2).toUpperCase()
        const vatCountry = VAT_PREFIX_TO_COUNTRY[vatPrefix]
        if (vatCountry && MARKET_MAP[vatCountry]) {
            return MARKET_MAP[vatCountry]
        }
    }

    // 2. Try delivery country from latest order (most accurate)
    const latestOrder = customer.orders?.[0]
    if (latestOrder?.delivery_country) {
        const dc = latestOrder.delivery_country.toLowerCase()
        if (MARKET_MAP[dc]) return MARKET_MAP[dc]
    }

    // 3. Try shipping address country from latest order
    if (latestOrder?.shipping_address?.country) {
        const sc = latestOrder.shipping_address.country.toLowerCase()
        if (MARKET_MAP[sc]) return MARKET_MAP[sc]
    }

    // 4. Try saved addresses
    const shippingAddr = customer.addresses?.find((a: any) => a.isDefaultShipping) || customer.addresses?.find((a: any) => !a.isViesAddress) || customer.addresses?.[0]
    const country = shippingAddr?.country?.toLowerCase()
    if (country && MARKET_MAP[country]) {
        return MARKET_MAP[country]
    }

    // 4. Fallback
    return MARKET_MAP['global']
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
    const [activeTab, setActiveTab] = useState<Tab>('all')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    // Admin Actions State
    const [createdCustomer, setCreatedCustomer] = useState<{ id: string, email: string } | null>(null)
    const [welcomeSending, setWelcomeSending] = useState(false)
    const [docsModal, setDocsModal] = useState<{ isOpen: boolean, customerId: string | null }>({ isOpen: false, customerId: null })
    const [editModal, setEditModal] = useState<{ isOpen: boolean, customer: Customer | null }>({ isOpen: false, customer: null })
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

    const handleReactivateUser = async (customerId: string, email: string) => {
        if (!confirm(`Reactivate ${email}? This will create a new auth account and send a welcome email.`)) return
        setLoading(true)
        try {
            const { adminReactivateCustomerAction } = await import('@/app/actions/admin')
            const res = await adminReactivateCustomerAction(customerId)
            if (res.success) {
                alert('Customer reactivated! A password reset email has been sent.')
                window.location.reload()
            } else {
                alert(res.error || 'Failed to reactivate')
            }
        } catch (err) {
            alert('Failed to reactivate: ' + (err as Error).message)
        } finally {
            setLoading(false)
        }
    }

    const handleResetPassword = async (email: string) => {
        if (!confirm(`Are you sure you want to send a password reset email to ${email}?`)) return
        setLoading(true)
        try {
            const res = await adminResetCustomerPasswordAction(email)
            if (res.success) {
                alert('Password reset email sent.')
            } else {
                alert('Error: ' + res.error)
            }
        } catch (error) {
            alert('Failed to send reset email.')
        } finally {
            setLoading(false)
        }
    }

    // New Customer Form State
    const [formData, setFormData] = useState({
        email: '',
        first_name: '',
        last_name: '',
        phone: '',
        password: '',
        type: 'b2c' as Tab,
        company_name: '',
        vat_id: '',
        vies_address: '',
        vies_country: ''
    })

    const [editData, setEditData] = useState<Partial<Customer>>({})

    // Filter Logic — deleted accounts always sort to bottom
    const sortedCustomers = [...customers].sort((a, b) => {
        const aDeleted = a.account_status === 'deleted' ? 1 : 0
        const bDeleted = b.account_status === 'deleted' ? 1 : 0
        if (aDeleted !== bDeleted) return aDeleted - bDeleted
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    })
    const filteredCustomers = sortedCustomers.filter(c => {
        if (activeTab === 'all') return true
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
            const result = await adminCreateCustomerAction({
                email: formData.email,
                first_name: formData.first_name,
                last_name: formData.last_name,
                phone: formData.phone,
                password: formData.password,
                is_b2b: formData.type === 'b2b',
                company_name: formData.company_name,
                vat_id: formData.vat_id,
                vies_address: formData.vies_address,
                vies_country: formData.vies_country,
                customer_type: formData.type === 'guest' ? 'guest' : undefined
            })
            if (result.success && result.data?.userId) {
                setCreatedCustomer({ id: result.data.userId, email: formData.email })
            } else {
                alert(result.error || 'Failed to create customer')
            }
        } catch (error) {
            alert('Failed to create customer: ' + (error as Error).message)
        } finally {
            setLoading(false)
        }
    }

    const handleSendWelcomeEmail = async () => {
        if (!createdCustomer) return
        setWelcomeSending(true)
        try {
            const result = await adminResetCustomerPasswordAction(createdCustomer.email)
            if (result.success) {
                alert('Welcome email with password reset link sent!')
            } else {
                alert(result.error || 'Failed to send welcome email')
            }
        } catch {
            alert('Failed to send welcome email')
        } finally {
            setWelcomeSending(false)
        }
    }

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editModal.customer) return
        setLoading(true)
        try {
            await adminUpdateCustomerAction(editModal.customer.id, editData)
            setEditModal({ isOpen: false, customer: null })
            alert('Customer updated.')
            window.location.reload()
        } catch (error) {
            alert('Failed to update customer: ' + (error as Error).message)
        } finally {
            setLoading(false)
        }
    }

    const handleVerifyVATInEdit = async () => {
        if (!editData.vat_id) return
        setLoading(true)
        try {
            const res = await fetch('/api/validate/vat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vatNumber: editData.vat_id })
            })
            const data = await res.json()
            if (data.valid) {
                setEditData({
                    ...editData,
                    company_name: data.name
                })
                alert('VAT Verified! Company name updated.')
            } else {
                alert(data.error || 'Invalid VAT number')
            }
        } catch (error) {
            alert('Connection error')
        } finally {
            setLoading(false)
        }
    }

    const handleVerifyVATInCreate = async () => {
        if (!formData.vat_id) return
        setLoading(true)
        try {
            const res = await fetch('/api/validate/vat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vatNumber: formData.vat_id })
            })
            const data = await res.json()
            if (data.valid) {
                setFormData({
                    ...formData,
                    company_name: data.name,
                    type: 'b2b',
                    vies_address: data.address || '',
                    vies_country: data.countryCode || ''
                })
                // alert replaced by inline address display
            } else {
                alert(data.error || 'Invalid VAT number')
            }
        } catch (error) {
            alert('Connection error')
        } finally {
            setLoading(false)
        }
    }

    const router = useRouter()
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
                    onClick={() => setActiveTab('all')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                        }`}
                >
                    All Customers
                </button>
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
                                    <th className="px-4 py-3">Library</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredCustomers.map((c) => {
                                    const pendingDocs = getPendingCount(c.id)
                                    const marketInfo = getMarketInfo(c)
                                    const isDeleted = c.account_status === 'deleted'
                                    return (
                                        <tr
                                            key={c.id}
                                            className={`transition-colors cursor-pointer group ${isDeleted ? 'opacity-50 bg-slate-50 hover:bg-slate-100' : 'hover:bg-slate-50'}`}
                                            onClick={() => router.push(`/admin/customers/${c.id}`)}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-lg ${isDeleted ? 'grayscale' : ''}`} title={marketInfo.domain}>{marketInfo.flag}</span>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <div className={`font-medium transition-colors ${isDeleted ? 'text-slate-400 line-through' : 'text-slate-900 group-hover:text-blue-600'}`}>
                                                                {c.company_name || `${c.first_name} ${c.last_name}`}
                                                            </div>
                                                            {((c as any).b2b_customer_prices?.length > 0) && (
                                                                <span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-1.5 py-0.5 rounded border border-blue-100 flex items-center gap-1" title="Custom pricing set up for this user">
                                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                                                    Custom Pricing
                                                                </span>
                                                            )}
                                                        </div>
                                                        {c.company_name && (c.first_name || c.last_name) && (
                                                            <div className="text-xs text-slate-500">{c.first_name} {c.last_name}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                {c.account_status === 'deleted' ? (
                                                    <span className="text-xs bg-slate-200 text-slate-500 px-2 py-1 rounded font-medium">Deleted</span>
                                                ) : c.account_status === 'banned' ? (
                                                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">Banned</span>
                                                ) : (
                                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Active</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">
                                                {c.email}
                                            </td>
                                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                {(c as any).orders?.length > 0 ? (
                                                    <Link
                                                        href={`/admin/customers/${c.id}/docs`}
                                                        className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full text-xs font-bold hover:bg-blue-100 border border-blue-100"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>
                                                        {(c as any).orders.length} orders
                                                    </Link>
                                                ) : (
                                                    <span className="text-slate-300 text-xs">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                                                {isDeleted ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleReactivateUser(c.id, c.email)}
                                                            className="text-green-600 hover:text-green-800 font-bold text-xs bg-green-50 border border-green-200 px-2 py-1 rounded"
                                                        >
                                                            Reactivate
                                                        </button>
                                                        <Link
                                                            href={`/admin/customers/${c.id}`}
                                                            className="text-slate-400 hover:text-slate-600 font-medium text-xs"
                                                        >
                                                            Details
                                                        </Link>
                                                    </>
                                                ) : (
                                                    <>
                                                        {pendingDocs > 0 && (
                                                            <button
                                                                onClick={() => setDocsModal({ isOpen: true, customerId: c.id })}
                                                                className="text-orange-600 hover:text-orange-800 font-medium text-xs underline"
                                                            >
                                                                Review
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleResetPassword(c.email)}
                                                            className="text-orange-600 hover:text-orange-800 font-medium text-xs whitespace-nowrap"
                                                            title="Send Password Reset Email"
                                                        >
                                                            Reset Pass
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setEditData(c)
                                                                setEditModal({ isOpen: true, customer: c })
                                                            }}
                                                            className="text-blue-600 hover:text-blue-800 font-medium text-xs"
                                                        >
                                                            Edit
                                                        </button>
                                                        <Link
                                                            href={`/admin/customers/${c.id}`}
                                                            className="text-slate-500 hover:text-slate-800 font-medium text-xs"
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
                                                    </>
                                                )}
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
                            <h3 className="text-lg font-bold text-slate-800">{createdCustomer ? 'Customer Created' : 'Add New Customer'}</h3>
                            <button onClick={() => { setIsModalOpen(false); if (createdCustomer) { setCreatedCustomer(null); window.location.reload() } }} className="text-slate-400 hover:text-slate-600">
                                ✕
                            </button>
                        </div>

                        {createdCustomer ? (
                            <div className="p-6 space-y-4">
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                                    <div className="text-3xl mb-2">&#10003;</div>
                                    <p className="text-sm font-bold text-green-800">Customer account created and verified.</p>
                                    <p className="text-xs text-green-600 mt-1">{createdCustomer.email}</p>
                                    <p className="text-[10px] text-green-500 mt-1">Email & phone pre-verified. No confirmation needed.</p>
                                </div>

                                <button
                                    onClick={handleSendWelcomeEmail}
                                    disabled={welcomeSending}
                                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition disabled:opacity-50"
                                >
                                    {welcomeSending ? 'Sending...' : 'Send Welcome Email (Password Reset)'}
                                </button>
                                <p className="text-[10px] text-slate-400 text-center">Sends a password reset link so the customer can set their own password.</p>

                                <button
                                    onClick={() => { setCreatedCustomer(null); setIsModalOpen(false); window.location.reload() }}
                                    className="w-full py-2 border border-slate-300 text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-50"
                                >
                                    Done
                                </button>
                            </div>
                        ) : (
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

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                                <input
                                    type="text"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            <div className="pt-2 border-t mt-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">VAT ID (for B2B)</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="DE12345678"
                                        value={formData.vat_id}
                                        onChange={e => setFormData({ ...formData, vat_id: e.target.value })}
                                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase font-mono text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleVerifyVATInCreate}
                                        disabled={loading || !formData.vat_id}
                                        className="bg-slate-800 text-white px-3 rounded-lg text-xs font-bold hover:bg-slate-900 disabled:opacity-50"
                                    >
                                        Verify
                                    </button>
                                </div>
                            </div>

                            {formData.type === 'b2b' && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
                                    <input
                                        type="text"
                                        value={formData.company_name}
                                        onChange={e => setFormData({ ...formData, company_name: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            )}

                            {formData.vies_address && (
                                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm">
                                    <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">VIES Registered Address</p>
                                    <p className="text-slate-700">{formData.vies_address}</p>
                                    {formData.vies_country && <p className="text-xs text-slate-500 mt-0.5">{formData.vies_country}</p>}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Set Password (optional)</label>
                                <input
                                    type="text"
                                    placeholder="Leave blank for random"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
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
                        )}
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center text-slate-800">
                            <h3 className="text-lg font-bold">Edit Customer: {editModal.customer?.email}</h3>
                            <button onClick={() => setEditModal({ isOpen: false, customer: null })} className="text-slate-400 hover:text-slate-600">
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleUpdate} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
                                    <input
                                        required
                                        type="text"
                                        value={editData.first_name || ''}
                                        onChange={e => setEditData({ ...editData, first_name: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
                                    <input
                                        required
                                        type="text"
                                        value={editData.last_name || ''}
                                        onChange={e => setEditData({ ...editData, last_name: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                                <input
                                    type="text"
                                    value={editData.phone || ''}
                                    onChange={e => setEditData({ ...editData, phone: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">VAT ID</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={editData.vat_id || ''}
                                        onChange={e => setEditData({ ...editData, vat_id: e.target.value })}
                                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase font-mono text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleVerifyVATInEdit}
                                        disabled={loading || !editData.vat_id}
                                        className="bg-slate-800 text-white px-3 rounded-lg text-xs font-bold hover:bg-slate-900 disabled:opacity-50"
                                    >
                                        Verify
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
                                <input
                                    type="text"
                                    value={editData.company_name || ''}
                                    onChange={e => setEditData({ ...editData, company_name: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setEditModal({ isOpen: false, customer: null })}
                                    className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleResetPassword(editModal.customer?.email || '')}
                                    className="flex-1 px-4 py-2 border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 font-medium"
                                >
                                    Reset Password
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                                >
                                    {loading ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
