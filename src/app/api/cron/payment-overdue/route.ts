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

    // Find unpaid orders where payment_due_date has passed and no reminder sent yet
    const { data: overdueOrders, error } = await supabase
        .from('orders')
        .select('id, order_number, customer_email, payment_due_date')
        .eq('payment_terms', 'net30')
        .in('payment_status', ['unpaid', 'pending', 'net30'])
        .not('status', 'eq', 'cancelled')
        .lte('payment_due_date', today)
        .is('overdue_reminder_sent_at', null)

    if (error) {
        console.error('Payment overdue cron error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let sent = 0
    let failed = 0

    for (const order of overdueOrders ?? []) {
        try {
            await sendPaymentReminderAction(order.id)

            // Mark reminder as sent
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

    return NextResponse.json({ success: true, sent, failed, checked: (overdueOrders ?? []).length })
}
