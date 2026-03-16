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
        .select('*')
        .eq('id', orderId)
        .single()

    if (error || !order) throw new Error('Order not found')

    const { data: orderItems } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)

    const itemsHtml = generateItemsTableHtml(orderItems || [], order.currency || '€')
    const orderLink = `${SITE_URL}/orders/${order.id}`
    const totalFormatted = `${order.currency || '€'} ${parseFloat(order.total || 0).toFixed(2)}`
    const refCode = order.order_number.replace('ETRG-ORD-', '').slice(-6)
    const wisePayUrl = `https://wise.com/pay/business/initraenergijadoo?amount=${parseFloat(order.total || 0).toFixed(2)}&currency=${order.currency || 'EUR'}&description=${refCode}`

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#333333;background:#f3f4f6;margin:0;padding:40px 0;">
<div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:0;overflow:hidden;box-shadow:0 10px 25px -5px rgba(0,0,0,0.1),0 8px 10px -6px rgba(0,0,0,0.1);">
  <!-- Header -->
  <div style="background:#1a2b3c;padding:40px 48px;">
    <table style="width:100%;border-collapse:collapse;"><tr>
      <td style="vertical-align:top;">
        <img src="${SITE_URL}/initra-logo.png" alt="Initra Energija" style="height:44px;max-width:160px;object-fit:contain;display:block;margin-bottom:14px;">
        <div style="font-size:11px;color:rgba(255,255,255,0.6);line-height:1.8;">
          <strong style="font-size:13px;color:#ffffff;display:block;margin-bottom:2px;">Initra Energija d.o.o.</strong>
          Podsmreka 59A, 1356 Dobrova, SI
        </div>
      </td>
      <td style="vertical-align:top;text-align:right;">
        <div style="font-size:28px;font-weight:300;letter-spacing:-1px;color:#ffffff;line-height:1;">Payment Request</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.45);margin:6px 0 0;">#${order.order_number}</div>
      </td>
    </tr></table>
  </div>
  <!-- Meta row -->
  <div style="background:#f9fafb;border-bottom:1px solid #f3f4f6;padding:14px 48px;">
    <table style="width:100%;border-collapse:collapse;"><tr>
      <td style="padding:2px 0;"><span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;display:block;">Total Due</span><span style="font-size:14px;font-weight:700;color:#1a2b3c;">${totalFormatted}</span></td>
      <td style="padding:2px 0;text-align:right;"><span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;display:block;">Status</span><span style="font-size:12px;font-weight:600;color:#f59e0b;">Awaiting Payment</span></td>
    </tr></table>
  </div>
  <!-- Items -->
  <div style="padding:32px 48px;">
    <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:#9ca3af;margin-bottom:20px;">Order Items</div>
    ${itemsHtml}
    <table style="width:100%;border-collapse:collapse;margin-top:16px;"><tr>
      <td style="width:55%;"></td>
      <td style="width:45%;">
        <table style="width:100%;border-collapse:collapse;"><tr style="border-top:2px solid #1a2b3c;">
          <td style="padding:14px 0 6px;font-size:14px;font-weight:700;color:#1a2b3c;">Grand Total</td>
          <td style="padding:14px 0 6px;text-align:right;font-size:22px;font-weight:700;color:#1a2b3c;">${totalFormatted}</td>
        </tr></table>
      </td>
    </tr></table>
  </div>
  <!-- Bank details — both accounts -->
  <div style="margin:0 48px 32px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
    <div style="padding:12px 20px;border-bottom:1px solid #e5e7eb;">
      <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;">Bank Transfer Details</span>
    </div>
    <table style="width:100%;border-collapse:collapse;"><tr>
      <td style="width:50%;padding:18px 20px;vertical-align:top;border-right:1px solid #f3f4f6;">
        <div style="font-size:11px;font-weight:700;color:#15803d;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Regular speed</div>
        <table style="border-collapse:collapse;font-size:11px;line-height:2.1;">
          <tr><td style="color:#9ca3af;padding-right:12px;min-width:70px;font-size:9px;text-transform:uppercase;">IBAN</td><td style="font-family:monospace;font-weight:600;color:#1a2b3c;">SI56 6100 0002 8944 371</td></tr>
          <tr><td style="color:#9ca3af;padding-right:12px;font-size:9px;text-transform:uppercase;">BIC/SWIFT</td><td style="font-family:monospace;font-weight:600;color:#1a2b3c;">HDELSI22</td></tr>
        </table>
      </td>
      <td style="width:50%;padding:18px 20px;vertical-align:top;">
        <div style="font-size:11px;font-weight:700;color:#1d4ed8;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Faster</div>
        <table style="border-collapse:collapse;font-size:11px;line-height:2.1;">
          <tr><td style="color:#9ca3af;padding-right:12px;min-width:70px;font-size:9px;text-transform:uppercase;">IBAN</td><td style="font-family:monospace;font-weight:600;color:#1a2b3c;">BE55 9052 7486 2944</td></tr>
          <tr><td style="color:#9ca3af;padding-right:12px;font-size:9px;text-transform:uppercase;">BIC/SWIFT</td><td style="font-family:monospace;font-weight:600;color:#1a2b3c;">TRWIBEB1XXX</td></tr>
        </table>
      </td>
    </tr></table>
  </div>
  <!-- Reference notice -->
  <div style="margin:0 48px 32px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 20px;">
    <table style="border-collapse:collapse;font-size:11px;line-height:2;"><tr>
      <td style="color:#2563eb;padding-right:12px;font-size:9px;text-transform:uppercase;font-weight:700;">Reference</td>
      <td style="font-family:monospace;font-weight:700;color:#1d4ed8;font-size:15px;">SI00 ${refCode}</td>
    </tr></table>
    <p style="font-size:11px;color:#3b82f6;margin:6px 0 0;">Always include the order number as payment reference so we can match your payment.</p>
  </div>
  <!-- CTA buttons -->
  <div style="padding:0 48px 32px;text-align:center;">
    <a href="${wisePayUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:14px 36px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:0.3px;margin-bottom:12px;">⚡ Pay Now with Wise</a>
    <br><br>
    <a href="${orderLink}" style="display:inline-block;background:#1a2b3c;color:#ffffff;padding:14px 36px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:0.3px;">View Order in My Account</a>
  </div>
  <!-- Footer -->
  <div style="padding:16px 48px;border-top:1px solid #f3f4f6;text-align:center;font-size:9px;color:#9ca3af;letter-spacing:0.3px;">
    Initra Energija d.o.o. &middot; Podsmreka 59A, 1356 Dobrova, SI &middot; support@tigoenergy.shop &middot; +386 1 542 41 80
  </div>
