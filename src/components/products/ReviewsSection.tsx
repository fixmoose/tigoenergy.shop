'use client'

import { useState } from 'react'
import { createReview } from '@/app/actions/reviews'
import type { Review } from '@/types/database'
import { useRecaptcha } from '@/hooks/useRecaptcha'

function StarRating({ rating, setRating }: { rating: number, setRating?: (r: number) => void }) {
    return (
        <div className="flex text-yellow-400">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    disabled={!setRating}
                    onClick={() => setRating && setRating(star)}
                    className={`focus:outline-none ${setRating ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
                >
                    {star <= rating ? '★' : '☆'}
                </button>
            ))}
        </div>
    )
}

function maskName(name: string) {
    return name.slice(0, 5) + '******'
}

export default function ReviewsSection({ productId, reviews }: { productId: string, reviews: Review[] }) {
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [rating, setRating] = useState(5)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { recaptchaRef, resetRecaptcha, execute: executeRecaptcha } = useRecaptcha()

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const token = await executeRecaptcha('review')
            const formData = new FormData(e.currentTarget)
            formData.append('product_id', productId)
            formData.append('rating', rating.toString())
            formData.append('recaptcha_token', token)

            await createReview(formData)
            setIsFormOpen(false)
        } catch (error: any) {
            setError(error.message)
            resetRecaptcha()
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="mt-8 pt-6 border-t border-gray-100">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Reviews ({reviews.length})</h3>
                <button
                    onClick={() => setIsFormOpen(!isFormOpen)}
                    className="text-sm text-blue-600 hover:underline"
                >
                    {isFormOpen ? 'Cancel' : 'Write a Review'}
                </button>
            </div>

            {isFormOpen && (
                <form onSubmit={handleSubmit} className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="mb-3">
                        <label className="block text-sm font-medium mb-1">Rating</label>
                        <StarRating rating={rating} setRating={setRating} />
                    </div>
                    <div className="mb-3">
                        <label className="block text-sm font-medium mb-1">Name</label>
                        <input name="reviewer_name" required className="w-full border rounded p-2 text-sm" placeholder="Your Name" />
                    </div>
                    <div className="mb-3">
                        <label className="block text-sm font-medium mb-1">Comment</label>
                        <textarea name="comment" rows={3} className="w-full border rounded p-2 text-sm" placeholder="Your experience..." />
                    </div>

                    <div className="py-2">
                        <div ref={recaptchaRef}></div>
                    </div>

                    {error && (
                        <div className="mb-3 text-red-600 text-xs">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? 'Posting...' : 'Post Review'}
                    </button>
                </form>
            )}

            <div className="space-y-4">
                {reviews.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No reviews yet.</p>
                ) : (
                    reviews.map(review => (
                        <div key={review.id} className="border-b border-gray-100 pb-3 last:border-0">
                            <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold text-sm text-gray-800">{maskName(review.reviewer_name)}</span>
                                <span className="text-xs text-gray-400">{new Date(review.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="mb-1 text-sm">
                                <StarRating rating={review.rating} />
                            </div>
                            {review.comment && (
                                <p className="text-sm text-gray-600">{review.comment}</p>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
