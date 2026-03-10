import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '../../../../../lib/supabase/server'
import { cookies } from 'next/headers'
import { generateItemsTableHtml } from '../../../../../lib/document-service'
import { generatePdfFromHtml } from '../../../../../lib/pdf-generator'
import { INITRA_LOGO_B64 } from '../../../../../lib/logo-base64'

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    const cookieStore = await cookies()
    const isAdminCookie = cookieStore.get('tigo-admin')?.value === '1'
    const supabase = isAdminCookie ? await createAdminClient() : await createClient()

    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', id)
        .single()

    if (orderError || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (!isAdminCookie) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        if (order.customer_email !== user.email) {
            const isAdmin = user.email?.endsWith('@tigoenergy.com') || user.user_metadata?.role === 'admin'
            if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
    }

    try {
        const billing = order.billing_address as any
        const shipping = order.shipping_address as any
        const currency = order.currency || '€'
        const lang = order.language || 'en'

        const formatAddr = (addr: any) => {
            if (!addr) return '—'
            const name = [addr.first_name, addr.last_name].filter(Boolean).join(' ')
            const company = addr.company_name || ''
            const street = [addr.street || addr.line1, addr.street2].filter(Boolean).join(', ')
            const city = [addr.postal_code, addr.city].filter(Boolean).join(' ')
            const country = addr.country || ''
            return [name, company, street, city, country].filter(Boolean).join('<br>')
        }

        const orderDate = new Date(order.created_at).toLocaleDateString(lang === 'sl' ? 'sl-SI' : lang === 'hr' ? 'hr-HR' : lang === 'de' ? 'de-DE' : 'en-GB')

        const subtotal = parseFloat(order.subtotal || 0)
        const vatAmount = parseFloat(order.vat_amount || 0)
        const shippingCost = parseFloat(order.shipping_cost || 0)
        const total = parseFloat(order.total || 0)
        const vatRate = order.vat_rate || 0

        const isB2B = !!(order.company_name || order.vat_id)
        const customerName = billing?.company_name || order.company_name ||
            [billing?.first_name, billing?.last_name].filter(Boolean).join(' ') ||
            order.customer_email

        const labels: Record<string, Record<string, string>> = {
            en: { title: 'Order Confirmation', subtitle: 'Proforma', orderNo: 'Order No.', date: 'Date', billTo: 'Bill To', shipTo: 'Ship To', payment: 'Payment Method', po: 'PO Number', subtotal: 'Subtotal (NET)', shipping: 'Shipping', vat: `VAT (${vatRate}%)`, total: 'Total Amount (incl. VAT)', note: 'This is an order confirmation. An official invoice will be issued upon delivery.', validUntil: 'Valid for payment' },
            sl: { title: 'Potrditev naročila', subtitle: 'Predračun', orderNo: 'Št. naročila', date: 'Datum', billTo: 'Naslov za račun', shipTo: 'Naslov dostave', payment: 'Način plačila', po: 'PO številka', subtotal: 'Vmesna vsota (brez DDV)', shipping: 'Poštnina', vat: `DDV (${vatRate}%)`, total: 'Skupni znesek (z DDV)', note: 'To je potrditev naročila. Uradni račun bo izdan ob dobavi.', validUntil: 'Veljavnost za plačilo' },
            hr: { title: 'Potvrda narudžbe', subtitle: 'Predračun', orderNo: 'Br. narudžbe', date: 'Datum', billTo: 'Adresa za račun', shipTo: 'Adresa dostave', payment: 'Način plaćanja', po: 'PO broj', subtotal: 'Međuzbir (bez PDV-a)', shipping: 'Dostava', vat: `PDV (${vatRate}%)`, total: 'Ukupan iznos (s PDV-om)', note: 'Ovo je potvrda narudžbe. Službeni račun bit će izdan pri isporuci.', validUntil: 'Vrijedi za plaćanje' },
            de: { title: 'Auftragsbestätigung', subtitle: 'Proforma', orderNo: 'Bestellnr.', date: 'Datum', billTo: 'Rechnungsadresse', shipTo: 'Lieferadresse', payment: 'Zahlungsmethode', po: 'Bestellreferenz', subtotal: 'Zwischensumme (netto)', shipping: 'Versand', vat: `MwSt. (${vatRate}%)`, total: 'Gesamtbetrag (inkl. MwSt.)', note: 'Dies ist eine Auftragsbestätigung. Eine offizielle Rechnung wird bei Lieferung ausgestellt.', validUntil: 'Zahlungsfrist' },
        }
        const L = labels[lang] || labels.en

        const poRow = order.po_number ? `
            <tr><td style="padding:4px 0;color:#6b7280;font-size:12px;">${L.po}</td><td style="padding:4px 0;font-weight:600;text-align:right;font-size:12px;">${order.po_number}</td></tr>` : ''

        const itemsHtml = generateItemsTableHtml(order.order_items, currency)

        const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, Arial, sans-serif; font-size: 13px; color: #111; background: #fff; padding: 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px; padding-bottom: 24px; border-bottom: 2px solid #1a2b3c; }
  .logo { height: 40px; }
  .doc-meta { text-align: right; }
  .doc-title { font-size: 22px; font-weight: 700; color: #1a2b3c; line-height: 1.1; }
  .doc-subtitle { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }
  .proforma-badge { display: inline-block; margin-top: 6px; background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; border-radius: 4px; font-size: 10px; font-weight: 700; padding: 2px 8px; text-transform: uppercase; letter-spacing: 0.5px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
  .meta-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; }
  .meta-box-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; margin-bottom: 6px; }
  .meta-box p { font-size: 12px; color: #374151; line-height: 1.6; }
  .order-details { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  .order-details td { padding: 4px 0; font-size: 12px; }
  .order-details td:first-child { color: #6b7280; width: 40%; }
  .order-details td:last-child { font-weight: 600; text-align: right; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  table.items th { text-align: left; padding: 8px 10px; border-bottom: 2px solid #1a2b3c; color: #6b7280; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  table.items td { padding: 10px 10px; border-bottom: 1px solid #f3f4f6; font-size: 12px; vertical-align: middle; }
  .totals { width: 320px; margin-left: auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
  .totals tr td { padding: 7px 14px; font-size: 12px; }
  .totals tr:not(:last-child) td { border-bottom: 1px solid #f3f4f6; }
  .totals tr td:last-child { text-align: right; font-weight: 600; }
  .totals tr.grand td { background: #1a2b3c; color: #fff; font-weight: 700; font-size: 14px; }
  .note-box { margin-top: 28px; padding: 12px 16px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; font-size: 11px; color: #92400e; line-height: 1.6; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; font-size: 10px; color: #9ca3af; }
</style>
</head>
<body>
  <div class="header">
    <img src="${INITRA_LOGO_B64}" class="logo" alt="Tigo Energy SHOP">
    <div class="doc-meta">
      <div class="doc-title">${L.title}</div>
      <div class="doc-subtitle">${L.subtitle}</div>
      <div class="proforma-badge">${L.subtitle}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-box">
      <div class="meta-box-label">${L.billTo}</div>
      <p><strong>${customerName}</strong></p>
      ${isB2B && order.vat_id ? `<p style="font-size:11px;color:#6b7280;">VAT: ${order.vat_id}</p>` : ''}
      <p>${formatAddr(billing)}</p>
    </div>
    <div class="meta-box">
      <div class="meta-box-label">${L.shipTo}</div>
      <p>${formatAddr(shipping)}</p>
    </div>
  </div>

  <table class="order-details" style="margin-bottom:24px;">
    <tr><td>${L.orderNo}</td><td>#${order.order_number}</td></tr>
    <tr><td>${L.date}</td><td>${orderDate}</td></tr>
    ${poRow}
    <tr><td>${L.payment}</td><td>${order.payment_method || 'Bank Transfer'}</td></tr>
  </table>

  ${itemsHtml}

  <table class="totals">
    <tr><td style="color:#6b7280;">${L.subtotal}</td><td>${currency} ${subtotal.toFixed(2)}</td></tr>
    <tr><td style="color:#6b7280;">${L.shipping}</td><td>${shippingCost === 0 ? (lang === 'sl' ? 'Prevzem' : lang === 'hr' ? 'Preuzimanje' : 'Pickup') : `${currency} ${shippingCost.toFixed(2)}`}</td></tr>
    <tr><td style="color:#6b7280;">${L.vat}</td><td>${currency} ${vatAmount.toFixed(2)}</td></tr>
    <tr class="grand"><td>${L.total}</td><td>${currency} ${total.toFixed(2)}</td></tr>
  </table>

  <div class="note-box">⚠️ ${L.note}</div>

  <div class="footer">
    <div>
      <strong>Initra Energija d.o.o.</strong><br>
      Podsmreka 59A, 1356 Dobrova, SI<br>
      VAT: SI62518313
    </div>
    <div style="text-align:right;">
      support@tigoenergy.shop<br>
      tigoenergy.shop<br>
      IBAN: SI56 6100 0002 5024 114
    </div>
  </div>
</body>
</html>`

        const pdfBuffer = await generatePdfFromHtml(html)

        return new NextResponse(Buffer.from(pdfBuffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=OrderConfirmation_${order.order_number}.pdf`,
                'Cache-Control': 'no-cache'
            },
        })
    } catch (err) {
        console.error('Proforma PDF Error:', err)
        return NextResponse.json({ error: 'Failed to generate order confirmation PDF' }, { status: 500 })
    }
}
