'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRecaptcha } from '@/hooks/useRecaptcha'
import { useTranslations } from 'next-intl'

export default function ForgotPasswordPage() {
    const t = useTranslations('auth.forgotPassword')
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const supabase = createClient()
    const { recaptchaRef, resetRecaptcha, execute: executeRecaptcha } = useRecaptcha()

    const handleRequestReset = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setMessage(null)

        try {
            await executeRecaptcha('FORGOT_PASSWORD')
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/reset-password`,
            })

            if (error) throw error

            setMessage(t('success'))
        } catch (error: any) {
            setError(error.message)
            resetRecaptcha()
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900">{t('title')}</h2>
                    <p className="text-sm text-gray-500 mt-2">{t('subtitle')}</p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {error}
                    </div>
                )}

                {message ? (
                    <div className="text-center space-y-6">
                        <div className="bg-green-50 text-green-700 p-4 rounded-xl border border-green-100 font-medium">
                            {message}
                        </div>
                        <Link href="/auth/login" className="inline-block text-green-600 font-bold hover:underline">
                            {t('backToLogin')}
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleRequestReset} className="space-y-6">
                        <div>
                            <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1">{t('subtitle')}</label>
                            <input
                                id="reset-email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                                placeholder="john@example.com"
                            />
                        </div>

                        <div className="py-2">
                            <div ref={recaptchaRef}></div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition shadow-lg shadow-green-200 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : t('sendLink')}
                        </button>

                        <div className="text-center">
                            <Link href="/auth/login" className="text-sm text-gray-400 hover:text-gray-600 transition">
                                {t('backToLogin')}
                            </Link>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}
