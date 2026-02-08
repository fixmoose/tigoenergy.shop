'use client'

import React, { useState, useEffect, useRef } from 'react'
import { sendSupportOTP, verifySupportOTP, submitSupportRequestV2, addMessageToSupportRequest, getSupportMessages } from '@/app/actions/support_v2'
import { useRecaptcha } from '@/hooks/useRecaptcha'

interface Props {
    type?: 'shipping' | 'return' | 'general'
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
    const [message, setMessage] = useState(prefillMessage || '')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [savedToken, setSavedToken] = useState<string | null>(null)
    const { recaptchaRef, resetRecaptcha, execute: executeRecaptcha } = useRecaptcha()

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
            await submitSupportRequestV2({
                type,
                subject: title || `Support Request from ${email}`,
                message,
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
                            type="text" placeholder="Full Name"
                            className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                            value={name} onChange={e => setName(e.target.value)}
                        />
                        <textarea
                            placeholder="How can we help?"
                            className="w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none h-36 shadow-sm"
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
