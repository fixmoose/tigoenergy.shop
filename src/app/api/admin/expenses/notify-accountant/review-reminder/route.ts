import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { sendReviewReminderEmail } from '@/lib/late-filing-email'
import { createAdminClient } from '@/lib/supabase/server'

// Generic "please log in and review" email to Sonja with the /racunovodstvo
// link. Also logged in accountant_notifications for audit (status='reminder').
export async function POST() {
    const cookieStore = await cookies()
    if (cookieStore.get('tigo-admin')?.value !== '1') {
        return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
    }
    const supabase = await createAdminClient()
    try {
        await sendReviewReminderEmail()
        await supabase.from('accountant_notifications').insert({
            recipient_email: process.env.ACCOUNTANT_EMAIL || 'levstik.sonja@gmail.com',
            expense_count: 0,
            total_amount_eur: 0,
            summary: [{ kind: 'review_reminder' }],
            status: 'sent',
        })
        return NextResponse.json({ success: true })
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err?.message || 'send failed' }, { status: 500 })
    }
}
