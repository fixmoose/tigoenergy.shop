'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { sendEmail, renderTemplate } from '@/lib/email'
import { generateItemsTableHtml } from '@/lib/document-service'

const ADMIN_EMAIL = process.env.MASTER_ADMIN_EMAIL || ''
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://tigoenergy.shop'

/**
 * Admin sends an order to customer for payment — includes items table, IBAN/BIC, and link to their account
 */
export async function adminSendOrderForPaymentAction(orderId: string) {
    const cookieStore = await cookies()
    if (cookieStore.get('tigo-admin')?.value !== '1') throw new Error('Unauthorized')

    const supabase = await createAdminClient()
    const { data: order, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', orderId)
        .single()

    if (error || !order) throw new Error('Order not found')

    const billingCountry = ((order.billing_address as any)?.country || '').toUpperCase()
    const isSlovenia = billingCountry === 'SI'
    const primaryIban = isSlovenia ? 'SI56 6100 0002 8944 371' : 'BE55 9052 7486 2944'
    const primaryBic  = isSlovenia ? 'HDELSI22' : 'TRWIBEB1XXX'
    const primaryBank = isSlovenia ? 'NLB d.d. — Ljubljana, Slovenia' : 'Wise (TransferWise) — International'

    const itemsHtml = generateItemsTableHtml(order.order_items || [], order.currency || '€')
    const orderLink = `${SITE_URL}/orders/${order.id}`
    const totalFormatted = `${order.currency || '€'} ${parseFloat(order.total || 0).toFixed(2)}`

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;color:#1a1a1a;background:#f9f9f9;margin:0;padding:0}
.wrap{max-width:640px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5}
.hdr{background:#111827;padding:32px;color:#fff}.hdr h1{margin:0;font-size:22px;font-weight:900}
.hdr p{margin:6px 0 0;color:#9ca3af;font-size:13px}.bd{padding:32px}
.lbl{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#6b7280;margin-bottom:6px}
.bank{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px;margin-bottom:12px}
.bank h3{margin:0 0 14px;font-size:13px;font-weight:900;color:#15803d;text-transform:uppercase;letter-spacing:.08em}
.row{display:flex;gap:8px;margin-bottom:6px}.rl{font-size:11px;font-weight:700;color:#6b7280;min-width:80px}
.rv{font-family:monospace;font-size:13px;font-weight:700;color:#111}
.ref{background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 20px;margin-top:12px}
.cta{display:inline-block;background:#111827;color:#fff;padding:14px 28px;border-radius:10px;font-weight:900;font-size:14px;text-decoration:none}
.tot{display:flex;justify-content:space-between;padding:14px 0;border-top:2px solid #111;font-size:18px;font-weight:900}
</style></head><body><div class="wrap">
<div class="hdr"><h1>Payment Request — Order #${order.order_number}</h1><p>Please complete your payment to confirm this order.</p></div>
<div class="bd">
<div style="margin-bottom:28px">${itemsHtml}<div class="tot"><span>Total Due</span><span>${totalFormatted}</span></div></div>
<div style="margin-bottom:28px"><div class="lbl">Bank Transfer Details</div>
<div class="bank"><h3>${primaryBank}</h3>
<div class="row"><span class="rl">IBAN</span><span class="rv">${primaryIban}</span></div>
<div class="row"><span class="rl">BIC/SWIFT</span><span class="rv">${primaryBic}</span></div>
<div class="row"><span class="rl">Amount</span><span class="rv">${totalFormatted}</span></div></div>
<div class="ref"><div class="row"><span class="rl" style="color:#2563eb">Reference</span><span class="rv" style="color:#1d4ed8;font-size:15px">${order.order_number}</span></div>
<p style="font-size:11px;color:#3b82f6;margin:6px 0 0">Always include the order number as payment reference so we can match your payment.</p></div></div>
<div style="margin-bottom:28px"><div class="lbl">Your Order</div>
<p style="font-size:13px;color:#4b5563;margin:4px 0 12px">View your full order details and payment status in your account:</p>
<a href="${orderLink}" class="cta">View Order in My Account</a></div>
<div style="padding-top:20px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af">
<p>Questions? Contact us at <a href="mailto:info@tigoenergy.shop" style="color:#4b5563">info@tigoenergy.shop</a></p>
</div></div></div></body></html>`

    await sendEmail({
        to: order.customer_email,
        subject: `Payment Request — Order #${order.order_number} (${totalFormatted})`,
        html,
        skipUnsubscribe: true,
    })

    return { success: true }
}

/**
 * Sends a payment reminder to the customer
 */
export async function sendPaymentReminderAction(orderId: string) {
    const supabase = await createAdminClient()

    const { data: order, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', orderId)
        .single()

    if (error || !order) throw new Error('Order not found')
    if (order.payment_status === 'paid') throw new Error('Order already paid')

    const billingCountry = ((order.billing_address as any)?.country || '').toUpperCase()
    const isSlovenia = billingCountry === 'SI'
    const primaryIban = isSlovenia ? 'SI56 6100 0002 8944 371' : 'BE55 9052 7486 2944'
    const primaryBic  = isSlovenia ? 'HDELSI22' : 'TRWIBEB1XXX'
    const primaryBank = isSlovenia ? 'NLB d.d. — Ljubljana, Slovenia' : 'Wise (TransferWise) — International'

    const itemsHtml = generateItemsTableHtml(order.order_items || [], order.currency || '€')
    const orderLink = `${SITE_URL}/orders/${order.id}`
    const totalFormatted = `${order.currency || '€'} ${parseFloat(order.total || 0).toFixed(2)}`

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;color:#1a1a1a;background:#f9f9f9;margin:0;padding:0}
.wrap{max-width:640px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e5e5}
.hdr{background:#92400e;padding:32px;color:#fff}.hdr h1{margin:0;font-size:22px;font-weight:900}
.hdr p{margin:6px 0 0;color:#fde68a;font-size:13px}.bd{padding:32px}
.lbl{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#6b7280;margin-bottom:6px}
.bank{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px;margin-bottom:12px}
.bank h3{margin:0 0 14px;font-size:13px;font-weight:900;color:#15803d;text-transform:uppercase;letter-spacing:.08em}
.row{display:flex;gap:8px;margin-bottom:6px}.rl{font-size:11px;font-weight:700;color:#6b7280;min-width:80px}
.rv{font-family:monospace;font-size:13px;font-weight:700;color:#111}
.ref{background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 20px;margin-top:12px}
.cta{display:inline-block;background:#111827;color:#fff;padding:14px 28px;border-radius:10px;font-weight:900;font-size:14px;text-decoration:none}
.tot{display:flex;justify-content:space-between;padding:14px 0;border-top:2px solid #111;font-size:18px;font-weight:900}
.notice{background:#fffbeb;border:1px solid #f59e0b;border-radius:10px;padding:14px 18px;margin-bottom:24px;font-size:12px;color:#92400e;}
</style></head><body><div class="wrap">
<div class="hdr"><h1>Friendly Payment Reminder — Order #${order.order_number}</h1><p>This is a gentle reminder that your payment is still pending.</p></div>
<div class="bd">
<div class="notice">We noticed that payment for order <strong>#${order.order_number}</strong> has not yet been received. Please complete your bank transfer at your earliest convenience to avoid any delays in processing your order.</div>
<div style="margin-bottom:28px">${itemsHtml}<div class="tot"><span>Total Due</span><span>${totalFormatted}</span></div></div>
<div style="margin-bottom:28px"><div class="lbl">Bank Transfer Details</div>
<div class="bank"><h3>${primaryBank}</h3>
<div class="row"><span class="rl">IBAN</span><span class="rv">${primaryIban}</span></div>
<div class="row"><span class="rl">BIC/SWIFT</span><span class="rv">${primaryBic}</span></div>
<div class="row"><span class="rl">Amount</span><span class="rv">${totalFormatted}</span></div></div>
<div class="ref"><div class="row"><span class="rl" style="color:#2563eb">Reference</span><span class="rv" style="color:#1d4ed8;font-size:15px">${order.order_number}</span></div>
<p style="font-size:11px;color:#3b82f6;margin:6px 0 0">Always include the order number as payment reference so we can match your payment.</p></div></div>
<div style="margin-bottom:28px"><div class="lbl">Your Order</div>
<p style="font-size:13px;color:#4b5563;margin:4px 0 12px">View your full order details and payment status in your account:</p>
<a href="${orderLink}" class="cta">View Order in My Account</a></div>
<div style="padding-top:20px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af">
<p>Questions? Contact us at <a href="mailto:info@tigoenergy.shop" style="color:#4b5563">info@tigoenergy.shop</a></p>
</div></div></div></body></html>`

    await sendEmail({
        to: order.customer_email,
        subject: `Payment Reminder — Order #${order.order_number} (${totalFormatted})`,
        html,
        skipUnsubscribe: true,
    })

    return { success: true }
}

/**
 * Sends shipping label to admin
 */
export async function sendShippingLabelToAdminAction(orderId: string) {
    const supabase = await createAdminClient()

    const { data: order, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single()

    if (error || !order) throw new Error('Order not found')
    if (!order.shipping_label_url) throw new Error('No shipping label generated yet')

    await sendEmail({
        to: ADMIN_EMAIL,
        subject: `[ADMIN] Shipping Label for Order #${order.order_number}`,
        html: `
            <p>Admin, here is the shipping label for Order #${order.order_number}.</p>
            <p>Customer: ${order.customer_email}</p>
            <a href="${order.shipping_label_url}" style="padding: 10px 20px; background: #000; color: #fff; text-decoration: none; border-radius: 5px;">Download Label</a>
        `
    })

    return { success: true }
}

/**
 * Sends full order details to admin
 */
export async function sendOrderToAdminAction(orderId: string) {
    const supabase = await createAdminClient()

    const { data: order, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', orderId)
        .single()

    if (error || !order) throw new Error('Order not found')

    const itemsHtml = order.order_items.map((item: any) => `
        <li>${item.product_name} (SKU: ${item.sku}) x ${item.quantity} - ${order.currency || '€'}${item.total_price?.toFixed(2)}</li>
    `).join('')

    await sendEmail({
        to: ADMIN_EMAIL,
        subject: `[ADMIN] Order Details: #${order.order_number}`,
        html: `
            <h3>Order #${order.order_number} Details</h3>
            <p>Customer: ${order.customer_email}</p>
            <p>Payment Status: ${order.payment_status}</p>
            <p>Total: ${order.currency || '€'} ${order.total?.toFixed(2)}</p>
            <ul>${itemsHtml}</ul>
            <a href="${process.env.NEXT_PUBLIC_SITE_URL}/admin/orders/${order.id}">View in Admin Panel</a>
        `
    })

    return { success: true }
}

/**
 * Confirms order and notifies customer
 */
export async function confirmOrderAction(orderId: string) {
    const supabase = await createAdminClient()

    // 1. Update Status
    const { data: order, error } = await supabase
        .from('orders')
        .update({
            status: 'processing',
            confirmed_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .select()
        .single()

    if (error || !order) throw new Error('Order not found')

    // 2. Notify Customer
    const html = await renderTemplate('order-confirmation', {
        order_number: order.order_number,
        status: 'Confirmed & Processing'
    }, order.language || 'en')

    await sendEmail({
        to: order.customer_email,
        subject: `Order Confirmed: #${order.order_number}`,
        html
    })

    revalidatePath(`/admin/customers/${order.customer_id}`)
    revalidatePath(`/admin/orders/${order.id}`)

    return { success: true }
}
