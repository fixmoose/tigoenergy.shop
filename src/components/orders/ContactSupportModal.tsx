'use client'

import { useState } from 'react'
import { submitSupportRequest } from '@/app/actions/support'
import { useRecaptcha } from '@/hooks/useRecaptcha'

interface Props {
    isOpen: boolean
    onClose: () => void
    order: any
    items: any[]
    type: 'shipping' | 'return' | 'general'
}

export default function ContactSupportModal({ isOpen, onClose, order, items, type }: Props) {
    const [message, setMessage] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [success, setSuccess] = useState(false)
    const { recaptchaRef, token: recaptchaToken } = useRecaptcha()
    const [error, setError] = useState<string | null>(null)

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!recaptchaToken) return
        setSubmitting(true)
        setError(null)

        const customerName = `${order.shipping_address?.first_name || ''} ${order.shipping_address?.last_name || ''}`.trim()
        const customerPhone = order.shipping_address?.phone || 'Not provided'
        const itemsList = items.map(item => `${item.product_name} (SKU: ${item.sku || 'N/A'}) x${item.quantity}`).join(', ')

        const result = await submitSupportRequest({
            type,
            subject: `${type.charAt(0).toUpperCase() + type.slice(1)} Inquiry: Order #${order.order_number}`,
            message,
            orderId: order.id,
            recaptchaToken: recaptchaToken || undefined,
            metadata: {
                orderNumber: order.order_number,
                customerName,
                customerPhone,
                items: itemsList
            }
        })

        if (result.success) {
            setSuccess(true)
            setTimeout(() => {
                onClose()
                setSuccess(false)
                setMessage('')
            }, 3000)
        } else {
            setError(result.error || 'Something went wrong')
        }
        setSubmitting(false)
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-8">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-2xl font-black text-gray-900 capitalize leading-tight mb-2">
                                {type} Inquiry
                            </h3>
                            <p className="text-sm text-gray-500 font-medium tracking-tight">
                                Order #<span className="text-gray-900 font-bold">{order.order_number}</span>
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition text-gray-400">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    {success ? (
                        <div className="py-12 text-center">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <h4 className="text-xl font-black text-gray-900 mb-2">Message Sent!</h4>
                            <p className="text-gray-500 font-medium">Our team will get back to you shortly.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-6">
                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Order Summary</div>
                                <div className="text-xs text-gray-600 font-medium line-clamp-2">
                                    {items.map(i => i.product_name).join(', ')}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">
                                    What can we help you with?
                                </label>
                                <textarea
                                    required
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder="Please describe your inquiry in detail..."
                                    rows={5}
                                    className="w-full bg-gray-50 border-gray-200 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-green-500/10 focus:border-green-500 transition-all p-4"
                                />
                            </div>

                            <div className="py-2">
                                <div ref={recaptchaRef}></div>
                            </div>

                            {error && (
                                <div className="p-4 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-100">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={submitting || !recaptchaToken}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-widest py-4 rounded-2xl shadow-xl shadow-green-100 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
                            >
                                {submitting ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        Submit Request
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
