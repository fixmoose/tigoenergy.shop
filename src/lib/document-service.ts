import { createClient } from '@/lib/supabase/server'

export interface DocumentData {
    order_number: string
    order_date: string
    customer_name: string
    customer_email: string
    customer_company?: string
    customer_vat?: string
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
    storno_number?: string
    tax_exemption_clause?: string
    reverse_charge_note?: string
    // RMA specific
    rma_number?: string
    return_reason?: string
    // Delivery specific
    tracking_number?: string
    package_weight?: string
    carrier_name?: string
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

export function replacePlaceholders(html: string, data: DocumentData) {
    let result = html

    // Add Company Defaults if they don't exist in data
    const companyData = {
        company_name: 'Initra Energija d.o.o.',
        company_address: 'Dolenjska cesta 242, 1000 Ljubljana, SI',
        company_vat: 'SI 12345678', // This should probably come from env or settings later
        company_bank: 'NLB d.d., IBAN: SI56 0000 0000 0000 000'
    }

    const allData = { ...companyData, ...data }

    // Loop through all keys and replace {key}
    Object.entries(allData).forEach(([key, value]) => {
        const regex = new RegExp(`{${key}}`, 'g')
        result = result.replace(regex, value || '')
    })

    return result
}

export function generateItemsTableHtml(items: any[], currency: string = '€') {
    let html = `
    <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
            <tr style="background-color: #f9fafb; border-bottom: 2px solid #eeeeee;">
                <th style="padding: 12px; text-align: left; font-size: 10px; color: #666; text-transform: uppercase;">Product</th>
                <th style="padding: 12px; text-align: center; font-size: 10px; color: #666; text-transform: uppercase;">Qty</th>
                <th style="padding: 12px; text-align: right; font-size: 10px; color: #666; text-transform: uppercase;">Price</th>
                <th style="padding: 12px; text-align: right; font-size: 10px; color: #666; text-transform: uppercase;">Total</th>
            </tr>
        </thead>
        <tbody>`

    items.forEach(item => {
        const price = parseFloat(item.unit_price || 0).toFixed(2)
        const total = (parseFloat(item.unit_price || 0) * item.quantity).toFixed(2)

        html += `
            <tr style="border-bottom: 1px solid #f3f4f6;">
                <td style="padding: 12px; text-align: left;">
                    <div style="font-weight: bold; color: #111;">${item.product_name}</div>
                    <div style="font-size: 10px; color: #999;">SKU: ${item.sku || 'N/A'}</div>
                </td>
                <td style="padding: 12px; text-align: center; color: #444;">${item.quantity}</td>
                <td style="padding: 12px; text-align: right; color: #444;">${currency} ${price}</td>
                <td style="padding: 12px; text-align: right; font-weight: bold; color: #111;">${currency} ${total}</td>
            </tr>`
    })

    html += `
        </tbody>
    </table>`

    return html
}
