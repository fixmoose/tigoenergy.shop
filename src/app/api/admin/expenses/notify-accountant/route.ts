import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'

const MONTHS_SI = ['Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij', 'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December']
const formatEur = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)

const ACCOUNTANT_EMAIL = process.env.ACCOUNTANT_EMAIL || 'levstik.sonja@gmail.com'

// GET — return last 30 log entries + count of unnotified processed expenses
export async function GET() {
  const cookieStore = await cookies()
  if (cookieStore.get('tigo-admin')?.value !== '1') {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  }
  const supabase = await createAdminClient()
  const { data: log } = await supabase
    .from('accountant_notifications')
    .select('id, sent_at, recipient_email, expense_count, total_amount_eur, summary, status, error')
    .order('sent_at', { ascending: false })
    .limit(30)

  const { data: pending } = await supabase
    .from('expenses')
    .select('id', { count: 'exact', head: true })
    .neq('description', 'Unprocessed')
    .gt('amount_eur', 0)
    .is('accountant_notified_at', null)
  const pendingCount = (pending as any)?.count ?? 0

  return NextResponse.json({ success: true, log: log || [], pendingCount })
}

// POST — send the email, log the batch, stamp the included rows
export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  if (cookieStore.get('tigo-admin')?.value !== '1') {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  }
  const supabase = await createAdminClient()

  const { data: rows, error: fetchErr } = await supabase
    .from('expenses')
    .select('id, date, description, supplier, amount_eur')
    .neq('description', 'Unprocessed')
    .gt('amount_eur', 0)
    .is('accountant_notified_at', null)
    .order('date', { ascending: false })
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: 'Ni novih računov za pošiljanje' }, { status: 400 })
  }

  // Group by year-month
  type Bucket = { period: string; year: number; month: number; count: number; total: number }
  const buckets = new Map<string, Bucket>()
  let grandTotal = 0
  for (const r of rows) {
    const d = new Date(r.date)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const key = `${y}-${String(m).padStart(2, '0')}`
    const amt = Number(r.amount_eur) || 0
    grandTotal += amt
    const b = buckets.get(key) || { period: key, year: y, month: m, count: 0, total: 0 }
    b.count++
    b.total += amt
    buckets.set(key, b)
  }
  const summary = Array.from(buckets.values()).sort((a, b) => b.period.localeCompare(a.period))

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://tigoenergy.shop'
  const accountingUrl = `${siteUrl}/admin/accounting`

  const summaryHtml = summary.map(b =>
    `<li style="margin:6px 0;font-size:14px;color:#334155"><strong>${MONTHS_SI[b.month - 1]} ${b.year}</strong> — ${b.count} ${b.count === 1 ? 'račun' : (b.count === 2 ? 'računa' : (b.count <= 4 ? 'računi' : 'računov'))} (<strong style="color:#dc2626">${formatEur(b.total)}</strong>)</li>`
  ).join('')

  const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#1e293b">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
  <div style="background:#0f172a;padding:20px 28px;color:#fff">
    <h1 style="margin:0;font-size:18px;font-weight:600">Novi računi za pregled</h1>
    <p style="margin:4px 0 0;font-size:12px;opacity:0.7">Initra Energija d.o.o. — Knjigovodstvo</p>
  </div>
  <div style="padding:24px 28px">
    <p style="margin:0 0 14px;font-size:14px">Pozdravljena Sonja,</p>
    <p style="margin:0 0 14px;font-size:14px">Dejan je v Knjigovodstvo dodal nove račune za pregled:</p>
    <ul style="padding-left:20px;margin:0 0 18px">${summaryHtml}</ul>
    <p style="margin:0 0 18px;font-size:14px"><strong>Skupaj:</strong> ${rows.length} ${rows.length === 1 ? 'račun' : (rows.length === 2 ? 'računa' : (rows.length <= 4 ? 'računi' : 'računov'))} v vrednosti <strong style="color:#dc2626">${formatEur(grandTotal)}</strong>.</p>
    <p style="margin:0 0 22px"><a href="${accountingUrl}" style="display:inline-block;background:#f59e0b;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:bold;font-size:14px">Odpri Knjigovodstvo →</a></p>
    <p style="margin:0;font-size:13px;color:#64748b">Lp,<br>Dejan</p>
  </div>
  <div style="padding:14px 28px;background:#f1f5f9;font-size:11px;color:#94a3b8;text-align:center">
    Initra Energija d.o.o. · Podsmreka 59A, 1356 Dobrova · SI62518313
  </div>
</div></body></html>`

  let status: 'sent' | 'failed' = 'sent'
  let errorMsg: string | null = null
  try {
    await sendEmail({
      from: 'Initra Energija <support@tigoenergy.shop>',
      to: ACCOUNTANT_EMAIL,
      subject: `Novi računi za pregled — ${rows.length} ${rows.length === 1 ? 'račun' : 'računov'}`,
      html,
      emailType: 'accountant_notify',
    })
  } catch (err: any) {
    status = 'failed'
    errorMsg = err?.message || 'Unknown error'
  }

  // Log the send
  const { data: logRow, error: logErr } = await supabase
    .from('accountant_notifications')
    .insert({
      recipient_email: ACCOUNTANT_EMAIL,
      expense_count: rows.length,
      total_amount_eur: Number(grandTotal.toFixed(2)),
      summary,
      status,
      error: errorMsg,
    })
    .select()
    .single()
  if (logErr) {
    return NextResponse.json({ error: 'Email sent but failed to log: ' + logErr.message }, { status: 500 })
  }

  // Stamp the included expenses (only on successful send)
  if (status === 'sent') {
    await supabase
      .from('expenses')
      .update({ accountant_notified_at: logRow.sent_at })
      .in('id', rows.map(r => r.id))
  }

  return NextResponse.json({ success: status === 'sent', log: logRow, sentCount: rows.length, totalAmount: grandTotal, error: errorMsg })
}
