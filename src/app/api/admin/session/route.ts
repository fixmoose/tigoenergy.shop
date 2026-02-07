import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

// POST: validate current user session + role and set short-lived HTTP-only admin cookie
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const supabase = await createClient()

  // If the client provided an access token (browser session), ask the auth API to resolve that token
  let data: any = null
  if (body?.access_token) {
    try {
      const res = await supabase.auth.getUser(body.access_token)
      data = res?.data ?? null
    } catch (e) {
      // ignore and fall back
      data = null
    }
  }

  if (!data) {
    const res = await supabase.auth.getUser()
    data = res?.data ?? null
  }

  if (process.env.NODE_ENV !== 'production') {
    // Debug information for local development
    try {
      console.debug('[admin/session] received access_token?', !!body?.access_token)
      console.debug('[admin/session] resolved user', JSON.stringify((data as any)?.user ?? null))
    } catch (e) {
      // ignore
    }
  }

  const user = (data as any)?.user
  if (!user || (user.user_metadata as any)?.role !== 'admin') {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[admin/session] unauthorized attempt', { receivedToken: !!body?.access_token, user })
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cookieStore = await cookies()
  cookieStore.set('tigo-admin', '1', {
    path: '/',
    httpOnly: true,
    maxAge: 60 * 60 * 4,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  })

  return NextResponse.json({ ok: true })
}

// DELETE: clear admin cookie
export async function DELETE(req: NextRequest) {
  console.log('[admin/session DELETE] Clearing admin cookie')
  const cookieStore = await cookies()
  cookieStore.delete('tigo-admin')
  return NextResponse.json({ ok: true })
}
