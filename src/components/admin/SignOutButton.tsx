'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface SignOutButtonProps {
  className?: string
}

export default function SignOutButton({ className }: SignOutButtonProps) {
  const router = useRouter()

  async function signOut() {
    alert('Sign out button clicked!')  // TEST: Remove this after debugging
    try {
      console.log('[SignOut] Starting sign out process')

      // Clear admin session cookie on the server - MUST complete before redirect
      try {
        console.log('[SignOut] Calling DELETE /api/admin/session')
        const response = await fetch('/api/admin/session', {
          method: 'DELETE',
          credentials: 'same-origin'
        })
        console.log('[SignOut] DELETE response:', response.status, response.ok)
        if (!response.ok) {
          console.error('[SignOut] Failed to clear admin cookie, status:', response.status)
        }
      } catch (err) {
        console.error('[SignOut] Failed to clear admin cookie', err)
      }

      console.log('[SignOut] Calling supabase.auth.signOut()')
      const supabase = createClient()
      await supabase.auth.signOut()

      console.log('[SignOut] Redirecting to /')
      // Force a full page reload to clear any cached state
      window.location.href = '/'
    } catch (e) {
      console.error('[SignOut] Sign out failed', e)
    }
  }

  return (
    <button onClick={signOut} className={className || "text-sm text-gray-700 border px-3 py-1 rounded"}>
      Sign out
    </button>
  )
}
