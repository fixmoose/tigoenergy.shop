import { NextResponse } from 'next/server'
import { createClient as createSupabaseServer } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  // Protect with ADMIN_INIT_TOKEN header
  const token = req.headers.get('x-admin-init-token')
  if (!token || token !== process.env.ADMIN_INIT_TOKEN) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as any
  const { email, password } = body
  if (!email || !password) return NextResponse.json({ error: 'email and password required' }, { status: 400 })

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_ROLE) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

  const supabase = createSupabaseServer(SUPABASE_URL, SERVICE_ROLE)
  const res = await supabase.auth.admin.createUser({ email, password, user_metadata: { role: 'admin' } })
  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 })

  return NextResponse.json({ ok: true, id: res.data.user?.id })
}
