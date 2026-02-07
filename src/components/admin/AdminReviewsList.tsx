'use client'

import { useState } from 'react'
import { deleteReview } from '@/app/actions/reviews'
import type { Review } from '@/types/database'

type ReviewWithProduct = Review & { products: { name_en: string } | null }

export default function AdminReviewsList({ reviews: initialReviews }: { reviews: ReviewWithProduct[] }) {
    const [reviews, setReviews] = useState(initialReviews)

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this review?')) return
        try {
            await deleteReview(id)
            setReviews(prev => prev.filter(r => r.id !== id))
        } catch (e) {
            alert('Error: ' + (e as Error).message)
        }
    }

    if (reviews.length === 0) {
        return <div className="p-8 text-center text-gray-400 text-sm">No reviews yet</div>
    }

    return (
        <div className="divide-y divide-gray-100">
            {reviews.map(review => (
                <div key={review.id} className="p-4 hover:bg-white transition-colors">
                    <div className="flex justify-between items-start mb-1">
                        <div className="font-medium text-sm text-gray-900">{review.products?.name_en || 'Unknown Product'}</div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">{new Date(review.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="text-yellow-400 text-xs">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</div>
                        <span className="text-xs text-gray-500">by {review.reviewer_name}</span>
                    </div>
                    {review.comment && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-3 italic">"{review.comment}"</p>
                    )}
                    <div className="flex justify-end">
                        <button
                            onClick={() => handleDelete(review.id)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-50 border border-transparent hover:border-red-100"
                        >
                            Delete Review
                        </button>
                    </div>
                </div>
            ))}
        </div>
    )
}
