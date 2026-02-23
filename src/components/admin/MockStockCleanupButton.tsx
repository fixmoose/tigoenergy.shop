'use client'

import { useState } from 'react'
import { cleanupMockStockAction } from '@/app/actions/products'

export default function MockStockCleanupButton() {
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<{ count: number } | null>(null)

    const handleCleanup = async () => {
        if (!confirm('Are you sure you want to cleanup mock stock? This will reset products with 100 or 50 stock and NO supplier invoices to 0.')) {
            return
        }

        setLoading(true)
        try {
            const res = await cleanupMockStockAction()
            setResult(res)
            alert(`Success! Cleaned up ${res.count} products.`)
        } catch (err: any) {
            console.error(err)
            alert('Cleanup failed: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex flex-col gap-2">
            <button
                onClick={handleCleanup}
                disabled={loading}
                className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all ${loading
                        ? 'bg-gray-100 text-gray-400 border-gray-200'
                        : 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100 shadow-sm'
                    }`}
            >
                {loading ? 'Cleaning...' : '🧹 Cleanup Mock Stock'}
            </button>
            {result && (
                <span className="text-[9px] text-gray-400 text-center">
                    Last cleanup: {result.count} items reset
                </span>
            )}
        </div>
    )
}
