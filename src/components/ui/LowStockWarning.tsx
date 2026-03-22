'use client'

/**
 * Reusable low-stock / over-stock warning banner.
 * Shows when ordered quantity exceeds available stock for any item.
 * Works in both light (desktop) and dark (mobile/quick-order) themes.
 * Pass translated strings via props — component is namespace-agnostic.
 */

interface LowStockWarningProps {
    variant?: 'light' | 'dark'
    title?: string
    note?: string
}

export function LowStockWarning({ variant = 'light', title, note }: LowStockWarningProps) {
    if (variant === 'dark') {
        return (
            <div className="bg-amber-900/40 border border-amber-600/50 rounded-lg px-3 py-2.5 flex items-start gap-2.5">
                <span className="text-amber-400 text-base mt-0.5">⚠</span>
                <div>
                    <p className="text-amber-200 text-xs font-semibold leading-tight">
                        {title || 'Some items exceed available stock'}
                    </p>
                    <p className="text-amber-300/70 text-[11px] leading-snug mt-0.5">
                        {note || "You can still order — we'll verify availability and email you within 24h to confirm or adjust."}
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
                <p className="text-amber-800 text-sm font-semibold">
                    {title || 'Some items in your order exceed available stock'}
                </p>
                <p className="text-amber-700 text-xs mt-1 leading-relaxed">
                    {note || "You can still place the order, but it will need to be verified by our team due to limited stock availability. We'll send you an email within 24 hours to confirm or suggest modifications."}
                </p>
            </div>
        </div>
    )
}

/**
 * Inline per-item low stock indicator (small text).
 */
export function LowStockBadge({ available, ordered, variant = 'light', label }: { available: number; ordered: number; variant?: 'light' | 'dark'; label?: string }) {
    if (available >= 999999) return null // available_to_order — always ok
    if (ordered <= available) return null // enough stock

    const text = label || `Only ${available} in stock`

    if (variant === 'dark') {
        return (
            <span className="text-amber-400 text-[10px] font-medium">
                ⚠ {text}
            </span>
        )
    }

    return (
        <span className="text-amber-600 text-xs font-medium">
            ⚠ {text}{!label && ' — order requires verification'}
        </span>
    )
}
