'use client'

import React, { useState, useEffect, useRef } from 'react'
import { sendSupportOTP, verifySupportOTP, submitSupportRequestV2, addMessageToSupportRequest, getSupportMessages } from '@/app/actions/support_v2'

interface Props {
    type?: 'shipping' | 'return' | 'general'
    orderId?: string
    prefillMessage?: string
}

declare global {
    interface Window {
        grecaptcha: any;
        onRecaptchaLoad: () => void;
    }
}

export default function SupportMessagingWindow({ type = 'general', orderId, prefillMessage }: Props) {
    const [step, setStep] = useState<'info' | 'otp' | 'chat'>('info')
    const [email, setEmail] = useState('')
    const [name, setName] = useState('')
    const [otp, setOtp] = useState('')
    const [message, setMessage] = useState(prefillMessage || '')
    const [messages, setMessages] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [requestId, setRequestId] = useState<string | null>(null)
    const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null)
    const recaptchaRef = useRef<HTMLDivElement>(null)

    // Load reCAPTCHA script
    useEffect(() => {
        if (typeof window !== 'undefined' && !window.grecaptcha) {
            const script = document.createElement('script')
            script.src = 'https://www.google.com/recaptcha/api.js?render=explicit'
            script.async = true
            script.defer = true
            document.head.appendChild(script)
            window.onRecaptchaLoad = () => {
                if (recaptchaRef.current) {
                    window.grecaptcha.render(recaptchaRef.current, {
                        sitekey: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
                        callback: (token: string) => setRecaptchaToken(token)
                    })
                }
            }
        } else if (window.grecaptcha && recaptchaRef.current) {
            window.grecaptcha.render(recaptchaRef.current, {
                sitekey: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY,
                callback: (token: string) => setRecaptchaToken(token)
            })
        }
    }, [])

    const handleSendOTP = async () => {
        if (!recaptchaToken) {
            setError('Please complete the reCAPTCHA')
            return
        }
        setLoading(true)
        setError('')
        try {
            const res = await sendSupportOTP(email, recaptchaToken)
            setStep('otp')
            // Reset reCAPTCHA for next use if needed, but usually one is enough for flow
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleVerifyOTP = async () => {
        setLoading(true)
        setError('')
        try {
            await verifySupportOTP(email, otp)
            // After verification, submit the initial request
            const res = await submitSupportRequestV2({
                type,
                subject: `Support Request from ${email}`,
                message,
                email,
                name,
                recaptchaToken: recaptchaToken as string
            })
            setRequestId(res.requestId)
            setStep('chat')
            loadMessages(res.requestId)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const loadMessages = async (id: string) => {
        try {
            const msgs = await getSupportMessages(id)
            setMessages(msgs)
        } catch (err) {
            console.error('Failed to load messages:', err)
        }
    }

    const handleSendMessage = async () => {
        if (!message || !requestId) return
        setLoading(true)
        try {
            await addMessageToSupportRequest(requestId, message)
            setMessage('')
            loadMessages(requestId)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col h-[600px] max-w-md mx-auto">
            {/* Header */}
            <div className="bg-blue-600 p-4 text-white">
                <h3 className="font-bold flex items-center gap-2">
                    <span className="text-xl">💬</span> Support Chat
                </h3>
                <p className="text-xs text-blue-100 opacity-80">We typically reply in under 2 hours</p>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {error && <div className="text-xs bg-red-50 text-red-600 p-2 rounded-lg border border-red-100">{error}</div>}

                {step === 'info' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                        <div className="text-sm text-gray-600 mb-2">Please verify your email to start messaging.</div>
                        <input
                            type="text" placeholder="Full Name"
                            className="w-full p-2.5 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
                            value={name} onChange={e => setName(e.target.value)}
                        />
                        <input
                            type="email" placeholder="Email Address"
                            className="w-full p-2.5 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
                            value={email} onChange={e => setEmail(e.target.value)}
                        />
                        <textarea
                            placeholder="How can we help?"
                            className="w-full p-2.5 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none h-24"
                            value={message} onChange={e => setMessage(e.target.value)}
                        />
                        <div ref={recaptchaRef}></div>
                        <button
                            onClick={handleSendOTP} disabled={loading || !recaptchaToken}
                            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition shadow-lg shadow-blue-100"
                        >
                            {loading ? 'Sending Code...' : 'Start Conversation'}
                        </button>
                    </div>
                )}

                {step === 'otp' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 py-4">
                        <div className="text-center">
                            <div className="text-3xl mb-2">✉️</div>
                            <h4 className="font-bold text-gray-800">Check your email</h4>
                            <p className="text-sm text-gray-500">We've sent a 6-digit verification code to {email}</p>
                        </div>
                        <input
                            type="text" placeholder="######"
                            className="w-full p-3 text-center text-2xl tracking-[0.5em] font-mono rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none"
                            value={otp} onChange={e => setOtp(e.target.value)}
                        />
                        <button
                            onClick={handleVerifyOTP} disabled={loading}
                            className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 transition"
                        >
                            {loading ? 'Verifying...' : 'Verify & Send Message'}
                        </button>
                    </div>
                )}

                {step === 'chat' && (
                    <div className="space-y-3">
                        {messages.map((m, idx) => (
                            <div key={idx} className={`flex ${m.sender_type === 'admin' ? 'justify-start' : 'justify-end'}`}>
                                <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${m.sender_type === 'admin'
                                        ? 'bg-white text-gray-800 rounded-tl-none'
                                        : 'bg-blue-600 text-white rounded-tr-none'
                                    }`}>
                                    {m.message}
                                    <div className={`text-[10px] mt-1 opacity-60 ${m.sender_type === 'admin' ? 'text-gray-400' : 'text-blue-100'}`}>
                                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Input Footer (Only for chat step) */}
            {step === 'chat' && (
                <div className="p-4 bg-white border-t border-gray-100 flex gap-2">
                    <input
                        type="text" placeholder="Type a message..."
                        className="flex-1 p-2 rounded-lg bg-gray-100 border-none focus:ring-0 text-sm outline-none"
                        value={message} onChange={e => setMessage(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                    />
                    <button
                        onClick={handleSendMessage} disabled={loading || !message}
                        className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    </button>
                </div>
            )}
        </div>
    )
}
