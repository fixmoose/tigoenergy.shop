import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '../../../../../lib/supabase/server'
import { cookies } from 'next/headers'
import { getPinnedTemplate, replacePlaceholders, generateItemsTableHtml, DocumentData } from '../../../../../lib/document-service'
import { generatePdfFromHtml } from '../../../../../lib/pdf-generator'
import { CUSTOMER_BLOCK, WRAP_START, WRAP_END } from '../../../../../lib/document-templates'

// Fully localized proforma template — compact A4 layout with thin header
const LOCALIZED_PROFORMA_TEMPLATE = `${WRAP_START}
<div style="border-top:6px solid #1a2b3c;padding:16px 36px;background:#ffffff;">
  <table style="width:100%;border-collapse:collapse;"><tr>
    <td style="vertical-align:top;width:58%;padding-right:16px;">
      <img src="{company_logo}" alt="" style="height:32px;max-width:140px;object-fit:contain;display:block;margin-bottom:8px;">
      <div style="font-size:10px;color:#6b7280;line-height:1.7;">
        <strong style="font-size:11px;color:#1a2b3c;display:block;margin-bottom:1px;">{company_name}</strong>
        {company_address}<br>VAT: {company_vat}<br>{company_email}
      </div>
    </td>
    <td style="vertical-align:top;text-align:right;width:42%;">
      <div style="font-size:22px;font-weight:300;letter-spacing:-1px;color:#1a2b3c;line-height:1.1;">{proforma_title}</div>
      <div style="font-size:10px;color:#9ca3af;font-style:italic;margin:3px 0 8px;">{proforma_subtitle}</div>
      <div style="font-size:11px;color:#9ca3af;">{invoice_number}</div>
    </td>
  </tr></table>
</div>
<div style="background:#fffbeb;border-bottom:2px solid #f59e0b;padding:8px 36px;font-size:10px;color:#92400e;">
  <strong>{proforma_note_label}</strong> {proforma_note_text}
</div>
<div style="background:#f9fafb;border-bottom:1px solid #f3f4f6;padding:8px 36px;">
  <table style="width:100%;border-collapse:collapse;"><tr>
    <td style="padding:2px 24px 2px 0;"><span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;display:block;">{label_date}</span><span style="font-size:11px;font-weight:600;color:#1a2b3c;">{invoice_date}</span></td>
    <td style="padding:2px 24px 2px 0;"><span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;display:block;">{label_valid_until}</span><span style="font-size:11px;font-weight:600;color:#f59e0b;">{due_date}</span></td>
    <td style="padding:2px 24px 2px 0;"><span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;display:block;">{label_order_ref}</span><span style="font-size:11px;font-weight:600;color:#1a2b3c;">{order_number}</span></td>
    <td style="padding:2px 24px 2px 0;"><span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;display:block;">{label_payment_method}</span><span style="font-size:11px;font-weight:600;color:#1a2b3c;">{payment_method}</span></td>
  </tr></table>
</div>
<div style="padding:16px 36px;border-bottom:1px solid #f3f4f6;">
  <table style="width:100%;border-collapse:collapse;"><tr>
    <td style="width:50%;vertical-align:top;padding-right:20px;">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;margin-bottom:6px;">{label_bill_to}</div>
      ${CUSTOMER_BLOCK}
    </td>
    <td style="width:50%;vertical-align:top;padding-left:20px;border-left:1px solid #f3f4f6;">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;margin-bottom:6px;">{label_ship_to}</div>
      <div style="font-size:10px;color:#6b7280;line-height:1.7;">{shipping_address}</div>
    </td>
  </tr></table>
</div>
<div style="padding:16px 36px;">
  <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;margin-bottom:10px;">{label_items}</div>
  {items_table}
</div>
<div style="padding:0 36px 16px;">
  <table style="width:100%;border-collapse:collapse;"><tr>
    <td style="width:55%;"></td>
    <td style="width:45%;">
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <tr><td style="padding:4px 0;color:#9ca3af;">{label_subtotal}</td><td style="padding:4px 0;text-align:right;font-weight:600;color:#1a2b3c;">{subtotal_net}</td></tr>
        <tr><td style="padding:4px 0;color:#9ca3af;">{label_shipping}</td><td style="padding:4px 0;text-align:right;font-weight:600;color:#1a2b3c;">{shipping_cost}</td></tr>
        <tr style="border-bottom:2px solid #1a2b3c;"><td style="padding:4px 0 8px;color:#9ca3af;">{label_vat}</td><td style="padding:4px 0 8px;text-align:right;font-weight:600;color:#1a2b3c;">{vat_total}</td></tr>
        <tr><td style="padding:10px 0 4px;font-size:13px;font-weight:700;color:#1a2b3c;">{label_total}</td><td style="padding:10px 0 4px;text-align:right;font-size:18px;font-weight:700;color:#1a2b3c;">{total_amount}</td></tr>
      </table>
    </td>
  </tr></table>
</div>
<div style="margin:0 36px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
  <div style="padding:8px 16px;border-bottom:1px solid #e5e7eb;">
    <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;">{label_bank_details}</span>
    <span style="font-size:10px;color:#6b7280;margin-left:12px;">{label_reference}: <strong style="font-family:monospace;color:#1a2b3c;">{reference}</strong></span>
  </div>
  <table style="width:100%;border-collapse:collapse;"><tr>
    <td style="width:50%;padding:12px 16px;vertical-align:top;border-right:1px solid #f3f4f6;">
      <div style="font-size:10px;font-weight:700;color:#16a34a;margin-bottom:2px;">{label_faster}</div>
      <div style="font-size:8px;color:#166534;margin-bottom:6px;">{label_faster_note}</div>
      <table style="border-collapse:collapse;font-size:10px;line-height:1.9;">
        <tr><td style="color:#9ca3af;padding-right:10px;min-width:60px;font-size:9px;text-transform:uppercase;">IBAN</td><td style="font-family:monospace;font-weight:600;color:#1a2b3c;">{company_iban_be}</td></tr>
        <tr><td style="color:#9ca3af;padding-right:10px;font-size:9px;text-transform:uppercase;">BIC/SWIFT</td><td style="font-family:monospace;font-weight:600;color:#1a2b3c;">{company_bic_be}</td></tr>
        <tr><td style="color:#9ca3af;padding-right:10px;font-size:9px;text-transform:uppercase;">Account</td><td style="color:#6b7280;">{company_name}</td></tr>
      </table>
    </td>
    <td style="width:50%;padding:12px 16px;vertical-align:top;">
      <div style="font-size:10px;font-weight:700;color:#1a2b3c;margin-bottom:2px;">{label_regular}</div>
      <div style="font-size:8px;color:#9ca3af;margin-bottom:6px;">{label_regular_note}</div>
      <table style="border-collapse:collapse;font-size:10px;line-height:1.9;">
        <tr><td style="color:#9ca3af;padding-right:10px;min-width:60px;font-size:9px;text-transform:uppercase;">IBAN</td><td style="font-family:monospace;font-weight:600;color:#1a2b3c;">{company_iban_si}</td></tr>
        <tr><td style="color:#9ca3af;padding-right:10px;font-size:9px;text-transform:uppercase;">BIC/SWIFT</td><td style="font-family:monospace;font-weight:600;color:#1a2b3c;">{company_bic_si}</td></tr>
        <tr><td style="color:#9ca3af;padding-right:10px;font-size:9px;text-transform:uppercase;">Account</td><td style="color:#6b7280;">{company_name}</td></tr>
      </table>
    </td>
  </tr></table>
</div>
<div style="padding:10px 36px;border-top:1px solid #f3f4f6;text-align:center;font-size:8px;color:#9ca3af;letter-spacing:0.3px;">
  {company_name} &middot; {company_address} &middot; VAT: {company_vat} &middot; {company_email} &middot; {company_phone}
</div>
${WRAP_END}`

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
        const lang = order.language || 'en'
        const currency = order.currency || '€'
        const billing = order.billing_address as any
        const shipping = order.shipping_address as any
        const isPickup = order.shipping_carrier === 'Personal Pick-up'

        const formatAddress = (addr: any) => {
            if (!addr) return ''
            const parts = [
                addr.street || addr.line1,
                addr.street2,
                [addr.postal_code, addr.city].filter(Boolean).join(' '),
                addr.country
            ].filter(Boolean)
            return parts.join(', ')
        }

        const customerName = order.company_name ||
            [billing?.first_name, billing?.last_name].filter(Boolean).join(' ') ||
            order.customer_email

        const orderDate = new Date(order.created_at).toLocaleDateString(
            lang === 'sl' ? 'sl-SI' : lang === 'hr' ? 'hr-HR' : lang === 'de' ? 'de-DE' : 'en-GB'
        )

        // Valid-until = order date + 30 days
        const validUntil = new Date(new Date(order.created_at).getTime() + 30 * 24 * 60 * 60 * 1000)
            .toLocaleDateString(lang === 'sl' ? 'sl-SI' : lang === 'hr' ? 'hr-HR' : lang === 'de' ? 'de-DE' : 'en-GB')

        // Fully localized document labels
        const docLabels: Record<string, Record<string, string>> = {
            sl: {
                title: 'Predračun', subtitle: 'Ni davčni dokument',
                noteLabel: 'Opomba:', noteText: 'Ta predračun je izdan zgolj za namene plačila. DDV račun bo izdan ob odpremi. Blago se odpremi po prejemu celotnega plačila.',
                labelDate: 'Datum', labelValidUntil: 'Veljavno do', labelOrderRef: 'Ref. naročila', labelPaymentMethod: 'Način plačila',
                labelBillTo: 'Kupec', labelShipTo: 'Naslov dostave',
                labelItems: 'Postavke', labelNo: 'Št.', labelDescription: 'Opis', labelSku: 'Artikel / SKU', labelQty: 'Kol.', labelUnitPrice: 'Cena/enoto', labelAmount: 'Znesek',
                labelSubtotal: 'Osnova (neto)', labelShipping: 'Dostava', labelVat: 'DDV', labelTotal: 'Skupaj',
                labelBankDetails: 'Podatki za nakazilo', labelReference: 'Referenca',
                labelFaster: 'Hitrejše — priporočeno za takojšnji prevzem', labelFasterNote: 'Faster — recommended for immediate pickup',
                labelRegular: 'Običajno — Delavska hranilnica', labelRegularNote: 'Knjiženje lahko traja 1+ delovni dan. Ne uporabljajte za takojšnji prevzem.\nProcessing may take 1+ business day. Do not use for immediate pickup.',
            },
            de: {
                title: 'Proforma-Rechnung', subtitle: 'Kein Steuerdokument',
                noteLabel: 'Hinweis:', noteText: 'Diese Proforma-Rechnung dient nur zu Zahlungszwecken. Eine MwSt.-Rechnung wird bei Versand ausgestellt. Die Ware wird nach Erhalt der vollständigen Zahlung versandt.',
                labelDate: 'Datum', labelValidUntil: 'Gültig bis', labelOrderRef: 'Bestellnr.', labelPaymentMethod: 'Zahlungsart',
                labelBillTo: 'Rechnungsadresse', labelShipTo: 'Lieferadresse',
                labelItems: 'Positionen', labelNo: 'Nr.', labelDescription: 'Beschreibung', labelSku: 'Artikel / SKU', labelQty: 'Menge', labelUnitPrice: 'Einzelpreis', labelAmount: 'Betrag',
                labelSubtotal: 'Zwischensumme (netto)', labelShipping: 'Versand', labelVat: 'MwSt.', labelTotal: 'Gesamtbetrag',
                labelBankDetails: 'Bankverbindung', labelReference: 'Referenz',
                labelFaster: 'Schneller — empfohlen für sofortige Abholung', labelFasterNote: 'Faster — recommended for immediate pickup',
                labelRegular: 'Regulär — Delavska hranilnica', labelRegularNote: 'Buchung kann 1+ Werktag dauern. Nicht für sofortige Abholung verwenden.\nProcessing may take 1+ business day. Do not use for immediate pickup.',
            },
            hr: {
                title: 'Predračun', subtitle: 'Nije porezni dokument',
                noteLabel: 'Napomena:', noteText: 'Ovaj predračun je izdan samo u svrhu plaćanja. PDV račun će biti izdan pri otpremi. Roba se otprema po primitku cjelokupne uplate.',
                labelDate: 'Datum', labelValidUntil: 'Vrijedi do', labelOrderRef: 'Ref. narudžbe', labelPaymentMethod: 'Način plaćanja',
                labelBillTo: 'Kupac', labelShipTo: 'Adresa dostave',
                labelItems: 'Stavke', labelNo: 'Br.', labelDescription: 'Opis', labelSku: 'Artikl / SKU', labelQty: 'Kol.', labelUnitPrice: 'Jed. cijena', labelAmount: 'Iznos',
                labelSubtotal: 'Osnovica (neto)', labelShipping: 'Dostava', labelVat: 'PDV', labelTotal: 'Ukupno',
                labelBankDetails: 'Podaci za plaćanje', labelReference: 'Referenca',
                labelFaster: 'Brže — preporučeno za neposredni preuzimanje', labelFasterNote: 'Faster — recommended for immediate pickup',
                labelRegular: 'Redovno — Delavska hranilnica', labelRegularNote: 'Knjiženje može trajati 1+ radni dan. Ne koristite za neposredni preuzimanje.\nProcessing may take 1+ business day. Do not use for immediate pickup.',
            },
            en: {
                title: 'Proforma Invoice', subtitle: 'Not a tax document',
                noteLabel: 'Note:', noteText: 'This Proforma Invoice is provided for payment purposes only. A VAT invoice will be issued upon shipment. Goods are dispatched upon receipt of full payment.',
                labelDate: 'Date', labelValidUntil: 'Valid Until', labelOrderRef: 'Order Ref.', labelPaymentMethod: 'Payment Method',
                labelBillTo: 'Bill To', labelShipTo: 'Ship To',
                labelItems: 'Items & Services', labelNo: 'No.', labelDescription: 'Description', labelSku: 'Article / SKU', labelQty: 'Qty', labelUnitPrice: 'Unit Price', labelAmount: 'Amount',
                labelSubtotal: 'Subtotal (net)', labelShipping: 'Shipping', labelVat: 'VAT', labelTotal: 'Grand Total',
                labelBankDetails: 'Bank Transfer Details', labelReference: 'Reference',
                labelFaster: 'Faster — recommended for immediate pickup', labelFasterNote: 'Recommended for immediate pickup orders',
                labelRegular: 'Regular speed — Delavska hranilnica', labelRegularNote: 'Processing may take 1+ business day. Do not use for immediate pickup.',
            },
        }
        const L = { ...(docLabels[lang] || docLabels.en) }
        // Append VAT percentage to label (required by law)
        const vatPct = Math.round((order.vat_rate || 0) * 100)
        if (vatPct > 0) {
            L.labelVat = `${L.labelVat} (${vatPct}%)`
        }
        // Override "Ship To" label for pickup orders
        if (isPickup) {
            const pickupShipToLabels: Record<string, string> = {
                sl: 'Lastni prevzem', de: 'Selbstabholung', hr: 'Osobno preuzimanje', en: 'Self-Pickup',
                it: 'Ritiro in sede', cs: 'Osobní odběr', sk: 'Osobný odber', sv: 'Upphämtning',
            }
            L.labelShipTo = pickupShipToLabels[lang] || 'Self-Pickup'
        }

        const documentData: DocumentData = {
            order_number: order.order_number,
            order_date: orderDate,
            customer_name: customerName,
            customer_email: order.customer_email,
            customer_company: order.company_name || billing?.company_name || '',
            customer_vat: order.vat_id || '',
            customer_phone: billing?.phone || shipping?.phone || '',
            billing_address: formatAddress(billing),
            shipping_address: isPickup
                ? 'Initra Energija d.o.o., Podsmreka 59A, 1356 Dobrova, SI'
                : formatAddress(shipping),
            subtotal_net: `${currency} ${parseFloat(order.subtotal || 0).toFixed(2)}`,
            vat_total: `${currency} ${parseFloat(order.vat_amount || 0).toFixed(2)}`,
            shipping_cost: order.shipping_cost == 0
                ? (lang === 'sl' ? 'Prevzem' : lang === 'hr' ? 'Preuzimanje' : 'Pickup / Free')
                : `${currency} ${parseFloat(order.shipping_cost || 0).toFixed(2)}`,
            total_amount: `${currency} ${parseFloat(order.total || 0).toFixed(2)}`,
            payment_method: (() => {
                const v = (order.payment_method || '').toLowerCase()
                if (order.payment_terms === 'net30') {
                    const days = order.payment_terms_days || 30
                    return `Net ${days}`
                }
                if (!v || v === 'wise' || v === 'iban') return lang === 'sl' ? 'Bančno nakazilo' : lang === 'de' ? 'Banküberweisung' : lang === 'hr' ? 'Bankovni prijenos' : 'Bank Transfer'
                if (v === 'invoice') return lang === 'sl' ? 'Bančno nakazilo' : lang === 'de' ? 'Banküberweisung' : lang === 'hr' ? 'Bankovni prijenos' : 'Bank Transfer'
                return order.payment_method
            })(),
            items_table: generateItemsTableHtml(order.order_items, currency, false, {
                no: L.labelNo, description: L.labelDescription, sku: L.labelSku,
                qty: L.labelQty, unitPrice: L.labelUnitPrice, amount: L.labelAmount,
            }),
            // Proforma-specific fields
            invoice_number: `PRF-${order.order_number}`,
            invoice_date: orderDate,
            due_date: validUntil,
            reference: `SI00 ${order.order_number.replace('ETRG-ORD-', '').slice(-6)}`,
            place_of_issue: 'Podsmreka',
            dispatch_date: lang === 'sl' ? 'Po prejemu plačila' : 'Upon payment',
            // Localized labels
            proforma_title: L.title,
            proforma_subtitle: L.subtitle,
            proforma_note_label: L.noteLabel,
            proforma_note_text: L.noteText,
            label_date: L.labelDate,
            label_valid_until: L.labelValidUntil,
            label_order_ref: L.labelOrderRef,
            label_payment_method: L.labelPaymentMethod,
            label_bill_to: L.labelBillTo,
            label_ship_to: L.labelShipTo,
            label_items: L.labelItems,
            label_subtotal: L.labelSubtotal,
            label_shipping: L.labelShipping,
            label_vat: L.labelVat,
            label_total: L.labelTotal,
            label_bank_details: L.labelBankDetails,
            label_reference: L.labelReference,
            label_regular: L.labelRegular,
            label_regular_note: L.labelRegularNote,
            label_faster: L.labelFaster,
            label_faster_note: L.labelFasterNote,
        }

        // Always use built-in localized template (DB templates have broken translations)
        const htmlContent = replacePlaceholders(LOCALIZED_PROFORMA_TEMPLATE, documentData)

        const pdfBuffer = await generatePdfFromHtml(htmlContent)

        return new NextResponse(Buffer.from(pdfBuffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=${encodeURIComponent(L.title)}_${order.order_number}.pdf`,
                'Cache-Control': 'no-cache'
            },
        })
    } catch (err) {
        console.error('Proforma PDF Error:', err)
        return NextResponse.json({ error: 'Failed to generate proforma PDF' }, { status: 500 })
    }
}
