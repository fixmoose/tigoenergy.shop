'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useRecaptcha } from '@/hooks/useRecaptcha'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()
  const { recaptchaRef, token: recaptchaToken } = useRecaptcha()

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
    if (!recaptchaToken) {
      setError('Please complete the reCAPTCHA')
      return
    }
    setError('')
    setMessage('')

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) {
        setError(err.message)
      } else {
        setMessage('Password reset successfully! Redirecting...')
        setTimeout(() => {
          router.push('/admin/sign-in')
        }, 2000)
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto mt-12">
      <h1 className="text-2xl font-semibold mb-4">Reset Password</h1>
      {error && <div className="bg-red-100 text-red-700 p-3 mb-4 rounded">{error}</div>}
      {message && <div className="bg-green-100 text-green-700 p-3 mb-4 rounded">{message}</div>}
      <form onSubmit={handleResetPassword} className="space-y-3">
        <div>
          <label className="block text-sm font-medium">New Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter new password (min 6 chars)"
            className="w-full border rounded px-3 py-2"
            disabled={loading}
          />
        </div>
        <div className="py-2">
          <div ref={recaptchaRef}></div>
        </div>
        <button type="submit" disabled={loading || !recaptchaToken} className="w-full bg-blue-600 text-white rounded py-2 font-medium hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Resetting...' : 'Reset Password'}
        </button>
      </form>
    </div>
  )
}
