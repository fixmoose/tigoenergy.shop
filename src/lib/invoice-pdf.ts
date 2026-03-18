import { getPinnedTemplate, replacePlaceholders, generateItemsTableHtml, DocumentData } from './document-service'
import { generatePdfFromHtml } from './pdf-generator'
import { getLegalClauses } from './legal-clauses'

const INVOICE_LABELS: Record<string, {
    paymentsReceived: string; date: string; method: string; reference: string; amount: string;
    totalPaid: string; balanceDue: string; uponPayment: string; bankTransfer: string;
    no: string; description: string; sku: string; qty: string; unitPrice: string; amountCol: string;
    cnCode: string; orderRef: string; deliveryNote: string; deliveryDate: string;
}> = {
    sl: {
        paymentsReceived: 'Prejeta plačila', date: 'Datum', method: 'Način', reference: 'Referenca', amount: 'Znesek',
        totalPaid: 'Skupaj plačano', balanceDue: 'Preostali dolg', uponPayment: 'Po prejemu plačila', bankTransfer: 'Bančno nakazilo',
        no: 'Zap.', description: 'Opis', sku: 'Artikel / SKU', qty: 'Kol.', unitPrice: 'Cena/enoto', amountCol: 'Znesek',
        cnCode: 'Tarifna oznaka', orderRef: 'Št. naročila', deliveryNote: 'Št. dobavnice', deliveryDate: 'Datum dostave',
    },
    hr: {
        paymentsReceived: 'Primljena plaćanja', date: 'Datum', method: 'Način', reference: 'Referenca', amount: 'Iznos',
        totalPaid: 'Ukupno plaćeno', balanceDue: 'Preostali dug', uponPayment: 'Po primitku uplate', bankTransfer: 'Bankovni prijenos',
        no: 'Br.', description: 'Opis', sku: 'Artikl / SKU', qty: 'Kol.', unitPrice: 'Cijena/jed.', amountCol: 'Iznos',
        cnCode: 'Tarifna oznaka', orderRef: 'Br. narudžbe', deliveryNote: 'Br. otpremnice', deliveryDate: 'Datum dostave',
    },
    de: {
        paymentsReceived: 'Erhaltene Zahlungen', date: 'Datum', method: 'Methode', reference: 'Referenz', amount: 'Betrag',
        totalPaid: 'Gesamt bezahlt', balanceDue: 'Offener Betrag', uponPayment: 'Nach Zahlungseingang', bankTransfer: 'Banküberweisung',
        no: 'Nr.', description: 'Beschreibung', sku: 'Artikel / SKU', qty: 'Mng.', unitPrice: 'Stückpreis', amountCol: 'Betrag',
        cnCode: 'Zolltarifnr.', orderRef: 'Bestellnr.', deliveryNote: 'Lieferscheinnr.', deliveryDate: 'Lieferdatum',
    },
    en: {
        paymentsReceived: 'Payments Received', date: 'Date', method: 'Method', reference: 'Reference', amount: 'Amount',
        totalPaid: 'Total Paid', balanceDue: 'Balance Due', uponPayment: 'Upon payment', bankTransfer: 'Bank Transfer',
        no: 'No.', description: 'Description', sku: 'Article / SKU', qty: 'Qty', unitPrice: 'Unit Price', amountCol: 'Amount',
        cnCode: 'CN Code', orderRef: 'Order No.', deliveryNote: 'Delivery Note No.', deliveryDate: 'Delivery Date',
    },
}

function getLabels(lang: string) {
    return INVOICE_LABELS[lang] || INVOICE_LABELS.en
}

/**
 * Generate invoice PDF buffer from an order object.
 * Order must include order_items relation.
 * Supabase client is used to fetch payment records.
 */
