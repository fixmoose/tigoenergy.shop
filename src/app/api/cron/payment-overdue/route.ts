import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendPaymentReminderAction } from '@/app/actions/order-notifications'

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createAdminClient()
    const today = new Date().toISOString().split('T')[0]
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    let sent = 0
    let failed = 0

    // 1) Pre-due reminder: 1 day before due date (only if auto_reminder_enabled)
    const { data: preDueOrders, error: preDueErr } = await supabase
        .from('orders')
        .select('id, order_number, customer_email, payment_due_date')
        .eq('payment_terms', 'net30')
        .in('payment_status', ['unpaid', 'pending', 'net30', 'partially_paid'])
        .not('status', 'eq', 'cancelled')
        .eq('payment_due_date', tomorrow)
        .neq('auto_reminder_enabled', false)
        .is('pre_due_reminder_sent_at', null)

    if (preDueErr) {
        console.error('Pre-due reminder cron error:', preDueErr)
    } else {
        for (const order of preDueOrders ?? []) {
            try {
                await sendPaymentReminderAction(order.id)
                await supabase
                    .from('orders')
                    .update({ pre_due_reminder_sent_at: new Date().toISOString() })
                    .eq('id', order.id)
                sent++
                console.log(`Pre-due reminder sent for order ${order.order_number} (due: ${order.payment_due_date})`)
            } catch (err) {
                console.error(`Failed pre-due reminder for ${order.order_number}:`, err)
                failed++
            }
        }
    }

    // 2) Overdue reminder: payment_due_date has passed (only if auto_reminder_enabled)
    const { data: overdueOrders, error } = await supabase
        .from('orders')
        .select('id, order_number, customer_email, payment_due_date')
        .eq('payment_terms', 'net30')
        .in('payment_status', ['unpaid', 'pending', 'net30', 'partially_paid'])
        .not('status', 'eq', 'cancelled')
        .lte('payment_due_date', today)
        .neq('auto_reminder_enabled', false)
        .is('overdue_reminder_sent_at', null)

    if (error) {
        console.error('Payment overdue cron error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    for (const order of overdueOrders ?? []) {
        try {
            await sendPaymentReminderAction(order.id)
            await supabase
                .from('orders')
                .update({ overdue_reminder_sent_at: new Date().toISOString() })
                .eq('id', order.id)
            sent++
            console.log(`Overdue reminder sent for order ${order.order_number} (due: ${order.payment_due_date})`)
        } catch (err) {
            console.error(`Failed to send overdue reminder for ${order.order_number}:`, err)
            failed++
        }
    }

    return NextResponse.json({ success: true, sent, failed, checked: (preDueOrders ?? []).length + (overdueOrders ?? []).length })
}
