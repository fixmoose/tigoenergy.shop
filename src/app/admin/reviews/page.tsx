'use client'

import { useState, useEffect } from 'react'
import { getAllReviews, deleteReview } from '@/app/actions/reviews'
// import type { Review } from '@/types/database' // Type might not be ready if fetch failed, using any for now or assuming defined

export default function AdminReviewsPage() {
    const [reviews, setReviews] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            const data = await getAllReviews()
            setReviews(data || [])
            setLoading(false)
        }
        load()
    }, [])

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.preventDefault() // prevent default if used in links??
        if (!confirm('Convert this review to dust?')) return
        try {
            await deleteReview(id)
            setReviews(prev => prev.filter(r => r.id !== id))
        } catch (err) {
            alert('Error deleting: ' + (err as Error).message)
        }
    }

    // Masking for admin? User said "reviewer name is his 5 letter... sort of semi-hidden"
    // Usually admins see full name? But user requirement was general.
    // I will show FULL name to admin, masked to user.

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">Product Reviews</h1>

            {loading ? (
                <div>Loading...</div>
            ) : (
                <div className="bg-white rounded border shadow-sm overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Product</th>
                                <th className="px-4 py-3">User</th>
                                <th className="px-4 py-3">Rating</th>
                                <th className="px-4 py-3">Comment</th>
                                <th className="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {reviews.map(r => (
                                <tr key={r.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-gray-500 text-xs">
                                        {new Date(r.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3 font-medium">
                                        {/* Assuming join worked and we have product name */}
                                        {r.products?.name_en || 'Unknown Product'}
                                    </td>
                                    <td className="px-4 py-3">{r.reviewer_name}</td>
                                    <td className="px-4 py-3 text-yellow-500">
                                        {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                                        {r.comment}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={(e) => handleDelete(r.id, e)}
                                            className="text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-50"
                                        >
                                            Remove
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {reviews.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No reviews found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
