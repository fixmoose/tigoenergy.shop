import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '../../../../../lib/supabase/server'
import { cookies } from 'next/headers'
import { getPinnedTemplate, replacePlaceholders, generatePackingItemsTableHtml, DocumentData } from '../../../../../lib/document-service'
import { generatePdfFromHtml } from '../../../../../lib/pdf-generator'
import { getLegalClauses } from '../../../../../lib/legal-clauses'
import { calculateTigoParcels } from '../../../../../lib/shipping/dpd'
import { DOCUMENT_TEMPLATES } from '../../../../../lib/document-templates'

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params

    const cookieStore = await cookies()
    let isAdmin = cookieStore.get('tigo-admin')?.value === '1'

    // Allow warehouse members by email param (packing slips don't contain prices)
    if (!isAdmin) {
        const warehouseEmail = req.nextUrl.searchParams.get('warehouse_email')
        if (warehouseEmail) {
            const adminSb = await createAdminClient()
            const { data: driver } = await adminSb.from('drivers').select('id').eq('email', warehouseEmail).eq('is_warehouse', true).single()
            if (driver) isAdmin = true
        }
    }

    const supabase = isAdmin ? await createAdminClient() : await createClient()

    // 1. Fetch Order with Items
    const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', id)
        .single()

    if (orderError || !order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // 2. Security Check (Only owner, admin, or warehouse)
    if (!isAdmin) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        if (order.customer_email !== user.email) {
            const isAdminUser = user.email?.endsWith('@tigoenergy.com') || user.user_metadata?.role === 'admin'
            if (!isAdminUser) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }
        }
    }

    try {
        // 3. Get Pinned Template — fall back to hardcoded if DB template is broken/missing items placeholder
        let templateHtml: string
        const dbTemplate = await getPinnedTemplate('packing_slip', order.language || 'en')
        if (dbTemplate?.content_html?.includes('{packing_items_table}')) {
            templateHtml = dbTemplate.content_html
        } else {
            templateHtml = DOCUMENT_TEMPLATES.packing_slip
        }

        // 4. Prepare Data for Placeholders
        const formatAddress = (addr: any) => {
            if (!addr) return 'N/A'
            return `${addr.street || addr.line1 || ''}, ${addr.postal_code || ''} ${addr.city || ''}, ${addr.country || ''}`
        }

        // Calculate parcels/boxes using DPD packing logic
        const orderItems = order.order_items || []
        const parcels = calculateTigoParcels(orderItems.map((item: any) => ({
            name: item.product_name || item.sku || '',
            sku: item.sku || '',
            quantity: item.quantity,
            weight_kg: item.weight_kg || 0,
        })))
        const totalWeight = orderItems.reduce((sum: number, item: any) => sum + (parseFloat(item.weight_kg || 0) * item.quantity), 0)

        const documentData: DocumentData = {
            order_number: order.order_number,
            order_date: new Date(order.created_at).toLocaleDateString(),
            customer_name: `${order.billing_address?.first_name || ''} ${order.billing_address?.last_name || ''}`.trim() || order.customer_email,
            customer_email: order.customer_email,
            customer_company: order.company_name,
            customer_phone: order.shipping_address?.phone || order.customer_phone || '',
            billing_address: formatAddress(order.billing_address),
            shipping_address: formatAddress(order.shipping_address),
            subtotal_net: `${order.currency || '€'} ${parseFloat(order.subtotal || 0).toFixed(2)}`,
            vat_total: `${order.currency || '€'} ${parseFloat(order.vat_amount || 0).toFixed(2)}`,
            shipping_cost: `${order.currency || '€'} ${parseFloat(order.shipping_cost || 0).toFixed(2)}`,
            total_amount: `${order.currency || '€'} ${parseFloat(order.total || 0).toFixed(2)}`,
            payment_method: order.payment_method || 'N/A',
            items_table: '',
            packing_items_table: generatePackingItemsTableHtml(orderItems),
            total_boxes: String(parcels.length),
            total_weight: `${totalWeight.toFixed(2)} kg`,
            tracking_number: order.tracking_number || 'N/A',
            carrier_name: order.shipping_carrier || 'Standard',
            payment_proof_warning: order.pickup_payment_proof_required
                ? '<div style="margin:0 36px 8px;padding:12px;background:#fef2f2;border:3px solid #ef4444;border-radius:6px;text-align:center;"><span style="font-size:15px;font-weight:900;color:#dc2626;">OBVEZNO PREVERITI DOKAZ O PLAČILU</span><br><span style="font-size:10px;color:#991b1b;">VERIFY PROOF OF PAYMENT BEFORE RELEASING ITEMS</span></div>'
                : ''
        }

        // 5. Replace Placeholders
        let htmlContent = replacePlaceholders(templateHtml, documentData)

        // 6. Inject legal clauses
        const isB2BOrder = !!(order.company_name || order.vat_id)
        const lang = order.language || 'en'
        const clauses = getLegalClauses(lang)
        const enClauses = getLegalClauses('en')
        const isEnglish = lang === 'en'
        const emailLink = '<a href="mailto:support@tigoenergy.shop" style="color:#16a34a;">support@tigoenergy.shop</a>'
        const legalClause = `
<div style="margin-top:32px;padding:14px 16px;border:1px solid #e5e7eb;border-radius:6px;background:#f9fafb;font-size:10px;color:#374151;line-height:1.6;">
  <strong style="display:block;margin-bottom:4px;font-size:10.5px;">${clauses.packingTitle}${!isEnglish ? ` / ${enClauses.packingTitle}` : ''}</strong>
  ${clauses.packingBody.replace('support@tigoenergy.shop', emailLink)}
  ${!isEnglish ? `<br><br><em style="color:#6b7280;">${enClauses.packingBody.replace('support@tigoenergy.shop', emailLink)}</em>` : ''}
  ${isB2BOrder ? `<br><br><strong>${clauses.packingB2BAddition}</strong>${!isEnglish ? `<br><em style="color:#6b7280;">${enClauses.packingB2BAddition}</em>` : ''}` : ''}
</div>`
        htmlContent = htmlContent.replace('</body>', legalClause + '</body>')

        // 7. Generate PDF
        const pdfBuffer = await generatePdfFromHtml(htmlContent)

        // 7. Return PDF response
        return new NextResponse(Buffer.from(pdfBuffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=PackingSlip_${order.order_number}.pdf`,
                'Cache-Control': 'no-cache'
            },
        })
    } catch (err) {
        console.error('Packing Slip Generation Error:', err)
        return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
    }
}
