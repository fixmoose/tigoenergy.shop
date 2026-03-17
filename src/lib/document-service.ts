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
    delivery_note_number?: string
    delivery_date?: string
    // Proforma localized labels
    proforma_title?: string
    proforma_subtitle?: string
    proforma_note_label?: string
    proforma_note_text?: string
    // Packing slip specific
    tracking_number?: string
    carrier_name?: string
    packing_items_table?: string
    total_boxes?: string
    total_weight?: string
    // Company details (can be overridden)
    company_name?: string
    company_address?: string
    company_vat?: string
    company_email?: string
    company_phone?: string
    company_iban_be?: string
    company_iban_si?: string
    company_bic?: string
    // Localized document labels
    label_date?: string
    label_valid_until?: string
    label_order_ref?: string
    label_payment_method?: string
    label_bill_to?: string
    label_ship_to?: string
    label_items?: string
    label_subtotal?: string
    label_shipping?: string
    label_vat?: string
    label_total?: string
    label_bank_details?: string
    label_reference?: string
    label_regular?: string
    label_faster?: string
    [key: string]: string | undefined | null
}

export async function getPinnedTemplate(type: string, language: string = 'en') {
    const supabase = await createAdminClient()

    // 1. Try language-specific default
    const { data: template } = await supabase
        .from('document_templates')
        .select('*')
        .eq('type', type)
        .eq('language', language)
        .eq('is_default', true)
        .single()
    if (template) return template

    // 2. Try any template for this language
    const { data: anyLang } = await supabase
        .from('document_templates')
        .select('*')
        .eq('type', type)
        .eq('language', language)
        .limit(1)
        .single()
    if (anyLang) return anyLang

    // 3. Fall back to English default, auto-translate in memory
    if (language !== 'en') {
        const { data: enTemplate } = await supabase
            .from('document_templates')
            .select('*')
            .eq('type', type)
            .eq('language', 'en')
            .eq('is_default', true)
            .single()
        if (enTemplate) {
            const { applyTemplateTranslation } = await import('./template-translations')
            return { ...enTemplate, language, content_html: applyTemplateTranslation(enTemplate.content_html, language) }
        }

        // 4. Any English template
        const { data: anyEn } = await supabase
            .from('document_templates')
            .select('*')
            .eq('type', type)
            .eq('language', 'en')
            .limit(1)
            .single()
        if (anyEn) {
            const { applyTemplateTranslation } = await import('./template-translations')
            return { ...anyEn, language, content_html: applyTemplateTranslation(anyEn.content_html, language) }
        }
    }

    return null
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

export function generatePackingItemsTableHtml(items: any[]) {
    let html = `<table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead>
            <tr style="border-bottom:2px solid #1a2b3c;">
                <th style="text-align:left;padding:0 0 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;width:5%;">No.</th>
                <th style="text-align:left;padding:0 12px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;width:35%;">Product Description</th>
                <th style="text-align:left;padding:0 12px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;width:18%;">SKU / Article</th>
                <th style="text-align:center;padding:0 0 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;width:8%;">Qty</th>
                <th style="text-align:right;padding:0 0 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;width:14%;">Unit Weight</th>
                <th style="text-align:right;padding:0 0 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;width:14%;">Total Weight</th>
                <th style="text-align:center;padding:0 0 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;width:6%;">&#10003;</th>
            </tr>
        </thead>
        <tbody>`;

    items.forEach((item, index) => {
        const unitWeight = parseFloat(item.weight_kg || 0);
        const totalWeight = unitWeight * item.quantity;

        html += `<tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:14px 0;color:#d1d5db;font-size:10px;vertical-align:top;">${index + 1}</td>
                <td style="padding:14px 12px;vertical-align:top;">
                    <div style="font-size:12px;font-weight:600;color:#1a2b3c;">${item.product_name || item.name || ''}</div>
                    <div style="font-size:9px;color:#9ca3af;margin-top:2px;">CN Code: ${item.cn_code || '85414300'}</div>
                </td>
                <td style="padding:14px 12px;vertical-align:top;font-size:11px;color:#6b7280;">${item.sku || '—'}</td>
                <td style="padding:14px 0;text-align:center;font-size:12px;font-weight:600;color:#1a2b3c;vertical-align:top;">${item.quantity}</td>
                <td style="padding:14px 0;text-align:right;font-size:11px;color:#6b7280;vertical-align:top;">${unitWeight.toFixed(3)} kg</td>
                <td style="padding:14px 0;text-align:right;font-size:12px;font-weight:700;color:#1a2b3c;vertical-align:top;">${totalWeight.toFixed(3)} kg</td>
                <td style="padding:14px 0;text-align:center;vertical-align:top;">
                    <div style="width:16px;height:16px;border:2px solid #d1d5db;border-radius:3px;margin:0 auto;"></div>
                </td>
            </tr>`;
    });

    html += `</tbody></table>`;
    return html;
}

export function generateItemsTableHtml(items: any[], currency: string = '€', rowsOnly: boolean = false, headers?: { no?: string; description?: string; sku?: string; qty?: string; unitPrice?: string; amount?: string; cnCode?: string }) {
    let html = '';
    const h = headers || {};
    const cnLabel = h.cnCode || 'CN Code';

    if (!rowsOnly) {
        html += `<table style="width:100%;border-collapse:collapse;font-size:11px;">
            <thead>
                <tr style="border-bottom:2px solid #1a2b3c;">
                    <th style="text-align:left;padding:0 0 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;width:4%;">${h.no || 'No.'}</th>
                    <th style="text-align:left;padding:0 12px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;width:42%;">${h.description || 'Description'}</th>
                    <th style="text-align:left;padding:0 12px 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;width:18%;">${h.sku || 'Article / SKU'}</th>
                    <th style="text-align:center;padding:0 0 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;width:8%;">${h.qty || 'Qty'}</th>
                    <th style="text-align:right;padding:0 0 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;width:14%;">${h.unitPrice || 'Unit Price'}</th>
                    <th style="text-align:right;padding:0 0 10px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;width:14%;">${h.amount || 'Amount'}</th>
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
                    <div style="font-size:9px;color:#9ca3af;margin-top:2px;">${cnLabel}: ${item.cn_code || '85414300'}</div>
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
