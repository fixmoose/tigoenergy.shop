'use client'

import React, { useState, useEffect, useRef } from 'react'
import { sendSupportOTP, verifySupportOTP, submitSupportRequestV2, addMessageToSupportRequest, getSupportMessages } from '@/app/actions/support_v2'
import { useRecaptcha } from '@/hooks/useRecaptcha'
import { createClient } from '@/lib/supabase/client'

interface Props {
    type?: 'shipping' | 'return' | 'general' | 'sales'
    title?: string
    orderId?: string
    prefillMessage?: string
}

import { useRouter } from 'next/navigation'

export default function SupportMessagingWindow({ type = 'general', title, orderId, prefillMessage }: Props) {
    const router = useRouter()
    const [step, setStep] = useState<'email' | 'otp' | 'message'>('email')
    const [email, setEmail] = useState('')
    const [name, setName] = useState('')
    const [otp, setOtp] = useState('')
    const [siteId, setSiteId] = useState('')
    const [invoiceNumber, setInvoiceNumber] = useState('')
    const [storePurchased, setStorePurchased] = useState('')
    const [description, setDescription] = useState('')
    const [message, setMessage] = useState(prefillMessage || '')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [savedToken, setSavedToken] = useState<string | null>(null)
    const { recaptchaRef, resetRecaptcha, execute: executeRecaptcha } = useRecaptcha()

    // Skip email/OTP for logged-in users
    useEffect(() => {
        const supabase = createClient()
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user?.email) {
                setEmail(user.email)
                setName(user.user_metadata?.full_name || user.user_metadata?.name || '')
                setStep('message')
                // Get a recaptcha token for submission
                executeRecaptcha('SUPPORT').then(token => setSavedToken(token)).catch(() => {})
            }
        })
    }, [])

    const handleSendOTP = async () => {
        setLoading(true)
        setError('')
        try {
            const token = await executeRecaptcha('SUPPORT')
            setSavedToken(token) // Save for step 2 (submission)
            await sendSupportOTP(email, token)
            setStep('otp')
        } catch (err: any) {
            setError(err.message)
            resetRecaptcha()
        } finally {
            setLoading(false)
        }
    }

    const handleVerifyOTP = async () => {
        setLoading(true)
        setError('')
        try {
            await verifySupportOTP(email, otp)
            setStep('message')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmitRequest = async () => {
        setLoading(true)
        setError('')
        try {
            const metaLines = [
                siteId && `Site ID: ${siteId}`,
                invoiceNumber && `Invoice #: ${invoiceNumber}`,
                storePurchased && `Store: ${storePurchased}`,
                description && `Description: ${description}`,
            ].filter(Boolean)
            const fullMessage = metaLines.length > 0
                ? `${metaLines.join('\n')}\n\n${message}`
                : message

            await submitSupportRequestV2({
                type,
                subject: title || `Support Request from ${email}`,
                message: fullMessage,
                email,
                name,
                recaptchaToken: savedToken as string
            })
            router.push('/')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col max-w-md mx-auto">
            {/* Header */}
            <div className="bg-blue-600 p-4 text-white">
                <h3 className="font-bold flex items-center gap-2">
                    <span className="text-xl">💬</span> {title || 'Shop Messenger'}
                </h3>
                <p className="text-xs text-blue-100 opacity-80">We typically reply in under 2 hours</p>
            </div>

            {/* Content area */}
            <div className="p-8 space-y-4 bg-gray-50">
                {error && <div className="text-xs bg-red-50 text-red-600 p-3 rounded-xl border border-red-100 font-bold">{error}</div>}

                {step === 'email' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                        <div className="text-sm text-gray-600 mb-2 font-medium">Enter your email address to continue.</div>
                        <input
                            type="email" placeholder="Email Address"
                            className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                            value={email} onChange={e => setEmail(e.target.value)}
                        />
                        <div ref={recaptchaRef}></div>
                        <button
                            onClick={handleSendOTP} disabled={loading || !email.includes('@')}
                            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition shadow-lg shadow-blue-100 uppercase tracking-wider text-xs"
                        >
                            {loading ? 'Sending Code...' : 'Send Verification Code'}
                        </button>
                    </div>
                )}

                {step === 'otp' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 py-4">
                        <div className="text-center">
                            <div className="text-4xl mb-4">✉️</div>
                            <h4 className="font-bold text-gray-800 text-lg">Check your email</h4>
                            <p className="text-sm text-gray-500 mt-2">We've sent a 6-digit verification code to <span className="text-blue-600 font-bold">{email}</span></p>
                        </div>
                        <input
                            type="text" placeholder="######"
                            className="w-full p-3 text-center text-3xl tracking-[0.5em] font-mono rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none bg-white shadow-inner"
                            value={otp} onChange={e => setOtp(e.target.value)}
                        />
                        <button
                            onClick={handleVerifyOTP} disabled={loading || otp.length < 6}
                            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition shadow-lg shadow-blue-100 uppercase tracking-wider text-xs"
                        >
                            {loading ? 'Verifying...' : 'Verify Email'}
                        </button>
                        <button
                            onClick={() => setStep('email')}
                            className="w-full text-xs text-blue-600 font-bold hover:underline"
                        >
                            Change Email Address
                        </button>
                    </div>
                )}

                {step === 'message' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                        <div className="text-sm text-gray-600 mb-2 font-medium">Help us identify you and describe your request.</div>
                        <input
                            type="text" placeholder="Full Name *"
                            className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                            value={name} onChange={e => setName(e.target.value)}
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <input
                                type="text" placeholder="Site ID"
                                className="p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-sm"
                                value={siteId} onChange={e => setSiteId(e.target.value)}
                            />
                            <input
                                type="text" placeholder="Invoice # / St. Racuna"
                                className="p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-sm"
                                value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
                            />
                        </div>
                        <select
                            className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-sm text-gray-700"
                            value={storePurchased} onChange={e => setStorePurchased(e.target.value)}
                        >
                            <option value="">Store purchased from...</option>
                            <option value="tigoenergy.si">tigoenergy.si</option>
                            <option value="tigoenergy.de">tigoenergy.de</option>
                            <option value="tigoenergy.fr">tigoenergy.fr</option>
                            <option value="tigoenergy.it">tigoenergy.it</option>
                            <option value="tigoenergy.es">tigoenergy.es</option>
                            <option value="tigoenergy.nl">tigoenergy.nl</option>
                            <option value="tigoenergy.pl">tigoenergy.pl</option>
                            <option value="tigoenergy.at">tigoenergy.at</option>
                            <option value="tigoenergy.ch">tigoenergy.ch</option>
                            <option value="tigoenergy.be">tigoenergy.be</option>
                            <option value="tigoenergy.org.uk">tigoenergy.org.uk</option>
                            <option value="tigoenergy.shop">tigoenergy.shop</option>
                            <option value="other">Other</option>
                        </select>
                        <input
                            type="text" placeholder="Brief description of the issue"
                            className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none shadow-sm text-sm"
                            value={description} onChange={e => setDescription(e.target.value)}
                        />
                        <textarea
                            placeholder="How can we help? *"
                            className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none h-28 shadow-sm"
                            value={message} onChange={e => setMessage(e.target.value)}
                        />
                        <button
                            onClick={handleSubmitRequest} disabled={loading || !name || !message}
                            className="w-full bg-green-600 text-white py-4 rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 transition shadow-lg shadow-green-100 uppercase tracking-wider text-xs"
                        >
                            {loading ? 'Sending...' : 'Send Message'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
