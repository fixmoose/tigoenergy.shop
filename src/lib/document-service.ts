import { createAdminClient } from '@/lib/supabase/server'
import { INITRA_LOGO_B64 } from '@/lib/logo-base64'

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
    storno_number?: string
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
    const supabase = await createAdminClient()

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
    company_email: 'support@tigoenergy.shop',
    company_phone: '+386 1 542 41 80',
    company_iban_be: 'BE55 9052 7486 2944',
    company_iban_si: 'SI56 6100 0002 8944 371',
    company_bic_be: 'TRWIBEB1XXX',
    company_bic_si: 'HDELSI22',
    place_of_issue: 'Podsmreka',
    company_logo: INITRA_LOGO_B64,
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
        html += `<table style="width:100%;border-collapse:collapse;font-size:11px;">
            <thead>
                <tr style="border-bottom:2px solid #1a2b3c;">
                    <th style="text-align:left;padding:0 0 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;width:4%;">No.</th>
                    <th style="text-align:left;padding:0 12px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;width:42%;">Description</th>
                    <th style="text-align:left;padding:0 12px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;width:18%;">Article / SKU</th>
                    <th style="text-align:center;padding:0 0 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;width:8%;">Qty</th>
                    <th style="text-align:right;padding:0 0 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;width:14%;">Unit Price</th>
                    <th style="text-align:right;padding:0 0 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;width:14%;">Amount</th>
                </tr>
            </thead>
            <tbody>`;
    }

    items.forEach((item, index) => {
        const price = parseFloat(item.unit_price || 0).toFixed(2);
        const total = (parseFloat(item.unit_price || 0) * item.quantity).toFixed(2);

        html += `<tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:16px 0;color:#d1d5db;font-size:10px;vertical-align:top;">${index + 1}</td>
                <td style="padding:16px 12px;vertical-align:top;">
                    <div style="font-size:12px;font-weight:600;color:#1a2b3c;">${item.product_name}</div>
                    <div style="font-size:9px;color:#9ca3af;margin-top:2px;">CN Code: ${item.cn_code || '85414300'}</div>
                </td>
                <td style="padding:16px 12px;vertical-align:top;font-size:11px;color:#6b7280;">${item.sku || '—'}</td>
                <td style="padding:16px 0;text-align:center;font-size:12px;font-weight:600;color:#1a2b3c;vertical-align:top;">${item.quantity}</td>
                <td style="padding:16px 0;text-align:right;font-size:11px;color:#6b7280;vertical-align:top;">${currency} ${price}</td>
                <td style="padding:16px 0;text-align:right;font-size:12px;font-weight:700;color:#1a2b3c;vertical-align:top;">${currency} ${total}</td>
            </tr>`;
    });

    if (!rowsOnly) {
        html += `</tbody></table>`;
    }

    return html;
}
