import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '../../../../../lib/supabase/server'
import { cookies } from 'next/headers'
import { getPinnedTemplate, replacePlaceholders, generateItemsTableHtml, DocumentData } from '../../../../../lib/document-service'
import { generatePdfFromHtml } from '../../../../../lib/pdf-generator'
import { getLegalClauses } from '../../../../../lib/legal-clauses'

// Localized labels for code-generated invoice sections
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

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    // Check if admin cookie is set
    const cookieStore = await cookies()
    const isAdminCookie = cookieStore.get('tigo-admin')?.value === '1'

    const supabase = isAdminCookie ? await createAdminClient() : await createClient()

    // 1. Fetch Order with Items
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', id)
        .single()

    if (orderError || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // 2. Security Check (Only owner or admin)
    if (!isAdminCookie) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        if (order.customer_email !== user.email) {
            const isAdmin = user.email?.endsWith('@tigoenergy.com') || user.user_metadata?.role === 'admin'
            if (!isAdmin) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }
        }
    }

    try {
        // 2b. Fetch payment records
        const { data: payments } = await supabase
            .from('order_payments')
            .select('*')
            .eq('order_id', id)
            .order('payment_date', { ascending: true })

        const lang = order.language || 'en'
        const labels = getLabels(lang)
        const dateLocale = lang === 'sl' ? 'sl-SI' : lang === 'de' ? 'de-DE' : lang === 'hr' ? 'hr-HR' : 'en-GB'

        // 3. Get Pinned Template
        const template = await getPinnedTemplate('invoice', lang)
        if (!template) {
            return NextResponse.json({ error: 'Invoice template not found' }, { status: 404 })
        }

        // 4. Prepare Data for Placeholders
        const billing = order.billing_address as any
        const shipping = order.shipping_address as any

        const formatAddress = (addr: any) => {
            if (!addr) return '-'
            return `${addr.line1 || ''}, ${addr.postal_code || ''} ${addr.city || ''}, ${addr.country || ''}`
        }

        // Derive delivery note number from order number (ETRG-ORD-xxx → ETRG-DOB-xxx)
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
            shipping_address: formatAddress(shipping),
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
            dispatch_date: order.shipped_at ? new Date(order.shipped_at).toLocaleDateString(dateLocale) : labels.uponPayment,
            reference: `SI00 ${order.order_number.replace('ETRG-ORD-', '').slice(-6)}`,
            place_of_issue: 'Podsmreka',
            // New fields for Št. Naročila & Št. Dobavnice
            delivery_note_number: deliveryNoteNumber,
            delivery_date: deliveredAt,
        }

        // 5. Replace Placeholders
        let htmlContent = replacePlaceholders(template.content_html, documentData)

        // 5a. Inject order ref + delivery note reference block before items table
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
        // Insert before the items table
        if (htmlContent.includes('{items_table}')) {
            htmlContent = htmlContent.replace('{items_table}', refBlock + '{items_table}')
        } else {
            // items_table already replaced, inject before first <table with item content
            htmlContent = htmlContent.replace('</body>', refBlock + '</body>')
        }

        // Re-replace any remaining placeholders after injection
        htmlContent = replacePlaceholders(htmlContent, documentData)

        // 5b. Inject payment records table if payments exist
        if (payments && payments.length > 0) {
            const amountPaid = payments.reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0)
            const remaining = parseFloat(order.total || 0) - amountPaid

            const paymentRows = payments.map((p: any) =>
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
            </tr>` : ''}
        </tfoot>
    </table>
</div>`
            // Insert before </body>
            htmlContent = htmlContent.replace('</body>', paymentTable + '</body>')
        }

        // 6. Inject B2B legal clause for B2B orders
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

        // 7. Generate PDF
        const pdfBuffer = await generatePdfFromHtml(htmlContent)

        return new NextResponse(Buffer.from(pdfBuffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=Racun_${order.order_number}.pdf`,
                'Cache-Control': 'no-cache'
            },
        })
    } catch (err) {
        console.error('PDF Generation Error:', err)
        return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
    }
}
