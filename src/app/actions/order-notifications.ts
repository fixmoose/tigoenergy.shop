'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendEmail, renderTemplate } from '@/lib/email'

const ADMIN_EMAIL = process.env.MASTER_ADMIN_EMAIL || ''

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

    const html = await renderTemplate('payment-reminder', {
        order_number: order.order_number,
        total_amount: `${order.currency || '€'} ${order.total?.toFixed(2)}`,
        pay_link: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/success?session_id=${order.payment_intent_id}` // Simulating a link or direct them to order page
    }, order.language || 'en')

    await sendEmail({
        to: order.customer_email,
        subject: `Payment Reminder: Order #${order.order_number}`,
        html
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
