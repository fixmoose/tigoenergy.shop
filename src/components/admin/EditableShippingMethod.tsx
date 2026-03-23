'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
    orderId: string
    shippingCarrier?: string | null
    shippingCost: number
    trackingNumber?: string | null
    trackingUrl?: string | null
    shippingLabelUrl?: string | null
    shippedAt?: string | null
    orderStatus?: string | null
}

export default function EditableShippingMethod({
    orderId, shippingCarrier, shippingCost, trackingNumber, trackingUrl, shippingLabelUrl, shippedAt, orderStatus,
}: Props) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [labelLoading, setLabelLoading] = useState(false)
    const [iePrice, setIePrice] = useState('')
    const isPickup = shippingCarrier === 'Personal Pick-up'
    const isDPD = shippingCarrier === 'DPD'
    const isInterEuropa = shippingCarrier === 'InterEuropa'
    const isShipped = orderStatus === 'shipped' || orderStatus === 'delivered'

    const changeShipping = async (method: 'dpd' | 'pickup' | 'intereuropa', customShippingCost?: number) => {
        const messages: Record<string, string> = {
            dpd: 'Switch to DPD delivery? Shipping cost will be recalculated.',
            pickup: 'Switch to Personal Pick-up? Shipping cost will be set to €0.',
            intereuropa: `Switch to InterEuropa with shipping cost €${(customShippingCost || 0).toFixed(2)}?`,
        }
        if (!confirm(messages[method])) return

        setLoading(true)
        try {
            const res = await fetch(`/api/admin/orders/${orderId}/change-shipping`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ method, customShippingCost }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed')

            const msg = method === 'dpd'
                ? `Switched to DPD: ${data.boxCount} box(es), shipping €${data.shippingCost.toFixed(2)}, new total €${data.total.toFixed(2)}`
                : method === 'intereuropa'
                ? `Switched to InterEuropa: shipping €${data.shippingCost.toFixed(2)}, new total €${data.total.toFixed(2)}`
                : `Switched to Personal Pick-up, new total €${data.total.toFixed(2)}`
            alert(msg)
            router.refresh()
        } catch (err: any) {
            alert(err.message || 'Failed to change shipping method')
        } finally {
            setLoading(false)
        }
    }

    const createDPDLabel = async () => {
        if (!confirm('Create DPD label now? This will generate a shipping label via DPD API.')) return

        setLabelLoading(true)
        try {
            const res = await fetch(`/api/admin/orders/${orderId}/dpd-label`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed')

            alert(`DPD label created: ${data.parcelCount} parcel(s)\nTracking: ${data.trackingNumber}`)
            router.refresh()
        } catch (err: any) {
            alert(err.message || 'Failed to create DPD label')
        } finally {
            setLabelLoading(false)
        }
    }

    return (
        <div>
            <h3 className="font-semibold text-slate-800 mb-3">Shipping</h3>
            <div className="text-sm space-y-3">
                {/* Current method display */}
                <div>
                    <span className="text-slate-500">Method:</span>
                    {isPickup ? (
                        <span className="ml-2 font-bold text-green-700">🏪 Lastni prevzem</span>
                    ) : isInterEuropa ? (
                        <span className="ml-2 font-bold text-purple-700">🚛 InterEuropa paleta</span>
                    ) : (
                        <span className="ml-2 font-bold text-blue-700">🚚 {shippingCarrier || 'DPD'} dostava</span>
                    )}
                </div>

                {shippingCost > 0 && (
                    <div>
                        <span className="text-slate-500">Cost:</span>
                        <span className="ml-2 font-medium">€{shippingCost.toFixed(2)}</span>
                    </div>
                )}

                {trackingNumber && (
                    <div>
                        <span className="text-slate-500">Tracking:</span>
                        <a
                            href={shippingCarrier === 'DPD' && trackingNumber
                                ? `https://tracking.dpd.de/parcelstatus?query=${trackingNumber.split(',')[0].trim()}&locale=sl_SI`
                                : (trackingUrl || '#')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 font-medium text-blue-600 hover:underline"
                        >
                            {trackingNumber}
                        </a>
                    </div>
                )}

                {shippedAt && (
                    <div>
                        <span className="text-slate-500">Shipped:</span>
                        <span className="ml-2">{new Date(shippedAt).toLocaleDateString('en-GB')}</span>
                    </div>
                )}

                {shippingLabelUrl && (
                    <div>
                        <a href={shippingLabelUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:underline">
                            📄 View DPD Label PDF
                        </a>
                    </div>
                )}

                {/* Shipping change controls — only if not already shipped */}
                {!isShipped && (
                    <div className="pt-3 border-t border-slate-200 space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Change shipping method</p>

                        {!isPickup && (
                            <button
                                onClick={() => changeShipping('pickup')}
                                disabled={loading}
                                className="w-full py-2 bg-green-600 text-white rounded-lg font-bold text-xs hover:bg-green-700 transition disabled:opacity-50"
                            >
                                {loading ? 'Switching...' : '🏪 Switch to Lastni prevzem'}
                            </button>
                        )}

                        {!isDPD && (
                            <button
                                onClick={() => changeShipping('dpd')}
                                disabled={loading}
                                className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold text-xs hover:bg-blue-700 transition disabled:opacity-50"
                            >
                                {loading ? 'Calculating...' : '🚚 Switch to DPD Delivery'}
                            </button>
                        )}

                        {!isInterEuropa && (
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="€ price"
                                    value={iePrice}
                                    onChange={e => setIePrice(e.target.value)}
                                    className="w-24 px-2 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                />
                                <button
                                    onClick={() => {
                                        const cost = parseFloat(iePrice)
                                        if (isNaN(cost) || cost < 0) { alert('Enter a valid shipping price.'); return }
                                        changeShipping('intereuropa', cost)
                                    }}
                                    disabled={loading}
                                    className="flex-1 py-2 bg-purple-600 text-white rounded-lg font-bold text-xs hover:bg-purple-700 transition disabled:opacity-50"
                                >
                                    {loading ? 'Switching...' : '🚛 Switch to InterEuropa'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* DPD Label creation — available when carrier is DPD and no label yet */}
                {isDPD && !shippingLabelUrl && (
                    <div className="pt-3 border-t border-slate-200">
                        <button
                            onClick={createDPDLabel}
                            disabled={labelLoading}
                            className="w-full py-2 bg-red-600 text-white rounded-lg font-bold text-xs hover:bg-red-700 transition disabled:opacity-50"
                        >
                            {labelLoading ? 'Creating label...' : '🏷️ Create DPD Label Now'}
                        </button>
                        <p className="text-[10px] text-slate-400 mt-1 text-center">
                            Creates label without marking as shipped
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
