import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '../../../../../lib/supabase/server'
import { cookies } from 'next/headers'
import { getPinnedTemplate, replacePlaceholders, generateItemsTableHtml, DocumentData } from '../../../../../lib/document-service'
import { generatePdfFromHtml } from '../../../../../lib/pdf-generator'
import { DOCUMENT_TEMPLATES } from '../../../../../lib/document-templates'

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

        const documentData: DocumentData = {
            order_number: order.order_number,
            order_date: orderDate,
            customer_name: customerName,
            customer_email: order.customer_email,
            customer_company: order.company_name || billing?.company_name || '',
            customer_vat: order.vat_id || '',
            customer_phone: billing?.phone || shipping?.phone || '',
            billing_address: formatAddress(billing),
            shipping_address: formatAddress(shipping),
            subtotal_net: `${currency} ${parseFloat(order.subtotal || 0).toFixed(2)}`,
            vat_total: `${currency} ${parseFloat(order.vat_amount || 0).toFixed(2)}`,
            shipping_cost: order.shipping_cost == 0
                ? (lang === 'sl' ? 'Prevzem' : lang === 'hr' ? 'Preuzimanje' : 'Pickup / Free')
                : `${currency} ${parseFloat(order.shipping_cost || 0).toFixed(2)}`,
            total_amount: `${currency} ${parseFloat(order.total || 0).toFixed(2)}`,
            payment_method: order.payment_method || 'Bank Transfer',
            items_table: generateItemsTableHtml(order.order_items, currency),
            // Proforma-specific fields
            invoice_number: `PRF-${order.order_number}`,
            invoice_date: orderDate,
            due_date: validUntil,
            reference: `00 2-${new Date(order.created_at).getFullYear().toString().slice(-2)}-${order.order_number.slice(-5)}`,
            place_of_issue: 'Podsmreka',
            dispatch_date: 'Upon payment',
        }

        // Try DB template first, fall back to built-in
        const dbTemplate = await getPinnedTemplate('proforma_invoice', lang)
        const htmlContent = dbTemplate
            ? replacePlaceholders(dbTemplate.content_html, documentData)
            : replacePlaceholders(DOCUMENT_TEMPLATES.proforma_invoice, documentData)

        const pdfBuffer = await generatePdfFromHtml(htmlContent)

        return new NextResponse(Buffer.from(pdfBuffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=Proforma_${order.order_number}.pdf`,
                'Cache-Control': 'no-cache'
            },
        })
    } catch (err) {
        console.error('Proforma PDF Error:', err)
        return NextResponse.json({ error: 'Failed to generate proforma PDF' }, { status: 500 })
    }
}
