'use client'
import React, { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'

function AdminSignIn() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const search = useSearchParams()
  const from = search?.get('from') ?? '/admin'

  // Effect to handle query param auto-login and existing session check
  React.useEffect(() => {
    const emailParam = search?.get('email')
    const passParam = search?.get('password')

    if (emailParam && passParam) {
      setEmail(emailParam)
      setPassword(passParam)
      // Auto-trigger sign in if both are present
      const timer = setTimeout(() => {
        const form = document.querySelector('form')
        if (form) form.requestSubmit()
      }, 500)
      return () => clearTimeout(timer)
    }

    async function checkExisting() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.user_metadata?.role === 'admin') {
        const ok = await setAdminCookie(session.access_token)
        if (ok) {
          window.location.href = from
        }
      }
    }
    checkExisting()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, from])

  async function setAdminCookie(accessToken: string) {
    try {
      const r = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ access_token: accessToken }),
      })
      if (r.ok) return true
      const body = await r.json().catch(() => ({}))
      console.warn('[admin] session set failed', body)
    } catch (err) {
      console.error('Failed to set admin session', err)
    }
    return false
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) {
      alert('Please enter email and password')
      return
    }
    setLoading(true)
    let res: any
    try {
      res = await supabase.auth.signInWithPassword({ email, password })
    } catch (err) {
      setLoading(false)
      console.error('[admin] signIn threw', err)
      alert('Sign-in error (network or client-side). See console for details.')
      return
    }
    setLoading(false)

    if (res?.error) {
      console.error('[admin] Sign-in failed', res.error)
      alert(res.error.message)
      return
    }

    const accessToken = res?.data?.session?.access_token
    if (accessToken) {
      const ok = await setAdminCookie(accessToken)
      if (ok) {
        window.location.href = from
        return
      }
    }
    alert('Not authorized as admin')
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Admin sign in</h1>
      <form onSubmit={signIn} method="POST" className="space-y-3">
        <div>
          <label htmlFor="email" className="block text-sm">Email</label>
          <input id="email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border rounded px-2 py-1" />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm">Password</label>
          <input id="password" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border rounded px-2 py-1" />
        </div>
        <div>
          <button type="submit" disabled={loading} className="btn btn-primary">Sign in</button>
        </div>
      </form>
    </div>
  )
}

export default function AdminSignInPage() {
  return (
    <React.Suspense fallback={<div className="p-12 text-center text-gray-500">Loading admin login...</div>}>
      <AdminSignIn />
    </React.Suspense>
  )
}
