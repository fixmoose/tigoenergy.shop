'use client'

import React from 'react'

interface WarehouseAction {
    action: string
    by_email: string
    by_name: string
    at: string
    file_url?: string
}

interface WorkflowStep {
    id: string
    label: string
    description: string
    isCompleted: boolean
    isActive: boolean
    date?: string | null
    icon: string
    warehouseStep?: boolean
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
        shipping_carrier?: string | null
        warehouse_actions?: WarehouseAction[] | null
        pickup_payment_proof_required?: boolean
    }
}

export default function OrderWorkflowTracker({ order }: OrderWorkflowTrackerProps) {
    const actions = order.warehouse_actions || []
    const isPickup = order.shipping_carrier === 'Personal Pick-up'

    const hasAction = (type: string) => actions.some(a => a.action === type)
    const actionDate = (type: string) => actions.find(a => a.action === type)?.at || null

    const isPrepared = hasAction('marked_prepared')
    const hasPaymentVerified = hasAction('payment_verified')
    const hasDobavnica = hasAction('uploaded_dobavnica')
    const isPickedUp = hasAction('marked_picked_up')
    const isDpdPickedUp = hasAction('marked_dpd_picked_up')
    const isFinalized = isPickedUp || isDpdPickedUp

    const isProcessingOrBeyond = order.status === 'processing' || order.status === 'shipped' || order.status === 'delivered' || order.status === 'completed'

    const steps: WorkflowStep[] = [
        {
            id: 'ordered',
            label: 'Order Placed',
            description: 'Customer submitted order',
            isCompleted: true,
            isActive: false,
            date: order.created_at,
            icon: '🛍️',
        },
        {
            id: 'confirmed',
            label: 'Confirmed',
            description: 'Payment verified & confirmed',
            isCompleted: !!order.confirmed_at || order.status !== 'pending',
            isActive: order.status === 'pending',
            date: order.confirmed_at,
            icon: '✅',
        },
        {
            id: 'prepared',
            label: 'Prepared',
            description: 'Warehouse prepared items',
            isCompleted: isPrepared,
            isActive: isProcessingOrBeyond && !isPrepared,
            date: actionDate('marked_prepared'),
            icon: '📦',
            warehouseStep: true,
        },
    ]

    // Payment verification step — only for pickup orders requiring payment proof
    if (order.pickup_payment_proof_required) {
        steps.push({
            id: 'payment_verified',
            label: 'Payment Verified',
            description: 'Warehouse verified payment proof',
            isCompleted: hasPaymentVerified,
            isActive: isPrepared && !hasPaymentVerified,
            date: actionDate('payment_verified'),
            icon: '💳',
            warehouseStep: true,
        })
    }

    // Dobavnica upload step
    steps.push({
        id: 'dobavnica',
        label: 'Dobavnica',
        description: 'Signed delivery note uploaded',
        isCompleted: hasDobavnica,
        isActive: isPrepared && !hasDobavnica && !isFinalized,
        date: actionDate('uploaded_dobavnica'),
        icon: '📄',
        warehouseStep: true,
    })

    if (isPickup) {
        // Pickup flow
        steps.push({
            id: 'picked_up',
            label: 'Picked Up',
            description: 'Customer collected the order',
            isCompleted: isPickedUp || order.status === 'delivered',
            isActive: isPrepared && !isPickedUp && order.status !== 'delivered',
            date: actionDate('marked_picked_up') || order.delivered_at,
            icon: '🤝',
            warehouseStep: true,
        })
    } else {
        // DPD flow
        steps.push({
            id: 'dpd_handed',
            label: 'DPD Shipped',
            description: 'Handed to DPD courier',
            isCompleted: isDpdPickedUp || order.status === 'shipped' || order.status === 'delivered' || order.status === 'completed',
            isActive: isPrepared && !isDpdPickedUp && order.status === 'processing',
            date: actionDate('marked_dpd_picked_up') || order.shipped_at,
            icon: '🚚',
            warehouseStep: true,
        })

        steps.push({
            id: 'delivered',
            label: 'Delivered',
            description: 'Customer received the order',
            isCompleted: order.status === 'delivered' || order.status === 'completed',
            isActive: order.status === 'shipped',
            date: order.delivered_at,
            icon: '📬',
        })
    }

    // Invoice — always last
    steps.push({
        id: 'invoice',
        label: 'Invoice',
        description: 'Financial document issued',
        isCompleted: !!order.invoice_url,
        isActive: isFinalized && !order.invoice_url,
        icon: '📄',
    })

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

                    {steps.map((step) => {
                        const isCompleted = step.isCompleted
                        const isActive = step.isActive

                        return (
                            <div key={step.id} className="relative z-10 flex flex-col items-center flex-1">
                                <div
                                    className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all duration-500 border-4 shadow-sm ${
                                        isCompleted
                                            ? step.warehouseStep
                                                ? 'bg-orange-500 border-orange-100 text-white'
                                                : 'bg-green-500 border-green-100 text-white'
                                            : isActive
                                                ? step.warehouseStep
                                                    ? 'bg-orange-100 border-orange-400 text-orange-600 animate-pulse'
                                                    : 'bg-amber-100 border-amber-400 text-amber-600 animate-pulse'
                                                : 'bg-white border-slate-100 text-slate-300'
                                    }`}
                                >
                                    {isCompleted ? '✓' : step.icon}
                                </div>

                                <div className="mt-4 text-center px-1">
                                    <p className={`text-[10px] font-black uppercase tracking-wider mb-1 ${
                                        isCompleted
                                            ? step.warehouseStep ? 'text-orange-600' : 'text-green-600'
                                            : isActive
                                                ? step.warehouseStep ? 'text-orange-600' : 'text-amber-600'
                                                : 'text-slate-400'
                                    }`}>
                                        {step.label}
                                    </p>
                                    <p className="text-[9px] text-slate-500 font-medium leading-tight h-6 max-w-[90px] mx-auto hidden md:block">
                                        {step.description}
                                    </p>
                                    {step.date && isCompleted && (
                                        <div className={`mt-2 text-[8px] font-bold py-0.5 px-1.5 rounded-full inline-block ${
                                            step.warehouseStep ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'
                                        }`}>
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