</div>
</body></html>`

    await sendEmail({
        to: order.customer_email,
        subject: `Payment Request — Order #${order.order_number} (${totalFormatted})`,
        html,
        orderId,
        emailType: 'payment_request',
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
        .select('*')
        .eq('id', orderId)
        .single()

    if (error || !order) throw new Error('Order not found')
    if (order.payment_status === 'paid') throw new Error('Order already paid')

    const { data: orderItems } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)

    const itemsHtml = generateItemsTableHtml(orderItems || [], order.currency || '€')
    const orderLink = `${SITE_URL}/orders/${order.id}`
    const totalFormatted = `${order.currency || '€'} ${parseFloat(order.total || 0).toFixed(2)}`
    const refCode = order.order_number.replace('ETRG-ORD-', '').slice(-6)
    const wisePayUrl = `https://wise.com/pay/business/initraenergijadoo?amount=${parseFloat(order.total || 0).toFixed(2)}&currency=${order.currency || 'EUR'}&description=${refCode}`

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#333333;background:#f3f4f6;margin:0;padding:40px 0;">
<div style="max-width:640px;margin:0 auto;background:#ffffff;overflow:hidden;box-shadow:0 10px 25px -5px rgba(0,0,0,0.1),0 8px 10px -6px rgba(0,0,0,0.1);">
  <!-- Header -->
  <div style="background:#1a2b3c;padding:40px 48px;">
    <table style="width:100%;border-collapse:collapse;"><tr>
      <td style="vertical-align:top;">
        <img src="${SITE_URL}/initra-logo.png" alt="Initra Energija" style="height:44px;max-width:160px;object-fit:contain;display:block;margin-bottom:14px;">
        <div style="font-size:11px;color:rgba(255,255,255,0.6);line-height:1.8;">
          <strong style="font-size:13px;color:#ffffff;display:block;margin-bottom:2px;">Initra Energija d.o.o.</strong>
          Podsmreka 59A, 1356 Dobrova, SI
        </div>
      </td>
      <td style="vertical-align:top;text-align:right;">
        <div style="font-size:24px;font-weight:300;letter-spacing:-1px;color:#ffffff;line-height:1.1;">Payment Reminder</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.45);margin:6px 0 0;">#${order.order_number}</div>
      </td>
    </tr></table>
  </div>
  <!-- Reminder notice -->
  <div style="background:#fffbeb;border-bottom:2px solid #f59e0b;padding:14px 48px;font-size:12px;color:#92400e;">
    <strong>Friendly Reminder:</strong> We noticed that payment for order <strong>#${order.order_number}</strong> has not yet been received. Please complete your bank transfer at your earliest convenience to avoid any delays.
  </div>
  <!-- Meta row -->
  <div style="background:#f9fafb;border-bottom:1px solid #f3f4f6;padding:14px 48px;">
    <table style="width:100%;border-collapse:collapse;"><tr>
      <td style="padding:2px 0;"><span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;display:block;">Total Due</span><span style="font-size:14px;font-weight:700;color:#1a2b3c;">${totalFormatted}</span></td>
      <td style="padding:2px 0;text-align:right;"><span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;display:block;">Status</span><span style="font-size:12px;font-weight:600;color:#ef4444;">Payment Pending</span></td>
    </tr></table>
  </div>
  <!-- Items -->
  <div style="padding:32px 48px;">
    <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:#9ca3af;margin-bottom:20px;">Order Items</div>
    ${itemsHtml}
    <table style="width:100%;border-collapse:collapse;margin-top:16px;"><tr>
      <td style="width:55%;"></td>
      <td style="width:45%;">
        <table style="width:100%;border-collapse:collapse;"><tr style="border-top:2px solid #1a2b3c;">
          <td style="padding:14px 0 6px;font-size:14px;font-weight:700;color:#1a2b3c;">Grand Total</td>
          <td style="padding:14px 0 6px;text-align:right;font-size:22px;font-weight:700;color:#1a2b3c;">${totalFormatted}</td>
        </tr></table>
      </td>
    </tr></table>
  </div>
  <!-- Bank details — both accounts -->
  <div style="margin:0 48px 32px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
    <div style="padding:12px 20px;border-bottom:1px solid #e5e7eb;">
      <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;">Bank Transfer Details</span>
    </div>
    <table style="width:100%;border-collapse:collapse;"><tr>
      <td style="width:50%;padding:18px 20px;vertical-align:top;border-right:1px solid #f3f4f6;">
        <div style="font-size:11px;font-weight:700;color:#15803d;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Regular speed</div>
        <table style="border-collapse:collapse;font-size:11px;line-height:2.1;">
          <tr><td style="color:#9ca3af;padding-right:12px;min-width:70px;font-size:9px;text-transform:uppercase;">IBAN</td><td style="font-family:monospace;font-weight:600;color:#1a2b3c;">SI56 6100 0002 8944 371</td></tr>
          <tr><td style="color:#9ca3af;padding-right:12px;font-size:9px;text-transform:uppercase;">BIC/SWIFT</td><td style="font-family:monospace;font-weight:600;color:#1a2b3c;">HDELSI22</td></tr>
        </table>
      </td>
      <td style="width:50%;padding:18px 20px;vertical-align:top;">
        <div style="font-size:11px;font-weight:700;color:#1d4ed8;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px;">Faster</div>
        <table style="border-collapse:collapse;font-size:11px;line-height:2.1;">
          <tr><td style="color:#9ca3af;padding-right:12px;min-width:70px;font-size:9px;text-transform:uppercase;">IBAN</td><td style="font-family:monospace;font-weight:600;color:#1a2b3c;">BE55 9052 7486 2944</td></tr>
          <tr><td style="color:#9ca3af;padding-right:12px;font-size:9px;text-transform:uppercase;">BIC/SWIFT</td><td style="font-family:monospace;font-weight:600;color:#1a2b3c;">TRWIBEB1XXX</td></tr>
        </table>
      </td>
    </tr></table>
  </div>
  <!-- Reference notice -->
  <div style="margin:0 48px 32px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:16px 20px;">
    <table style="border-collapse:collapse;font-size:11px;line-height:2;"><tr>
      <td style="color:#2563eb;padding-right:12px;font-size:9px;text-transform:uppercase;font-weight:700;">Reference</td>
      <td style="font-family:monospace;font-weight:700;color:#1d4ed8;font-size:15px;">SI00 ${refCode}</td>
    </tr></table>
    <p style="font-size:11px;color:#3b82f6;margin:6px 0 0;">Always include the order number as payment reference so we can match your payment.</p>
  </div>
  <!-- CTA buttons -->
  <div style="padding:0 48px 32px;text-align:center;">
    <a href="${wisePayUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:14px 36px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:0.3px;margin-bottom:12px;">⚡ Pay Now with Wise</a>
    <br><br>
    <a href="${orderLink}" style="display:inline-block;background:#1a2b3c;color:#ffffff;padding:14px 36px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:0.3px;">View Order in My Account</a>
  </div>
  <!-- Footer -->
  <div style="padding:16px 48px;border-top:1px solid #f3f4f6;text-align:center;font-size:9px;color:#9ca3af;letter-spacing:0.3px;">
    Initra Energija d.o.o. &middot; Podsmreka 59A, 1356 Dobrova, SI &middot; support@tigoenergy.shop &middot; +386 1 542 41 80
  </div>
