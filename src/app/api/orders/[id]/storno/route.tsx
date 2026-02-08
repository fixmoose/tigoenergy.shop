import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../lib/supabase/server'
import { getPinnedTemplate, replacePlaceholders, generateItemsTableHtml, DocumentData } from '../../../../../lib/document-service'
import { generatePdfFromHtml } from '../../../../../lib/pdf-generator'

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = await createClient()

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

    try {
        // 3. Get Pinned Template
        const template = await getPinnedTemplate('storno_invoice', order.language || 'en')
        if (!template) {
            return NextResponse.json({ error: 'Storno invoice template not found' }, { status: 404 })
        }

        // 4. Prepare Data for Placeholders
        const billing = order.billing_address as any
        const shipping = order.shipping_address as any

        const formatAddress = (addr: any) => {
            if (!addr) return 'N/A'
            return `${addr.line1 || ''}, ${addr.postal_code || ''} ${addr.city || ''}, ${addr.country || ''}`
        }

        const originalInvoiceNumber = order.invoice_number || `INV-${order.order_number}`

        const documentData: DocumentData = {
            order_number: order.order_number,
            order_date: new Date(order.created_at).toLocaleDateString(),
            customer_name: `${order.billing_address?.first_name || ''} ${order.billing_address?.last_name || ''}`.trim() || order.customer_email,
            customer_email: order.customer_email,
            customer_company: order.company_name,
            customer_vat: order.vat_id,
            billing_address: formatAddress(billing),
            shipping_address: formatAddress(shipping),
            subtotal_net: `${order.currency || '€'} ${parseFloat(order.subtotal || 0).toFixed(2)}`,
            vat_total: `${order.currency || '€'} ${parseFloat(order.vat_amount || 0).toFixed(2)}`,
            shipping_cost: `${order.currency || '€'} ${parseFloat(order.shipping_cost || 0).toFixed(2)}`,
            total_amount: `${order.currency || '€'} ${parseFloat(order.total || 0).toFixed(2)}`,
            payment_method: order.payment_method || 'Bank Transfer',
            items_table: generateItemsTableHtml(order.order_items, order.currency || '€'),
            invoice_number: originalInvoiceNumber,
            storno_number: `STORNO-${originalInvoiceNumber}`,
            invoice_date: order.invoice_created_at ? new Date(order.invoice_created_at).toLocaleDateString() : new Date().toLocaleDateString(),
            due_date: 'N/A'
        }

        // 5. Replace Placeholders
        const htmlContent = replacePlaceholders(template.content_html, documentData)

        // 6. Generate PDF
        const pdfBuffer = await generatePdfFromHtml(htmlContent)

        // 7. Return PDF response
        return new NextResponse(Buffer.from(pdfBuffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=Storno_${order.order_number}.pdf`,
                'Cache-Control': 'no-cache'
            },
        })
    } catch (err) {
        console.error('PDF Generation Error:', err)
        return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
    }
}
