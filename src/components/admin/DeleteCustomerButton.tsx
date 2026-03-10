'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminDeleteCustomerAction } from '@/app/actions/admin'

export default function DeleteCustomerButton({ customerId, customerName }: { customerId: string; customerName: string }) {
    const [confirming, setConfirming] = useState(false)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleDelete = async () => {
        setLoading(true)
        const result = await adminDeleteCustomerAction(customerId)
        if (result.success) {
            router.push('/admin/customers')
        } else {
            alert('Error: ' + result.error)
            setLoading(false)
            setConfirming(false)
        }
    }

    if (confirming) {
        return (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                <span className="text-sm font-medium text-red-700">Delete {customerName}?</span>
                <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="px-3 py-1 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 disabled:opacity-50"
                >
                    {loading ? 'Deleting…' : 'Yes, delete'}
                </button>
                <button
                    onClick={() => setConfirming(false)}
                    className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                    Cancel
                </button>
            </div>
        )
    }

    return (
        <button
            onClick={() => setConfirming(true)}
            className="px-5 py-2.5 bg-white border border-red-200 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 transition shadow-sm"
        >
            Delete Customer
        </button>
    )
}