</div>
</body></html>`

    await sendEmail({
        to: order.customer_email,
        subject: `Payment Reminder — Order #${order.order_number} (${totalFormatted})`,
        html,
        orderId,
        emailType: 'payment_reminder',
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
        orderId,
        emailType: 'shipping_label_admin',
        html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#333333;background:#f3f4f6;margin:0;padding:40px 0;">
<div style="max-width:640px;margin:0 auto;background:#ffffff;overflow:hidden;box-shadow:0 10px 25px -5px rgba(0,0,0,0.1);">
  <div style="background:#1a2b3c;padding:32px 48px;">
    <div style="font-size:24px;font-weight:300;letter-spacing:-1px;color:#ffffff;">Shipping Label</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.45);margin-top:6px;">#${order.order_number}</div>
  </div>
  <div style="padding:32px 48px;">
    <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;margin-bottom:8px;">Customer</div>
    <div style="font-size:13px;font-weight:600;color:#1a2b3c;margin-bottom:24px;">${order.customer_email}</div>
    <div style="text-align:center;">
      <a href="${order.shipping_label_url}" style="display:inline-block;background:#1a2b3c;color:#ffffff;padding:14px 36px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none;">Download Label</a>
    </div>
  </div>
  <div style="padding:12px 48px;border-top:1px solid #f3f4f6;text-align:center;font-size:9px;color:#9ca3af;">Admin notification — Initra Energija d.o.o.</div>
