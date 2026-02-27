'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRecaptcha } from '@/hooks/useRecaptcha'
import { useTranslations } from 'next-intl'

export default function ResetPasswordPage() {
  const t = useTranslations('auth.resetPassword')
  const commonT = useTranslations('auth.register.errors')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()
  const { recaptchaRef, resetRecaptcha, execute: executeRecaptcha } = useRecaptcha()

  useEffect(() => {
    // Check if we have a session (from the reset link)
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        setError(t('noToken'))
      }
    }
    checkSession()
  }, [supabase.auth, t])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (!password || password.length < 6) {
      setError(commonT('passwordTooShort'))
      return
    }

    setLoading(true)
    try {
      const token = await executeRecaptcha('RESET_PASSWORD')
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) {
        setError(err.message)
      } else {
        setMessage(t('success'))
        setTimeout(() => {
          router.push('/auth/login')
        }, 2000)
      }
    } catch (err: any) {
      setError(err.message || commonT('general'))
      resetRecaptcha()
      console.error(err)
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

        {error ? (
          <div className="text-center space-y-6">
            <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 font-medium">
              {error}
            </div>
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                {t('expireNote')}
              </p>
              <Link
                href="/auth/forgot-password"
                className="w-full inline-block bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition shadow-lg shadow-green-200"
              >
                {t('requestNew')}
              </Link>
            </div>
          </div>
        ) : (
          <>
            {message && (
              <div className="bg-green-50 text-green-700 p-4 rounded-xl border border-green-100 mb-6 font-medium text-center">
                {message}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('newPassword')}</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('pwdPlaceholder')}
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                  disabled={loading}
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
                ) : t('update')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
