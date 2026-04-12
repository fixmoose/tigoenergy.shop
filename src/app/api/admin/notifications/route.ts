import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

async function requireAdmin() {
  const cookieStore = await cookies()
  return cookieStore.get('tigo-admin')?.value === '1'
}

// GET /api/admin/notifications?unread_only=1&limit=20
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = req.nextUrl
  const unreadOnly = url.searchParams.get('unread_only') === '1'
  const limit = parseInt(url.searchParams.get('limit') || '50') || 50

  const supabase = await createAdminClient()

  let query = supabase
    .from('admin_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (unreadOnly) query = query.eq('read', false)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Also return unread count for the badge
  const { count } = await supabase
    .from('admin_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('read', false)

  return NextResponse.json({ success: true, data: data || [], unread_count: count || 0 })
}

// POST /api/admin/notifications — create a new notification
// Called internally by other routes (warehouse complete, accountant upload, etc.)
// No admin cookie required since it's server-to-server; but we validate the body.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { type, title, message, source, source_name, metadata } = body
  if (!type || !title) {
    return NextResponse.json({ error: 'type and title are required' }, { status: 400 })
  }

  const supabase = await createAdminClient()
  const { data, error } = await supabase
    .from('admin_notifications')
    .insert({
      type: String(type),
      title: String(title),
      message: message ? String(message) : null,
      source: source || 'system',
      source_name: source_name || null,
      metadata: metadata || {},
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}

// PATCH /api/admin/notifications — mark one or all as read
// Body: { id: "uuid" } to mark one, or { mark_all_read: true } to mark all
export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const supabase = await createAdminClient()
  const now = new Date().toISOString()

  if (body.mark_all_read) {
    const { error } = await supabase
      .from('admin_notifications')
      .update({ read: true, read_at: now })
      .eq('read', false)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (body.id) {
    const { error } = await supabase
      .from('admin_notifications')
      .update({ read: true, read_at: now })
      .eq('id', body.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'id or mark_all_read required' }, { status: 400 })
}
