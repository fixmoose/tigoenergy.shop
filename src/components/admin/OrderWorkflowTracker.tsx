'use client'

import React from 'react'

interface WorkflowStep {
    id: string
    label: string
    description: string
    isCompleted: boolean
    isActive: boolean
    date?: string | null
    icon: string
}

interface OrderWorkflowTrackerProps {
    order: {
        id: string
        status?: string | null
        created_at?: string | null
        confirmed_at?: string | null
        shipped_at?: string | null
        delivered_at?: string | null
        packing_slip_url?: string | null
        shipping_label_url?: string | null
        invoice_url?: string | null
        tracking_number?: string | null
    }
}

export default function OrderWorkflowTracker({ order }: OrderWorkflowTrackerProps) {
    const steps: WorkflowStep[] = [
        {
            id: 'ordered',
            label: 'Order Placed',
            description: 'Customer submitted order',
            isCompleted: true,
            isActive: false,
            date: order.created_at,
            icon: '🛍️'
        },
        {
            id: 'confirmed',
            label: 'Confirmation',
            description: 'Payment verified & confirmed',
            isCompleted: !!order.confirmed_at || order.status !== 'pending',
            isActive: order.status === 'pending',
            date: order.confirmed_at,
            icon: '✅'
        },
        {
            id: 'processing',
            label: 'Processing',
            description: 'Warehouse is preparing items',
            isCompleted: order.status === 'processing' || order.status === 'shipped' || order.status === 'delivered' || order.status === 'completed',
            isActive: order.status === 'processing',
            icon: '⚙️'
        },
        {
            id: 'packing_slip',
            label: 'Packing Slip',
            description: 'Generated document for picking',
            isCompleted: !!order.packing_slip_url,
            isActive: order.status === 'processing' && !order.packing_slip_url,
            icon: '📋'
        },
        {
            id: 'delivery_note',
            label: 'Delivery Note',
            description: 'Shipping label & tracking ready',
            isCompleted: !!order.shipping_label_url || !!order.tracking_number || order.status === 'delivered' || order.status === 'completed',
            isActive: !!order.packing_slip_url && !order.shipping_label_url && !order.tracking_number && order.status !== 'delivered' && order.status !== 'completed',
            date: order.shipped_at,
            icon: '🚚'
        },
        {
            id: 'invoice',
            label: 'Invoice',
            description: 'Financial document issued',
            isCompleted: !!order.invoice_url,
            isActive: (!!order.shipping_label_url || !!order.tracking_number || order.status === 'delivered' || order.status === 'completed') && !order.invoice_url,
            icon: '📄'
        }
    ]

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm uppercase tracking-wider">
                    <span className="text-blue-500">⚡</span> Order Flow Status
                </h3>
            </div>

            <div className="p-6">
                <div className="relative flex justify-between items-start">
                    {/* Progress Bar Path */}
                    <div className="absolute top-5 left-8 right-8 h-0.5 bg-slate-100 -z-0">
                        <div
                            className="h-full bg-blue-500 transition-all duration-500"
                            style={{
                                width: `${(steps.filter(s => s.isCompleted).length - 1) / (steps.length - 1) * 100}%`
                            }}
                        />
                    </div>

                    {steps.map((step, idx) => {
                        const isCompleted = step.isCompleted
                        const isActive = step.isActive

                        return (
                            <div key={step.id} className="relative z-10 flex flex-col items-center flex-1">
                                <div
                                    className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all duration-500 border-4 shadow-sm ${isCompleted
                                            ? 'bg-green-500 border-green-100 text-white'
                                            : isActive
                                                ? 'bg-amber-100 border-amber-400 text-amber-600 animate-pulse'
                                                : 'bg-white border-slate-100 text-slate-300'
                                        }`}
                                >
                                    {isCompleted ? '✓' : step.icon}
                                </div>

                                <div className="mt-4 text-center px-1">
                                    <p className={`text-[10px] font-black uppercase tracking-wider mb-1 ${isCompleted ? 'text-green-600' : isActive ? 'text-amber-600' : 'text-slate-400'
                                        }`}>
                                        {step.label}
                                    </p>
                                    <p className="text-[9px] text-slate-500 font-medium leading-tight h-6 max-w-[90px] mx-auto hidden md:block">
                                        {step.description}
                                    </p>
                                    {step.date && isCompleted && (
                                        <div className="mt-2 text-[8px] font-bold py-0.5 px-1.5 rounded-full inline-block bg-slate-100 text-slate-500">
                                            {new Date(step.date).toLocaleDateString('en-GB')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