</div></body></html>`
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
        .select('*')
        .eq('id', orderId)
        .single()

    if (error || !order) throw new Error('Order not found')

    const { data: orderItems } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)

    const adminItemsHtml = generateItemsTableHtml(orderItems || [], order.currency || '€')
    const adminOrderLink = `${SITE_URL}/admin/orders/${order.id}`

    await sendEmail({
        to: ADMIN_EMAIL,
        subject: `[ADMIN] Order Details: #${order.order_number}`,
        orderId,
        emailType: 'order_details_admin',
        html: `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#333333;background:#f3f4f6;margin:0;padding:40px 0;">
<div style="max-width:640px;margin:0 auto;background:#ffffff;overflow:hidden;box-shadow:0 10px 25px -5px rgba(0,0,0,0.1);">
  <div style="background:#1a2b3c;padding:32px 48px;">
    <div style="font-size:24px;font-weight:300;letter-spacing:-1px;color:#ffffff;">Order Details</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.45);margin-top:6px;">#${order.order_number}</div>
  </div>
  <div style="background:#f9fafb;border-bottom:1px solid #f3f4f6;padding:14px 48px;">
    <table style="width:100%;border-collapse:collapse;"><tr>
      <td><span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;display:block;">Customer</span><span style="font-size:12px;font-weight:600;color:#1a2b3c;">${order.customer_email}</span></td>
      <td><span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;display:block;">Payment</span><span style="font-size:12px;font-weight:600;color:#1a2b3c;">${order.payment_status}</span></td>
      <td style="text-align:right;"><span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;display:block;">Total</span><span style="font-size:14px;font-weight:700;color:#1a2b3c;">${order.currency || '€'} ${parseFloat(order.total || 0).toFixed(2)}</span></td>
    </tr></table>
  </div>
  <div style="padding:32px 48px;">
    <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:#9ca3af;margin-bottom:20px;">Items</div>
    ${adminItemsHtml}
  </div>
  <div style="padding:0 48px 32px;text-align:center;">
    <a href="${adminOrderLink}" style="display:inline-block;background:#1a2b3c;color:#ffffff;padding:14px 36px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none;">View in Admin Panel</a>
  </div>
  <div style="padding:12px 48px;border-top:1px solid #f3f4f6;text-align:center;font-size:9px;color:#9ca3af;">Admin notification — Initra Energija d.o.o.</div>
</div></body></html>`
    })

    return { success: true }
}