export async function generateInvoicePdf(order: any, supabase: any): Promise<Uint8Array> {
    const { data: payments } = await supabase
        .from('order_payments')
        .select('*')
        .eq('order_id', order.id)
        .order('payment_date', { ascending: true })

    const lang = order.language || 'en'
    const labels = getLabels(lang)
    const dateLocale = lang === 'sl' ? 'sl-SI' : lang === 'de' ? 'de-DE' : lang === 'hr' ? 'hr-HR' : 'en-GB'

    const template = await getPinnedTemplate('invoice', lang)
    if (!template) throw new Error('Invoice template not found')

    const billing = order.billing_address as any
    const shipping = order.shipping_address as any

    const formatAddress = (addr: any) => {
        if (!addr) return '-'
        return `${addr.line1 || ''}, ${addr.postal_code || ''} ${addr.city || ''}, ${addr.country || ''}`
    }

    const deliveryNoteNumber = order.order_number.replace('ORD', 'DOB')
    const deliveredAt = order.delivered_at ? new Date(order.delivered_at).toLocaleDateString(dateLocale) : '-'

    const documentData: DocumentData = {
        order_number: order.order_number,
        order_date: new Date(order.created_at).toLocaleDateString(dateLocale),
        customer_name: `${order.billing_address?.first_name || ''} ${order.billing_address?.last_name || ''}`.trim() || order.customer_email,
        customer_email: order.customer_email,
        customer_company: order.company_name,
        customer_vat: order.vat_id,
        customer_phone: order.billing_address?.phone || order.shipping_address?.phone,
        billing_address: formatAddress(billing),
        shipping_address: order.shipping_carrier
            ? `<strong>${order.shipping_carrier}</strong><br>${formatAddress(shipping)}`
            : formatAddress(shipping),
        subtotal_net: `${order.currency || '€'} ${parseFloat(order.subtotal || 0).toFixed(2)}`,
        vat_total: `${order.currency || '€'} ${parseFloat(order.vat_amount || 0).toFixed(2)}`,
        shipping_cost: `${order.currency || '€'} ${parseFloat(order.shipping_cost || 0).toFixed(2)}`,
        total_amount: `${order.currency || '€'} ${parseFloat(order.total || 0).toFixed(2)}`,
        payment_method: order.payment_method || labels.bankTransfer,
        items_table: generateItemsTableHtml(order.order_items, order.currency || '€', false, {
            no: labels.no, description: labels.description, sku: labels.sku,
            qty: labels.qty, unitPrice: labels.unitPrice, amount: labels.amountCol,
            cnCode: labels.cnCode,
        }),
        invoice_number: order.invoice_number || `ETRG-INV-${order.order_number}`,
        invoice_date: order.invoice_created_at ? new Date(order.invoice_created_at).toLocaleDateString(dateLocale) : new Date().toLocaleDateString(dateLocale),
        due_date: order.invoice_created_at
            ? new Date(new Date(order.invoice_created_at).getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(dateLocale)
            : new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(dateLocale),
        dispatch_date: order.shipped_at
            ? new Date(order.shipped_at).toLocaleDateString(dateLocale)
            : order.delivered_at
                ? new Date(order.delivered_at).toLocaleDateString(dateLocale)
                : labels.uponPayment,
        reference: `SI00 ${order.order_number.replace('ETRG-ORD-', '').slice(-6)}`,
        place_of_issue: 'Podsmreka',
        delivery_note_number: deliveryNoteNumber,
        delivery_date: deliveredAt,
    }

    let htmlContent = replacePlaceholders(template.content_html, documentData)

    // Inject order ref + delivery note reference block
    const refBlock = `
<div style="margin-bottom:16px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <tr>
            <td style="padding:8px 12px;background:#f9fafb;font-weight:700;color:#374151;width:50%;border-right:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">
                ${labels.orderRef}
            </td>
            <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">
                ${order.order_number}
            </td>
        </tr>
        <tr>
            <td style="padding:8px 12px;background:#f9fafb;font-weight:700;color:#374151;border-right:1px solid #e5e7eb;">
                ${labels.deliveryNote}
            </td>
            <td style="padding:8px 12px;">
                ${deliveryNoteNumber}${deliveredAt !== '-' ? ` &nbsp;|&nbsp; ${labels.deliveryDate}: ${deliveredAt}` : ''}
            </td>
        </tr>
    </table>
</div>`
    if (htmlContent.includes('{items_table}')) {
        htmlContent = htmlContent.replace('{items_table}', refBlock + '{items_table}')
    } else {
        htmlContent = htmlContent.replace('</body>', refBlock + '</body>')
    }

    htmlContent = replacePlaceholders(htmlContent, documentData)

    // Payment records
    let effectivePayments = (payments && payments.length > 0) ? payments : []
    if (effectivePayments.length === 0 && order.payment_status === 'paid' && order.paid_at) {
        effectivePayments = [{
            payment_date: order.paid_at,
            payment_method: order.payment_method || labels.bankTransfer,
            reference: '-',
            amount: order.amount_paid || order.total,
        }]
    }

    if (effectivePayments.length > 0) {
        const amountPaid = effectivePayments.reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0)
        const remaining = parseFloat(order.total || 0) - amountPaid

        const paymentRows = effectivePayments.map((p: any) =>
            `<tr>
                <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:11px;">${new Date(p.payment_date).toLocaleDateString(dateLocale)}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:11px;">${p.payment_method || labels.bankTransfer}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:11px;">${p.reference || '-'}</td>
                <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:11px;text-align:right;font-weight:600;">€${parseFloat(p.amount).toFixed(2)}</td>
            </tr>`
        ).join('')

        const paymentTable = `
<div style="margin-top:24px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
    <div style="background:#f0fdf4;padding:10px 14px;border-bottom:1px solid #e5e7eb;">
        <strong style="font-size:12px;color:#15803d;">${labels.paymentsReceived}</strong>
    </div>
    <table style="width:100%;border-collapse:collapse;">
        <thead>
            <tr style="background:#f9fafb;">
                <th style="text-align:left;padding:6px 10px;font-size:10px;color:#6b7280;text-transform:uppercase;">${labels.date}</th>
                <th style="text-align:left;padding:6px 10px;font-size:10px;color:#6b7280;text-transform:uppercase;">${labels.method}</th>
                <th style="text-align:left;padding:6px 10px;font-size:10px;color:#6b7280;text-transform:uppercase;">${labels.reference}</th>
                <th style="text-align:right;padding:6px 10px;font-size:10px;color:#6b7280;text-transform:uppercase;">${labels.amount}</th>
            </tr>
        </thead>
        <tbody>${paymentRows}</tbody>
        <tfoot>
            <tr style="background:#f0fdf4;">
                <td colspan="3" style="padding:8px 10px;font-size:11px;font-weight:700;color:#15803d;">${labels.totalPaid}</td>
                <td style="padding:8px 10px;font-size:11px;font-weight:700;color:#15803d;text-align:right;">€${amountPaid.toFixed(2)}</td>
            </tr>
            ${remaining > 0.01 ? `<tr style="background:#fef3c7;">
                <td colspan="3" style="padding:8px 10px;font-size:11px;font-weight:700;color:#92400e;">${labels.balanceDue}</td>
                <td style="padding:8px 10px;font-size:11px;font-weight:700;color:#92400e;text-align:right;">€${remaining.toFixed(2)}</td>
            </tr>` : `<tr style="background:#f0fdf4;">
                <td colspan="3" style="padding:8px 10px;font-size:11px;font-weight:700;color:#15803d;">${labels.balanceDue}</td>
                <td style="padding:8px 10px;font-size:11px;font-weight:700;color:#15803d;text-align:right;">€0.00</td>
            </tr>`}
        </tfoot>
    </table>
</div>`
        htmlContent = htmlContent.replace('</body>', paymentTable + '</body>')
    }

    // B2B legal clause
    const isB2BOrder = !!(order.company_name || order.vat_id)
    if (isB2BOrder) {
        const clauses = getLegalClauses(lang)
        const enClauses = getLegalClauses('en')
        const isEnglish = lang === 'en'
        const b2bClause = `
<div style="margin-top:32px;padding:14px 16px;border:1px solid #e5e7eb;border-radius:6px;background:#f9fafb;font-size:10px;color:#374151;line-height:1.6;">
  <strong style="display:block;margin-bottom:4px;font-size:10.5px;">${clauses.invoiceTitle}${!isEnglish ? ` / ${enClauses.invoiceTitle}` : ''}</strong>
  ${clauses.invoiceBody}
  ${!isEnglish ? `<br><br><em style="color:#6b7280;">${enClauses.invoiceBody}</em>` : ''}
</div>`
        htmlContent = htmlContent.replace('</body>', b2bClause + '</body>')
    }

    return generatePdfFromHtml(htmlContent)
}
