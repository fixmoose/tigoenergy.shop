'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRecaptcha } from '@/hooks/useRecaptcha'

export default function ResetPasswordPage() {
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
        setError('No reset token found. Please use the reset link from your email.')
      }
    }
    checkSession()
  }, [supabase.auth])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    try {
      const token = await executeRecaptcha('RESET_PASSWORD')
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) {
        setError(err.message)
      } else {
        setMessage('Password reset successfully! Redirecting...')
        setTimeout(() => {
          router.push('/auth/login')
        }, 2000)
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred. Please try again.')
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
          <h2 className="text-2xl font-bold text-gray-900">Set New Password</h2>
          <p className="text-sm text-gray-500 mt-2">Enter a secure new password for your account.</p>
        </div>

        {error ? (
          <div className="text-center space-y-6">
            <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 font-medium">
              {error}
            </div>
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Reset links expire after 1 hour or can only be used once. Please request a new link.
              </p>
              <Link
                href="/auth/forgot-password"
                className="w-full inline-block bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition shadow-lg shadow-green-200"
              >
                Request New Link
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
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
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
                ) : 'Update Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
