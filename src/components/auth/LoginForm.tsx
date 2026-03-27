'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useRecaptcha } from '@/hooks/useRecaptcha'
import { useTranslations } from 'next-intl'
import { getMarketKeyFromHostname, getDomainForMarket } from '@/lib/constants/markets'

export default function LoginForm() {
    const t = useTranslations('auth.login')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()
    const supabase = createClient()
    const { recaptchaRef, resetRecaptcha, execute: executeRecaptcha } = useRecaptcha()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const token = await executeRecaptcha('LOGIN')
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (error) throw error

            const user = data.user
            if (user?.user_metadata?.role === 'admin') {
                router.push('/admin/products')
                router.refresh()
                return
            }

            // Check if user's VAT country matches current domain — redirect if not
            const currentMarket = getMarketKeyFromHostname(window.location.hostname)
            if (currentMarket !== 'SHOP' && user?.id) {
                try {
                    const { data: customer } = await supabase
                        .from('customers')
                        .select('vat_id')
                        .eq('id', user.id)
                        .single()

                    if (customer?.vat_id && customer.vat_id.length >= 4) {
                        const vatCountry = customer.vat_id.replace(/\s/g, '').slice(0, 2).toUpperCase()
                        if (vatCountry !== currentMarket) {
                            const targetDomain = getDomainForMarket(vatCountry)
                            const mobilePath = window.innerWidth < 1024 ? '/' : '/dashboard'
                            window.location.href = `https://${targetDomain}${mobilePath}`
                            return
                        }
                    }
                } catch {
                    // Non-critical — continue to dashboard on same domain
                }
            }

            // Mobile → home (MobileLanding with Quick Order), Desktop → dashboard
            const isMobile = window.innerWidth < 1024
            router.push(isMobile ? '/' : '/dashboard')
            router.refresh()
        } catch (error: any) {
            setError(error.message)
            resetRecaptcha()
        } finally {
            setLoading(false)
        }
    }
    return (
        <div className="w-full max-w-md mx-auto bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900">{t('title')}</h2>
                <p className="text-sm text-gray-500 mt-2">{t('subtitle')}</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {error}
                    </div>
                )}

                <div>
                    <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">{t('email')}</label>
                    <input
                        id="login-email"
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        placeholder="john@example.com"
                    />
                </div>

                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label htmlFor="login-pwd" className="block text-sm font-medium text-gray-700">{t('password')}</label>
                        <Link href="/auth/forgot-password" className="text-xs text-amber-600 hover:text-amber-700 font-medium">{t('forgotPassword')}</Link>
                    </div>
                    <input
                        id="login-pwd"
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        placeholder="••••••••"
                    />
                </div>

                <div className="py-2">
                    <div ref={recaptchaRef}></div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-amber-600 text-white py-3 rounded-lg font-bold hover:bg-amber-700 transition shadow-lg shadow-amber-200 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center"
                >
                    {loading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : t('signIn')}
                </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-500">
                {t('noAccount')}{' '}
                <Link href="/auth/register" className="text-amber-600 font-bold hover:underline">
                    {t('createAccount')}
                </Link>
            </div>
        </div>
    )
}
