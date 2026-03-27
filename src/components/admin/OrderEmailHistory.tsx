'use client'

import React, { useState } from 'react'
import { getOrderEmailLogsAction } from '@/app/actions/admin'
import type { EmailLog } from '@/types/database'

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
    payment_request: { label: 'Payment Request', color: 'bg-amber-100 text-amber-700' },
    payment_reminder: { label: 'Payment Reminder', color: 'bg-orange-100 text-orange-700' },
    order_summary: { label: 'Order Summary', color: 'bg-blue-100 text-blue-700' },
    order_confirmation: { label: 'Order Confirmed', color: 'bg-amber-100 text-amber-700' },
    shipping_notification: { label: 'Shipping Update', color: 'bg-indigo-100 text-indigo-700' },
    delivery_notification: { label: 'Delivered', color: 'bg-emerald-100 text-emerald-700' },
    shipping_label_admin: { label: 'Label (Admin)', color: 'bg-slate-100 text-slate-600' },
    order_details_admin: { label: 'Details (Admin)', color: 'bg-slate-100 text-slate-600' },
    admin_notification: { label: 'Admin Notice', color: 'bg-slate-100 text-slate-600' },
    account_setup: { label: 'Account Setup', color: 'bg-purple-100 text-purple-700' },
}

function formatRelativeTime(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function OrderEmailHistory({ orderId }: { orderId: string }) {
    const [logs, setLogs] = useState<EmailLog[]>([])
    const [loaded, setLoaded] = useState(false)
    const [loading, setLoading] = useState(false)
    const [expanded, setExpanded] = useState(false)

    const loadLogs = async () => {
        if (loaded) {
            setExpanded(!expanded)
            return
        }
        setLoading(true)
        try {
            const result = await getOrderEmailLogsAction(orderId)
            if (result.success && result.data) {
                setLogs(result.data as EmailLog[])
            }
            setLoaded(true)
            setExpanded(true)
        } catch {
            console.error('Failed to load email logs')
        } finally {
            setLoading(false)
        }
    }

    const refresh = async () => {
        setLoading(true)
        try {
            const result = await getOrderEmailLogsAction(orderId)
            if (result.success && result.data) {
                setLogs(result.data as EmailLog[])
            }
        } catch {
            console.error('Failed to refresh email logs')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <span className="text-blue-500">📧</span> Email History
                </h3>
                {loaded && expanded && (
                    <button
                        onClick={refresh}
                        disabled={loading}
                        className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                    >
                        Refresh
                    </button>
                )}
            </div>

            {!expanded ? (
                <button
                    onClick={loadLogs}
                    disabled={loading}
                    className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition disabled:opacity-50"
                >
                    {loading ? 'Loading...' : 'Show email history'}
                </button>
            ) : logs.length === 0 ? (
                <p className="text-sm text-slate-400">No emails sent for this order yet.</p>
            ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                    {logs.map((log) => {
                        const typeInfo = TYPE_LABELS[log.email_type] || { label: log.email_type, color: 'bg-gray-100 text-gray-600' }
                        const isFailed = log.status === 'failed'

                        return (
                            <div
                                key={log.id}
                                className={`flex items-start gap-3 p-3 rounded-lg border ${isFailed ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50'}`}
                            >
                                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${isFailed ? 'bg-red-500' : 'bg-amber-500'}`} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${typeInfo.color}`}>
                                            {typeInfo.label}
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                            {log.sent_at ? formatRelativeTime(log.sent_at) : ''}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-600 mt-1 truncate" title={log.subject}>
                                        {log.subject}
                                    </p>
                                    <p className="text-[10px] text-slate-400 truncate">
                                        → {log.recipient}
                                    </p>
                                    {isFailed && log.error && (
                                        <p className="text-[10px] text-red-600 mt-1">
                                            Error: {log.error}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
