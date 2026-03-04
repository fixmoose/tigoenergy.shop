import { createClient } from '@/lib/supabase/server'

export interface DocumentData {
    order_number: string
    order_date: string
    customer_name: string
    customer_email: string
    customer_company?: string | null
    customer_vat?: string | null
    customer_phone?: string | null
    billing_address: string
    shipping_address: string
    subtotal_net: string
    vat_total: string
    shipping_cost: string
    total_amount: string
    payment_method: string
    items_table: string
    // Invoice specific
    invoice_number?: string
    invoice_date?: string
    due_date?: string
    dispatch_date?: string
    place_of_issue?: string
    reference?: string
    // Packing slip specific
    tracking_number?: string
    carrier_name?: string
    // Company details (can be overridden)
    company_name?: string
    company_address?: string
    company_vat?: string
    company_email?: string
    company_phone?: string
    company_iban_be?: string
    company_iban_si?: string
    company_bic?: string
}

export async function getPinnedTemplate(type: string, language: string = 'en') {
    const supabase = await createClient()

    // Try to find the pinned (is_default = true) template for this type and language
    const { data: template, error } = await supabase
        .from('document_templates')
        .select('*')
        .eq('type', type)
        .eq('language', language)
        .eq('is_default', true)
        .single()

    if (error || !template) {
        // Fallback to any active template of that type and language
        const { data: fallback } = await supabase
            .from('document_templates')
            .select('*')
            .eq('type', type)
            .eq('language', language)
            .limit(1)
            .single()

        return fallback || null
    }

    return template
}

const DEFAULT_COMPANY_DATA = {
    company_name: 'Initra Energija d.o.o.',
    company_address: 'Podsmreka 59A, 1356 Dobrova, SI',
    company_vat: 'SI 62518313',
    company_email: 'info@tigoenergy.si',
    company_phone: '+386 1 542 41 80',
    company_iban_be: 'BE55 9052 7486 2944',
    company_iban_si: 'SI56 0000 0000 0000 000',
    company_bic: 'LJBASI2X',
    place_of_issue: 'Podsmreka',
    company_logo: `file://${process.cwd()}/public/initra-logo.png`
}

export function replacePlaceholders(html: string, data: DocumentData) {
    let result = html
    const allData = { ...DEFAULT_COMPANY_DATA, ...data }

    Object.entries(allData).forEach(([key, value]) => {
        const regex = new RegExp(`{${key}}`, 'g')
        result = result.replace(regex, value || '')
    })

    return result
}

export function generateItemsTableHtml(items: any[], currency: string = '€', rowsOnly: boolean = false) {
    let html = '';

    if (!rowsOnly) {
        html += `
        <table style="width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 25px; font-size: 10px;">
            <thead>
                <tr>
                    <th style="background: #f8fafc; color: #64748b; font-weight: 700; text-align: left; padding: 12px; font-size: 8px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">No.</th>
                    <th style="background: #f8fafc; color: #64748b; font-weight: 700; text-align: left; padding: 12px; font-size: 8px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">Product Description</th>
                    <th style="background: #f8fafc; color: #64748b; font-weight: 700; text-align: left; padding: 12px; font-size: 8px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">Article / Code</th>
                    <th style="background: #f8fafc; color: #64748b; font-weight: 700; text-align: center; padding: 12px; font-size: 8px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">Qty</th>
                    <th style="background: #f8fafc; color: #64748b; font-weight: 700; text-align: right; padding: 12px; font-size: 8px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">Net Price</th>
                    <th style="background: #f8fafc; color: #64748b; font-weight: 700; text-align: right; padding: 12px; font-size: 8px; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">Amount</th>
                </tr>
            </thead>
            <tbody>`;
    }

    items.forEach((item, index) => {
        const price = parseFloat(item.unit_price || 0).toFixed(2)
        const total = (parseFloat(item.unit_price || 0) * item.quantity).toFixed(2)
        const bgColor = index % 2 === 0 ? '#ffffff' : '#fafafa';

        html += `
            <tr style="background: ${bgColor};">
                <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; color: #94a3b8; font-weight: 500;">${index + 1}</td>
                <td style="padding: 12px; border-bottom: 1px solid #f1f5f9;">
                    <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px;">${item.product_name}</div>
                    <div style="font-size: 8px; color: #64748b; font-style: italic;">Original Product Specification Applied</div>
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 9px;">
                    <div style="color: #475569; font-weight: 500;">${item.sku || 'N/A'}</div>
                    <div style="font-size: 8px; color: #94a3b8;">CN Code: ${item.cn_code || '85414300'}</div>
                </td>
                <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; text-align: center; font-weight: 700; color: #0f172a;">${item.quantity}</td>
                <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; text-align: right; color: #475569; font-weight: 500;">${currency} ${price}</td>
                <td style="padding: 12px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 800; color: #0f172a;">${currency} ${total}</td>
            </tr>`
    })

    if (!rowsOnly) {
        html += `
            </tbody>
        </table>`;
    }

    return html
}