/**
 * Admin sends order summary email to the customer and tracks send count
 */
export async function adminSendOrderToClientAction(orderId: string) {
    try {
        const cookieStore = await cookies()
        if (cookieStore.get('tigo-admin')?.value !== '1') return { success: false, error: 'Unauthorized' }

        const supabase = await createAdminClient()

        const { data: order, error } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single()

        if (error || !order) return { success: false, error: 'Order not found' }

        if (!order.customer_email) return { success: false, error: 'Order has no customer email' }

        const { data: orderItems } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', orderId)

        const currency = order.currency || '€'
        const customerName = `${(order.billing_address as any)?.first_name || ''} ${(order.billing_address as any)?.last_name || ''}`.trim()
            || (order as any).company_name
            || order.customer_email
        const orderDate = new Date(order.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        const orderUrl = `${SITE_URL}/orders/${order.id}`

        const itemsHtml = (orderItems || []).map((item: any) => `
            <tr>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; vertical-align: middle;">
                    <span style="font-weight: 600; color: #111; display: block;">${item.product_name}</span>
                    <span style="font-size: 11px; color: #9ca3af;">${item.sku || ''}</span>
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; text-align: center; font-weight: 600;">${item.quantity}</td>
                <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; text-align: right; font-weight: 600;">${currency} ${(parseFloat(item.unit_price || 0) * item.quantity).toFixed(2)}</td>
            </tr>`
        ).join('')

        const poRow = (order as any).po_number
            ? `<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:14px;"><span style="color:#6b7280;">P.O. Number</span><span style="font-weight:600;color:#111;">${(order as any).po_number}</span></div>`
            : ''

        const refCode = order.order_number.replace('ETRG-ORD-', '').slice(-6)
        const wisePayLink = `<div style="text-align:center;margin-top:16px"><a href="https://wise.com/pay/business/initraenergijadoo?amount=${parseFloat(order.total || 0).toFixed(2)}&currency=${currency === '€' ? 'EUR' : currency}&description=${refCode}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none">Pay Now with Wise</a></div>`

        const html = await renderTemplate('order-resend', {
            name: customerName,
            order_number: order.order_number,
            order_date: orderDate,
            po_row: poRow,
            payment_method: order.payment_method || 'Bank Transfer',
            order_items: itemsHtml,
            subtotal: `${currency} ${parseFloat(order.subtotal || 0).toFixed(2)}`,
            shipping_cost: `${currency} ${parseFloat(order.shipping_cost || 0).toFixed(2)}`,
            vat_amount: `${currency} ${parseFloat(order.vat_amount || 0).toFixed(2)}`,
            total_amount: `${currency} ${parseFloat(order.total || 0).toFixed(2)}`,
            order_url: orderUrl,
            reference: `SI00 ${refCode}`,
            wise_payment_link: wisePayLink,
        }, order.language || 'en')

        await sendEmail({
            to: order.customer_email,
            subject: `Your Order #${order.order_number} — Tigo Energy SHOP`,
            html,
            orderId,
            emailType: 'order_summary',
        })

        // Increment send count (ignore if column doesn't exist yet)
        await supabase
            .from('orders')
            .update({ order_send_count: ((order as any).order_send_count || 0) + 1 })
            .eq('id', orderId)

        revalidatePath(`/admin/orders/${orderId}`)

        return { success: true }
    } catch (err: any) {
        console.error('adminSendOrderToClientAction error:', err)
        return { success: false, error: err?.message || 'Unknown error' }
    }
}

/**
 * Confirms order and notifies customer
 */
export async function confirmOrderAction(orderId: string) {
    const supabase = await createAdminClient()

    // Fetch order first to get customer_id
    const { data: existingOrder } = await supabase
        .from('orders')
        .select('customer_id')
        .eq('id', orderId)
        .single()

    // Fetch customer payment terms
    let paymentTerms = 'prepayment'
    let paymentTermsDays = 0
    let paymentDueDate: string | null = null

    if (existingOrder?.customer_id) {
        const { data: customer } = await supabase
            .from('customers')
            .select('payment_terms, payment_terms_days')
            .eq('id', existingOrder.customer_id)
            .single()

        if (customer?.payment_terms === 'net30') {
            paymentTerms = 'net30'
            paymentTermsDays = customer.payment_terms_days || 30
            const due = new Date()
            due.setDate(due.getDate() + paymentTermsDays)
            paymentDueDate = due.toISOString().split('T')[0]
        }
    }

    // 1. Update Status
    const { data: order, error } = await supabase
        .from('orders')
        .update({
            status: 'processing',
            confirmed_at: new Date().toISOString(),
            payment_terms: paymentTerms,
            payment_due_date: paymentDueDate
        })
        .eq('id', orderId)
        .select()
        .single()

    if (error || !order) throw new Error('Order not found')

    // 2. Fetch order items for the email
    const { data: orderItems } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)

    const currency = order.currency || 'EUR'
    const refCode = order.order_number.replace('ETRG-ORD-', '').slice(-6)
    const locale = order.language || 'en'
    const shipping = (order.shipping_address as any) || {}

    // Build items HTML for the template
    const itemsHtml = (orderItems || []).map((item: any) => `
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; vertical-align: middle;">
                <span class="product-name">${item.product_name || item.sku}</span>
                <span class="product-sku">${item.sku}</span>
            </td>
            <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; text-align: center;">${item.quantity}</td>
            <td style="padding: 12px; border-bottom: 1px solid #f3f4f6; text-align: right; font-weight: 600;">${currency} ${parseFloat(item.total_price || 0).toFixed(2)}</td>
        </tr>
    `).join('')

    // Notify Customer with full data
    const html = await renderTemplate('order-confirmation', {
        order_number: order.order_number,
        name: shipping.first_name || order.customer_email?.split('@')[0] || '',
        order_date: new Date(order.created_at).toLocaleDateString(locale === 'sl' ? 'sl-SI' : locale === 'de' ? 'de-DE' : 'en-GB'),
        payment_method: (order.payment_method || 'bank_transfer').replace(/_/g, ' '),
        order_items: itemsHtml,
        subtotal: `${currency} ${parseFloat(order.subtotal || 0).toFixed(2)}`,
        shipping_cost: parseFloat(order.shipping_cost || 0) === 0 ? 'FREE' : `${currency} ${parseFloat(order.shipping_cost || 0).toFixed(2)}`,
        vat_amount: `${currency} ${parseFloat(order.vat_amount || 0).toFixed(2)}`,
        total_amount: `${currency} ${parseFloat(order.total || 0).toFixed(2)}`,
        status: 'Confirmed & Processing',
        reference: `SI00 ${refCode}`,
        wise_payment_link: `<div style="text-align:center;margin-top:16px"><a href="https://wise.com/pay/business/initraenergijadoo?amount=${parseFloat(order.total || 0).toFixed(2)}&currency=${currency}&description=${refCode}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none">Pay Now with Wise</a></div>`,
    }, locale)

    await sendEmail({
        to: order.customer_email,
        subject: `Order Confirmed: #${order.order_number}`,
        html,
        orderId,
        emailType: 'order_confirmation',
    })

    revalidatePath(`/admin/customers/${order.customer_id}`)
    revalidatePath(`/admin/orders/${order.id}`)

    return { success: true }
}
