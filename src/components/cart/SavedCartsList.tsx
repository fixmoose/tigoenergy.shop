'use client'

import { useState, useEffect } from 'react'
import { SavedCart } from '@/types/database'
import { getSavedCarts, deleteSavedCart, loadSavedCart } from '@/app/actions/cart_actions'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SavedCartsList() {
    const [savedCarts, setSavedCarts] = useState<SavedCart[]>([])
    const [loading, setLoading] = useState(true)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const router = useRouter()

    useEffect(() => {
        const fetchCarts = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                setLoading(false)
                return
            }
            const carts = await getSavedCarts(user.id)
            setSavedCarts(carts as SavedCart[])
            setLoading(false)
        }
        fetchCarts()
    }, [])

    const handleLoad = async (cart: SavedCart) => {
        if (!confirm(`Load "${cart.name}"? This will replace your current cart.`)) return

        setActionLoading(cart.id)
        try {
            await loadSavedCart(cart.id)
            // Force refresh of cart context? 
            // The context listens to DB changes via local storage usually, 
            // but we updated server side. 
            // We should reload the page or trigger context refresh.
            window.location.reload() // Simple way to refresh context
        } catch (e) {
            alert('Failed to load cart')
            console.error(e)
        } finally {
            setActionLoading(null)
        }
    }

    const handleDelete = async (cart: SavedCart) => {
        if (!confirm(`Delete saved cart "${cart.name}"?`)) return

        setActionLoading(cart.id)
        try {
            await deleteSavedCart(cart.id)
            setSavedCarts(prev => prev.filter(c => c.id !== cart.id))
        } catch (e) {
            alert('Failed to delete cart')
        } finally {
            setActionLoading(null)
        }
    }

    if (loading) return <div className="text-sm text-gray-400">Loading saved carts...</div>
    if (savedCarts.length === 0) return null

    return (
        <div className="mt-8 border-t border-gray-100 pt-6">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>💾</span> Saved Carts
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {savedCarts.map(cart => (
                    <div key={cart.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50 hover:border-gray-300 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h4 className="font-bold text-sm text-gray-800">{cart.name}</h4>
                                <div className="text-xs text-gray-500">{new Date(cart.created_at).toLocaleDateString()}</div>
                            </div>
                            <div className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-600">
                                {cart.items?.length || 0} items
                            </div>
                        </div>

                        <div className="flex gap-2 mt-3">
                            <button
                                onClick={() => handleLoad(cart)}
                                disabled={!!actionLoading}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-1.5 rounded transition-colors disabled:opacity-50"
                            >
                                {actionLoading === cart.id ? 'Loading...' : 'Load Cart'}
                            </button>
                            <button
                                onClick={() => handleDelete(cart)}
                                disabled={!!actionLoading}
                                className="px-3 bg-white border border-gray-200 hover:bg-red-50 hover:text-red-600 text-gray-600 text-xs font-bold rounded transition-colors disabled:opacity-50"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
