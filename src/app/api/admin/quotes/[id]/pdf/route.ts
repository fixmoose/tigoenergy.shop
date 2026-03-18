import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { replacePlaceholders, generateItemsTableHtml, DocumentData } from '@/lib/document-service'
import { generatePdfFromHtml } from '@/lib/pdf-generator'
import { CUSTOMER_BLOCK, WRAP_START, WRAP_END } from '@/lib/document-templates'

const QUOTE_TEMPLATE = `${WRAP_START}
<div style="background:#0f766e;padding:40px 48px;">
  <table style="width:100%;border-collapse:collapse;"><tr>
    <td style="vertical-align:top;width:58%;padding-right:20px;">
      <img src="{company_logo}" alt="" style="height:44px;max-width:160px;object-fit:contain;display:block;margin-bottom:14px;">
      <div style="font-size:11px;color:rgba(255,255,255,0.6);line-height:1.8;">
        <strong style="font-size:13px;color:#ffffff;display:block;margin-bottom:2px;">{company_name}</strong>
        {company_address}<br>VAT: {company_vat}<br>{company_email}
      </div>
    </td>
    <td style="vertical-align:top;text-align:right;width:42%;">
      <div style="font-size:28px;font-weight:300;letter-spacing:-1px;color:#ffffff;line-height:1.1;">{quote_title}</div>
      <div style="font-size:11px;color:rgba(255,255,255,0.4);font-style:italic;margin:4px 0 18px;">{quote_subtitle}</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.5);">{quote_number}</div>
    </td>
  </tr></table>
</div>
<div style="background:#f0fdfa;border-bottom:2px solid #14b8a6;padding:12px 48px;font-size:11px;color:#134e4a;">
  <strong>{quote_note_label}</strong> {quote_note_text}
</div>
<div style="background:#f9fafb;border-bottom:1px solid #f3f4f6;padding:14px 48px;">
  <table style="width:100%;border-collapse:collapse;"><tr>
    <td style="padding:2px 32px 2px 0;"><span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;display:block;">{label_date}</span><span style="font-size:12px;font-weight:600;color:#1a2b3c;">{quote_date}</span></td>
    <td style="padding:2px 32px 2px 0;"><span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;display:block;">{label_valid_until}</span><span style="font-size:12px;font-weight:600;color:#f59e0b;">{expires_at}</span></td>
    <td style="padding:2px 32px 2px 0;"><span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;display:block;">{label_market}</span><span style="font-size:12px;font-weight:600;color:#1a2b3c;">{market}</span></td>
  </tr></table>
</div>
<div style="padding:32px 48px;border-bottom:1px solid #f3f4f6;">
  <table style="width:100%;border-collapse:collapse;"><tr>
    <td style="width:50%;vertical-align:top;padding-right:24px;">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:#9ca3af;margin-bottom:10px;">{label_customer}</div>
      ${CUSTOMER_BLOCK}
    </td>
    <td style="width:50%;vertical-align:top;padding-left:24px;border-left:1px solid #f3f4f6;">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:#9ca3af;margin-bottom:10px;">{label_ship_to}</div>
      <div style="font-size:11px;color:#6b7280;line-height:1.8;">{shipping_address}</div>
    </td>
  </tr></table>
</div>
<div style="padding:32px 48px;">
  <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;color:#9ca3af;margin-bottom:20px;">{label_items}</div>
  {items_table}
  <div style="margin-top:24px;display:flex;justify-content:flex-end;">
    <table style="width:280px;border-collapse:collapse;font-size:12px;">
      <tr><td style="padding:6px 0;color:#6b7280;">{label_subtotal}</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#1a2b3c;">{subtotal_net}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">{label_shipping}</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#1a2b3c;">{shipping_cost}</td></tr>
      <tr><td style="padding:6px 0;color:#6b7280;">{label_vat}</td><td style="padding:6px 0;text-align:right;font-weight:600;color:#1a2b3c;">{vat_total}</td></tr>
      <tr style="border-top:2px solid #1a2b3c;"><td style="padding:12px 0;font-weight:800;font-size:14px;color:#0f766e;">{label_total}</td><td style="padding:12px 0;text-align:right;font-weight:800;font-size:14px;color:#0f766e;">{total_amount}</td></tr>
    </table>
  </div>
</div>
${WRAP_END}`

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: quoteId } = await params

    const cookieStore = await cookies()
    const isAdminCookie = cookieStore.get('tigo-admin')?.value === '1'

    if (!isAdminCookie) {
        const userSupabase = await createClient()
        const { data: { user } } = await userSupabase.auth.getUser()
        if (!user || user.user_metadata?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
    }

    const supabase = await createAdminClient()

    const { data: quote, error } = await supabase
        .from('quotes')
        .select('*, items:quote_items(*)')
        .eq('id', quoteId)
        .single()

    if (error || !quote) {
        return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    try {
        const lang = quote.language || 'en'
        const currency = quote.currency || '€'
        const dateLocale = lang === 'sl' ? 'sl-SI' : lang === 'hr' ? 'hr-HR' : lang === 'de' ? 'de-DE' : 'en-GB'

        const formatAddress = (addr: any) => {
            if (!addr) return '-'
            const parts = [
                addr.street || addr.line1,
                addr.street2,
                [addr.postal_code, addr.city].filter(Boolean).join(' '),
                addr.country
            ].filter(Boolean)
            return parts.join(', ')
        }

        const labels: Record<string, Record<string, string>> = {
            sl: {
                title: 'Ponudba', subtitle: 'Ni davčni dokument',
                noteLabel: 'Opomba:', noteText: 'Ta ponudba je informativnega značaja. Ob potrditvi bo ustvarjeno naročilo s predračunom za plačilo.',
                labelDate: 'Datum', labelValidUntil: 'Veljavno do', labelMarket: 'Trg',
                labelCustomer: 'Kupec', labelShipTo: 'Naslov dostave',
                labelItems: 'Postavke', labelNo: 'Št.', labelDescription: 'Opis', labelSku: 'Artikel / SKU', labelQty: 'Kol.', labelUnitPrice: 'Cena/enoto', labelAmount: 'Znesek',
                labelSubtotal: 'Osnova (neto)', labelShipping: 'Dostava', labelVat: 'DDV', labelTotal: 'Skupaj',
            },
            de: {
                title: 'Angebot', subtitle: 'Kein Steuerdokument',
                noteLabel: 'Hinweis:', noteText: 'Dieses Angebot dient nur zu Informationszwecken. Nach Bestätigung wird eine Bestellung mit Proforma-Rechnung erstellt.',
                labelDate: 'Datum', labelValidUntil: 'Gültig bis', labelMarket: 'Markt',
                labelCustomer: 'Kunde', labelShipTo: 'Lieferadresse',
                labelItems: 'Positionen', labelNo: 'Nr.', labelDescription: 'Beschreibung', labelSku: 'Artikel / SKU', labelQty: 'Menge', labelUnitPrice: 'Einzelpreis', labelAmount: 'Betrag',
                labelSubtotal: 'Zwischensumme (netto)', labelShipping: 'Versand', labelVat: 'MwSt.', labelTotal: 'Gesamtbetrag',
            },
            hr: {
                title: 'Ponuda', subtitle: 'Nije porezni dokument',
                noteLabel: 'Napomena:', noteText: 'Ova ponuda je informativnog karaktera. Po prihvaćanju bit će kreirana narudžba s predračunom za plaćanje.',
                labelDate: 'Datum', labelValidUntil: 'Vrijedi do', labelMarket: 'Tržište',
                labelCustomer: 'Kupac', labelShipTo: 'Adresa dostave',
                labelItems: 'Stavke', labelNo: 'Br.', labelDescription: 'Opis', labelSku: 'Artikl / SKU', labelQty: 'Kol.', labelUnitPrice: 'Jed. cijena', labelAmount: 'Iznos',
                labelSubtotal: 'Osnovica (neto)', labelShipping: 'Dostava', labelVat: 'PDV', labelTotal: 'Ukupno',
            },
            en: {
                title: 'Quotation', subtitle: 'Not a tax document',
                noteLabel: 'Note:', noteText: 'This quotation is for informational purposes only. Upon acceptance, an order with a proforma invoice will be created.',
                labelDate: 'Date', labelValidUntil: 'Valid Until', labelMarket: 'Market',
                labelCustomer: 'Customer', labelShipTo: 'Ship To',
                labelItems: 'Items & Services', labelNo: 'No.', labelDescription: 'Description', labelSku: 'Article / SKU', labelQty: 'Qty', labelUnitPrice: 'Unit Price', labelAmount: 'Amount',
                labelSubtotal: 'Subtotal (net)', labelShipping: 'Shipping', labelVat: 'VAT', labelTotal: 'Grand Total',
            },
        }
        const L = labels[lang] || labels.en

        const shipping = quote.shipping_address as any

        const documentData: DocumentData = {
            order_number: quote.quote_number,
            order_date: new Date(quote.created_at).toLocaleDateString(dateLocale),
            customer_name: quote.company_name || quote.customer_email,
            customer_email: quote.customer_email,
            customer_company: quote.company_name || '',
            customer_vat: quote.vat_id || '',
            customer_phone: quote.customer_phone || '',
            billing_address: '-',
            shipping_address: formatAddress(shipping),
            subtotal_net: `${currency} ${parseFloat(quote.subtotal || 0).toFixed(2)}`,
            vat_total: `${currency} ${parseFloat(quote.vat_amount || 0).toFixed(2)}`,
            shipping_cost: quote.shipping_cost == 0
                ? (lang === 'sl' ? 'Prevzem' : lang === 'hr' ? 'Preuzimanje' : 'Pickup / Free')
                : `${currency} ${parseFloat(quote.shipping_cost || 0).toFixed(2)}`,
            total_amount: `${currency} ${parseFloat(quote.total || 0).toFixed(2)}`,
            payment_method: lang === 'sl' ? 'Bančno nakazilo' : lang === 'de' ? 'Banküberweisung' : lang === 'hr' ? 'Bankovni prijenos' : 'Bank Transfer',
            items_table: generateItemsTableHtml(
                (quote.items || []).map((item: any) => ({
                    ...item,
                    name: item.product_name,
                    unit_price_net: item.unit_price,
                    total_net: item.total_price,
                })),
                currency, false, {
                    no: L.labelNo, description: L.labelDescription, sku: L.labelSku,
                    qty: L.labelQty, unitPrice: L.labelUnitPrice, amount: L.labelAmount,
                }
            ),
            // Quote-specific placeholders
            quote_title: L.title,
            quote_subtitle: L.subtitle,
            quote_number: quote.quote_number,
            quote_note_label: L.noteLabel,
            quote_note_text: L.noteText,
            quote_date: new Date(quote.created_at).toLocaleDateString(dateLocale),
            expires_at: new Date(quote.expires_at).toLocaleDateString(dateLocale),
            market: (quote.market || '').toUpperCase(),
            label_date: L.labelDate,
            label_valid_until: L.labelValidUntil,
            label_market: L.labelMarket,
            label_customer: L.labelCustomer,
            label_ship_to: L.labelShipTo,
            label_items: L.labelItems,
            label_subtotal: L.labelSubtotal,
            label_shipping: L.labelShipping,
            label_vat: L.labelVat,
            label_total: L.labelTotal,
        }

        const htmlContent = replacePlaceholders(QUOTE_TEMPLATE, documentData)
        const pdfBuffer = await generatePdfFromHtml(htmlContent)

        return new NextResponse(Buffer.from(pdfBuffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=${encodeURIComponent(L.title)}_${quote.quote_number}.pdf`,
                'Cache-Control': 'no-cache'
            },
        })
    } catch (err) {
        console.error('Quote PDF Error:', err)
        return NextResponse.json({ error: 'Failed to generate quote PDF' }, { status: 500 })
    }
}
