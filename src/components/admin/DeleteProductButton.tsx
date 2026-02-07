'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteProductButton({ productId, productName, onSuccess }: { productId: string, productName: string, onSuccess?: () => void }) {
    const router = useRouter()
    const [deleting, setDeleting] = useState(false)

    async function handleDelete() {
        if (!confirm(`Are you sure you want to delete "${productName}"? This cannot be undone.`)) return

        setDeleting(true)
        try {
            const res = await fetch(`/api/admin/products?id=${productId}`, { method: 'DELETE' })
            if (!res.ok) {
                const data = await res.json()
                alert(`Error: ${data.error}`)
                setDeleting(false)
                return
            }

            if (onSuccess) {
                onSuccess()
            } else {
                // Default behavior: refresh page
                router.refresh()
            }
            setDeleting(false)
        } catch (err) {
            alert('Delete failed')
            setDeleting(false)
        }
    }

    return (
        <button
            onClick={handleDelete}
            disabled={deleting}
            className="btn h-9 min-h-[2.25rem] px-4 btn-outline btn-error min-w-[120px] flex items-center justify-center gap-2 shadow-sm font-medium whitespace-nowrap text-sm transition-all"
        >
            {deleting ? (
                <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Deleting...
                </>
            ) : (
                <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Delete
                </>
            )}
        </button>
    )
}
