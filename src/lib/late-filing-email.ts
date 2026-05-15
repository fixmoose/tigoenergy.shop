/**
 * Send Sonja a "ali shranim v X ali ga dam v Y" review email when a
 * receipt/invoice is filed with a date in a previous month. Two clickable
 * decision buttons land her on /racunovodstvo/late-filing where the token
 * is validated and the choice is applied.
 *
 * Every email to Sonja includes the /racunovodstvo link, per house rule.
 */
import { sendEmail } from '@/lib/email'

const ACCOUNTANT_EMAIL = process.env.ACCOUNTANT_EMAIL || 'levstik.sonja@gmail.com'
const MONTHS_SI = ['Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij', 'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December']
const formatEur = (n: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n)

interface LateExpense {
    id: string
    invoice_number?: string | null
    supplier?: string | null
    description: string
    date: string             // YYYY-MM-DD
    amount_eur: number
}

export async function sendLateFilingReviewEmail(opts: {
    expense: LateExpense
    token: string
    todayIso: string
}) {
    const { expense, token, todayIso } = opts
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://tigoenergy.shop'

    const expenseDate = new Date(expense.date)
    const expMonth = MONTHS_SI[expenseDate.getMonth()]
    const expYear = expenseDate.getFullYear()
    const today = new Date(todayIso)
    const todayMonth = MONTHS_SI[today.getMonth()]
    const todayYear = today.getFullYear()

    const keepUrl = `${siteUrl}/racunovodstvo/late-filing?token=${token}&choice=keep`
    const moveUrl = `${siteUrl}/racunovodstvo/late-filing?token=${token}&choice=move`
    const accountingUrl = `${siteUrl}/racunovodstvo`

    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#1e293b">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
  <div style="background:#f59e0b;padding:18px 28px;color:#fff">
    <h1 style="margin:0;font-size:17px;font-weight:600">Pozor — pozno vnesen račun</h1>
    <p style="margin:4px 0 0;font-size:12px;opacity:0.85">Initra Energija d.o.o.</p>
  </div>
  <div style="padding:24px 28px">
    <p style="margin:0 0 12px;font-size:14px">Pozdravljena Sonja,</p>
    <p style="margin:0 0 14px;font-size:14px">Dejan je dodal račun, ki spada v <strong>${expMonth} ${expYear}</strong>, vendar ga je vnesel v <strong>${todayMonth} ${todayYear}</strong>:</p>
    <table style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:18px">
      <tr><td style="padding:8px 12px;font-size:12px;color:#64748b;border-bottom:1px solid #e2e8f0">Datum:</td><td style="padding:8px 12px;font-size:13px;font-weight:600;border-bottom:1px solid #e2e8f0">${expense.date}</td></tr>
      ${expense.invoice_number ? `<tr><td style="padding:8px 12px;font-size:12px;color:#64748b;border-bottom:1px solid #e2e8f0">Št. računa:</td><td style="padding:8px 12px;font-size:13px;font-family:monospace;border-bottom:1px solid #e2e8f0">${expense.invoice_number}</td></tr>` : ''}
      ${expense.supplier ? `<tr><td style="padding:8px 12px;font-size:12px;color:#64748b;border-bottom:1px solid #e2e8f0">Dobavitelj:</td><td style="padding:8px 12px;font-size:13px;border-bottom:1px solid #e2e8f0">${expense.supplier}</td></tr>` : ''}
      <tr><td style="padding:8px 12px;font-size:12px;color:#64748b;border-bottom:1px solid #e2e8f0">Opis:</td><td style="padding:8px 12px;font-size:13px;border-bottom:1px solid #e2e8f0">${expense.description}</td></tr>
      <tr><td style="padding:8px 12px;font-size:12px;color:#64748b">Znesek:</td><td style="padding:8px 12px;font-size:14px;font-weight:bold;color:#dc2626">${formatEur(expense.amount_eur)}</td></tr>
    </table>
    <p style="margin:0 0 14px;font-size:14px"><strong>Ali ga shranim v ${expMonth} ${expYear}, ali ga dam v ${todayMonth} ${todayYear}?</strong></p>
    <table style="border-collapse:collapse;margin-bottom:22px"><tr>
      <td style="padding-right:10px"><a href="${keepUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:bold;font-size:13px">Pusti v ${expMonth} ${expYear}</a></td>
      <td><a href="${moveUrl}" style="display:inline-block;background:#f59e0b;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:bold;font-size:13px">Premakni v ${todayMonth} ${todayYear}</a></td>
    </tr></table>
    <p style="margin:0 0 8px;font-size:13px;color:#64748b">Klik na gumb potrdi izbiro in posodobi vpis. Lahko si vse vnose ogledaš na:</p>
    <p style="margin:0 0 18px"><a href="${accountingUrl}" style="color:#2563eb;font-size:13px">${accountingUrl}</a></p>
    <p style="margin:0;font-size:13px;color:#64748b">Lp,<br>Dejan</p>
  </div>
  <div style="padding:14px 28px;background:#f1f5f9;font-size:11px;color:#94a3b8;text-align:center">Initra Energija d.o.o. · Podsmreka 59A, 1356 Dobrova · SI62518313</div>
</div></body></html>`

    await sendEmail({
        from: 'Initra Energija <support@tigoenergy.shop>',
        to: ACCOUNTANT_EMAIL,
        subject: `Pozor: Dejan je dodal račun za ${expMonth} ${expYear} — kateri mesec?`,
        html,
        skipUnsubscribe: true,
        emailType: 'late_filing_review',
    })
}

/**
 * Generic "please review" reminder. Just nudges Sonja to open the accountant
 * portal — no specific count, no decision. The admin "Pošlji Sonji za pregled"
 * button uses this.
 */
export async function sendReviewReminderEmail() {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://tigoenergy.shop'
    const accountingUrl = `${siteUrl}/racunovodstvo`
    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#1e293b">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
  <div style="background:#0f172a;padding:18px 28px;color:#fff">
    <h1 style="margin:0;font-size:17px;font-weight:600">Prošnja za pregled računovodstva</h1>
    <p style="margin:4px 0 0;font-size:12px;opacity:0.75">Initra Energija d.o.o.</p>
  </div>
  <div style="padding:22px 28px">
    <p style="margin:0 0 12px;font-size:14px">Pozdravljena Sonja,</p>
    <p style="margin:0 0 16px;font-size:14px">Prosim, prijavi se v računovodski portal, da pregledaš vnose za tekoči mesec.</p>
    <p style="margin:0 0 18px"><a href="${accountingUrl}" style="display:inline-block;background:#f59e0b;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:bold;font-size:13px">Odpri računovodstvo →</a></p>
    <p style="margin:0 0 6px;font-size:12px;color:#64748b">Povezava: <a href="${accountingUrl}" style="color:#2563eb">${accountingUrl}</a></p>
    <p style="margin:14px 0 0;font-size:13px;color:#64748b">Lp,<br>Dejan</p>
  </div>
</div></body></html>`

    await sendEmail({
        from: 'Initra Energija <support@tigoenergy.shop>',
        to: process.env.ACCOUNTANT_EMAIL || 'levstik.sonja@gmail.com',
        subject: 'Prošnja: pregled računovodstva — Initra Energija',
        html,
        skipUnsubscribe: true,
        emailType: 'accountant_review_reminder',
    })
}
