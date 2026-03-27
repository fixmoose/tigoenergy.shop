'use client'

import React, { useState } from 'react'
import {
    sendPaymentReminderAction,
    sendShippingLabelToAdminAction,
    sendOrderToAdminAction,
    confirmOrderAction
} from '@/app/actions/order-notifications'

interface OrderActionsProps {
    orderId: string
    orderNumber: string
    isPaid: boolean
    hasLabel: boolean
}

export default function CustomerOrderActions({ orderId, orderNumber, isPaid, hasLabel }: OrderActionsProps) {
    const [loading, setLoading] = useState<string | null>(null)
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null)

    const handleAction = async (actionName: string, actionFn: (id: string) => Promise<any>) => {
        setLoading(actionName)
        setMessage(null)
        try {
            await actionFn(orderId)
            setMessage({ text: `${actionName} sent successfully!`, type: 'success' })
            setTimeout(() => setMessage(null), 3000)
        } catch (err: any) {
            setMessage({ text: err.message, type: 'error' })
        } finally {
            setLoading(null)
        }
    }

    return (
        <div className="mt-4 pt-4 border-t border-gray-50 space-y-3">
            <div className="flex flex-wrap gap-2">
                {!isPaid && (
                    <button
                        onClick={() => handleAction('Reminder', sendPaymentReminderAction)}
                        disabled={!!loading}
                        className="px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-yellow-100 hover:bg-yellow-100 transition-colors disabled:opacity-50"
                    >
                        {loading === 'Reminder' ? 'Sending...' : 'Send Payment Reminder'}
                    </button>
                )}
                <button
                    onClick={() => handleAction('Order to Admin', sendOrderToAdminAction)}
                    disabled={!!loading}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-100 hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                    {loading === 'Order to Admin' ? 'Sending...' : 'Send Order to Admin'}
                </button>
                {hasLabel && (
                    <button
                        onClick={() => handleAction('Label to Admin', sendShippingLabelToAdminAction)}
                        disabled={!!loading}
                        className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-[10px] font-black uppercase tracking-widest border border-purple-100 hover:bg-purple-100 transition-colors disabled:opacity-50"
                    >
                        {loading === 'Label to Admin' ? 'Sending...' : 'Send Label to Admin'}
                    </button>
                )}
                <button
                    onClick={() => handleAction('Confirmation', confirmOrderAction)}
                    disabled={!!loading}
                    className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-colors disabled:opacity-50"
                >
                    {loading === 'Confirmation' ? 'Confirming...' : 'Confirm Order'}
                </button>
            </div>

            {message && (
                <p className={`text-[10px] font-bold uppercase tracking-widest ${message.type === 'success' ? 'text-amber-600' : 'text-red-600'}`}>
                    {message.text}
                </p>
            )}
        </div>
    )
}
