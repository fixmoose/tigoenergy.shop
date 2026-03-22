'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface WarehouseAction {
    action: string
    by_email: string
    by_name: string
    at: string
    note?: string
    file_url?: string
}

const ACTION_LABELS: Record<string, { label: string; icon: string }> = {
    marked_prepared: { label: 'Marked as prepared', icon: '📦' },
    uploaded_dobavnica: { label: 'Uploaded dobavnica', icon: '📄' },
    marked_picked_up: { label: 'Marked as picked up by customer', icon: '🤝' },
    marked_dpd_picked_up: { label: 'Marked as picked up by DPD', icon: '🚚' },
    payment_verified: { label: 'Payment proof verified', icon: '💳' },
}

export default function WarehouseActionsLog({ actions, orderId }: { actions: WarehouseAction[]; orderId: string }) {
    const [undoing, setUndoing] = useState<number | null>(null)
    const router = useRouter()

    if (!actions || actions.length === 0) return null

    const handleUndo = async (index: number) => {
        const action = actions[index]
        const meta = ACTION_LABELS[action.action] || { label: action.action }
        const isCompletion = action.action === 'marked_picked_up' || action.action === 'marked_dpd_picked_up'
        const warning = isCompletion
            ? `This will also revert the order status back to "Processing". Continue?`
            : `Undo "${meta.label}" by ${action.by_name || action.by_email}?`

        if (!confirm(warning)) return

        setUndoing(index)
        try {
            const res = await fetch('/api/admin/warehouse-undo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, actionIndex: index }),
            })
            if (res.ok) {
                router.refresh()
            } else {
                const data = await res.json()
                alert(`Failed: ${data.error || 'Unknown error'}`)
            }
        } finally {
            setUndoing(null)
        }
    }

    return (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
            <h3 className="text-orange-800 font-bold text-sm mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
                </svg>
                Warehouse Activity
            </h3>
            <div className="space-y-2">
                {actions.map((action, i) => {
                    const meta = ACTION_LABELS[action.action] || { label: action.action, icon: '🔧' }
                    const time = new Date(action.at)
                    return (
                        <div key={i} className="flex items-start gap-2 text-sm group">
                            <span className="text-base leading-none mt-0.5">{meta.icon}</span>
                            <div className="flex-1 min-w-0">
                                <span className="text-orange-800 font-semibold">{meta.label}</span>
                                {action.file_url && (
                                    <a href={action.file_url} target="_blank" rel="noopener noreferrer"
                                        className="text-blue-600 text-xs hover:underline ml-2">
                                        View file
                                    </a>
                                )}
                                <div className="text-orange-600/70 text-xs">
                                    {action.by_name || action.by_email} · {time.toLocaleDateString('sl-SI')} {time.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                            <button
                                onClick={() => handleUndo(i)}
                                disabled={undoing === i}
                                className="text-[10px] px-2 py-1 rounded bg-orange-100 text-orange-600 hover:bg-red-100 hover:text-red-600 font-bold opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                                title="Undo this action"
                            >
                                {undoing === i ? '...' : 'Undo'}
                            </button>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
