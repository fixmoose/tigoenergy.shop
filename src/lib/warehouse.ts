import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'

/**
 * Send warehouse notification email with packing slip attached.
 * Works without admin cookies — uses createAdminClient() internally.
 * Can be called from both admin actions and the checkout auto-confirm flow.
 */
export async function sendWarehouseEmail(
    orderId: string,
    warehouseEmail: string,
    workerName: string,
    extraNote?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createAdminClient()

        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('order_number, customer_email, company_name, shipping_address, shipping_carrier, packing_slip_url, shipping_label_url')
            .eq('id', orderId)
            .single()

        if (orderError || !order) throw new Error('Order not found')

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://tigoenergy.shop'
        const customerName = order.shipping_address
            ? `${order.shipping_address.first_name || ''} ${order.shipping_address.last_name || ''}`.trim()
            : order.customer_email
        const shippingAddr = order.shipping_address
            ? `${order.shipping_address.street || ''}, ${order.shipping_address.postal_code || ''} ${order.shipping_address.city || ''}, ${order.shipping_address.country || ''}`
            : 'N/A'

        // Download PDFs via Supabase storage or API route
        const attachments: { type: string; name: string; content: string }[] = []

        const downloadPdf = async (url: string, filename: string) => {
            try {
                const parsed = new URL(url, siteUrl)

                if (parsed.pathname === '/api/storage' && parsed.searchParams.get('path')) {
                    const bucket = parsed.searchParams.get('bucket') || 'invoices'
                    const filePath = parsed.searchParams.get('path')!
                    const { data, error } = await supabase.storage.from(bucket).download(filePath)
                    if (error || !data) {
                        console.error(`Failed to download from storage ${filePath}:`, error)
                        return
                    }
                    const buffer = Buffer.from(await data.arrayBuffer())
                    attachments.push({ type: 'application/pdf', name: filename, content: buffer.toString('base64') })
                    return
                }

                // For API routes, use internal fetch with admin service role key
                const fullUrl = url.startsWith('http') ? url : `${siteUrl}${url}`
                const res = await fetch(fullUrl, {
                    headers: { 'Cookie': 'tigo-admin=1' },
                })
                if (!res.ok) {
                    console.error(`Failed to fetch ${fullUrl}: ${res.status}`)
                    return
                }
                const buffer = Buffer.from(await res.arrayBuffer())
                attachments.push({ type: 'application/pdf', name: filename, content: buffer.toString('base64') })
            } catch (err) {
                console.error(`Error downloading attachment ${filename}:`, err)
            }
        }

        const packingSlipUrl = order.packing_slip_url || `/api/orders/${orderId}/packing-slip`
        await downloadPdf(packingSlipUrl, `Dobavnica_${order.order_number}.pdf`)
        if (order.shipping_label_url) {
            await downloadPdf(order.shipping_label_url, `Nalepka_${order.order_number}.pdf`)
        }

        const attachedDocs = attachments.map(a => a.name).join(', ')

        const noteHtml = extraNote
            ? `<div style="background:#fef2f2;border:2px solid #ef4444;border-radius:8px;padding:14px;margin:16px 0;text-align:center;">
                <p style="margin:0;font-size:15px;font-weight:900;color:#dc2626;">${extraNote}</p>
               </div>`
            : ''

        const warehouseUrl = `${siteUrl}/warehouse`
        const isPickup = order.shipping_carrier === 'Personal Pick-up'
        const shippingLabel = isPickup ? 'LASTNI PREVZEM' : `Dostavi na (${order.shipping_carrier || 'DPD'})`
        const headerBg = isPickup ? '#16a34a' : '#1a2b3c'
        const headerTitle = isPickup ? 'Skladišče — Prevzem stranke' : 'Skladišče — Naročilo za dostavo'

        const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:20px;background:#f9fafb;">
<div style="max-width:500px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
  <div style="background:${headerBg};padding:24px 32px;color:#fff;">
    <img src="${siteUrl}/tigo-logo-white.png" alt="Tigo" style="height:24px;margin-bottom:8px;">
    <h1 style="font-size:20px;font-weight:300;margin:0;">${headerTitle}</h1>
  </div>
  <div style="padding:24px 32px;">
    <p style="color:#374151;font-size:14px;">Prosimo, obdelajte naslednje naročilo:</p>
    ${noteHtml}
    <div style="background:${isPickup ? '#f0fdf4' : '#eff6ff'};border:1px solid ${isPickup ? '#bbf7d0' : '#bfdbfe'};border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0 0 8px;font-size:12px;color:#6b7280;">Naročilo</p>
      <p style="margin:0 0 12px;font-size:18px;font-weight:700;color:#111;">#${order.order_number}</p>
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:${isPickup ? '#16a34a' : '#6b7280'};">${shippingLabel}</p>
      <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#111;">${customerName}${order.company_name ? ` (${order.company_name})` : ''}</p>
      ${isPickup ? '' : `<p style="margin:0;font-size:13px;color:#6b7280;">${shippingAddr}</p>`}
    </div>
    <p style="color:#374151;font-size:13px;font-weight:600;margin-bottom:12px;">Priloženi dokumenti:</p>
    <p style="color:#374151;font-size:13px;">${attachedDocs || 'Ni priloženih dokumentov.'}</p>
    <p style="color:#6b7280;font-size:12px;margin-top:8px;">Natisnite priložene PDF dokumente in obdelajte to naročilo.</p>
    <div style="text-align:center;margin:20px 0 8px;">
      <a href="${warehouseUrl}" style="display:inline-block;background:#f97316;color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;">Odpri skladiščni portal</a>
    </div>
    <p style="color:#9ca3af;font-size:11px;margin-top:24px;text-align:center;">Poslano iz Tigo Energy SHOP</p>
  </div>
</div></body></html>`

        await sendEmail({
            to: warehouseEmail,
            subject: isPickup
                ? `Skladišče: PREVZEM #${order.order_number}`
                : `Skladišče: DOSTAVA #${order.order_number}`,
            html,
            orderId,
            emailType: 'warehouse_order',
            attachments,
        })

        // Log this send to the order's warehouse_send_log
        try {
            const { data: currentOrder } = await supabase
                .from('orders')
                .select('warehouse_send_log')
                .eq('id', orderId)
                .single()

            const log = Array.isArray(currentOrder?.warehouse_send_log) ? currentOrder.warehouse_send_log : []
            log.push({ email: warehouseEmail, name: workerName, sentAt: new Date().toISOString() })

            await supabase
                .from('orders')
                .update({ warehouse_send_log: log })
                .eq('id', orderId)
        } catch (logErr) {
            console.error('Failed to log warehouse send:', logErr)
        }

        return { success: true }
    } catch (err: any) {
        console.error('Error in sendWarehouseEmail:', err)
        return { success: false, error: err.message }
    }
}
