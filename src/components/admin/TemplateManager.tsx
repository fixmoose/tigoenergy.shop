'use client'
import React, { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import TemplateEditor from './TemplateEditor'

const DOCUMENT_TYPES = [
    { value: 'invoice', label: 'Invoice' },
    { value: 'proforma_invoice', label: 'Proforma' },
    { value: 'storno_invoice', label: 'Storno' },
    { value: 'order_confirmation', label: 'Order Confirm.' },
    { value: 'packing_slip', label: 'Packing Slip' },
    { value: 'delivery_note', label: 'Delivery Note' },
    { value: 'return_rma', label: 'Return (RMA)' },
]

const LANGUAGES = [
    { value: 'en', label: 'English' },
    { value: 'sl', label: 'Slovenian' },
    { value: 'de', label: 'German' },
    { value: 'fr', label: 'French' },
    { value: 'it', label: 'Italian' },
    { value: 'es', label: 'Spanish' },
]

const PLACEHOLDERS = [
    { key: '{company_logo}', label: 'Logo (img src)' },
    { key: '{company_name}', label: 'Company Name' },
    { key: '{company_address}', label: 'Company Address' },
    { key: '{company_vat}', label: 'Company VAT' },
    { key: '{company_email}', label: 'Company Email' },
    { key: '{company_phone}', label: 'Company Phone' },
    { key: '{company_iban_si}', label: 'IBAN — NLB Slovenia' },
    { key: '{company_iban_be}', label: 'IBAN — Wise Belgium' },
    { key: '{company_bic_si}', label: 'BIC — NLB' },
    { key: '{company_bic_be}', label: 'BIC — Wise' },
    { key: '{place_of_issue}', label: 'Place of Issue' },
    { key: '{invoice_number}', label: 'Invoice / Doc Number' },
    { key: '{storno_number}', label: 'Storno / Credit Number' },
    { key: '{invoice_date}', label: 'Invoice Date' },
    { key: '{due_date}', label: 'Due Date' },
    { key: '{reference}', label: 'Payment Reference' },
    { key: '{dispatch_date}', label: 'Dispatch Date' },
    { key: '{order_number}', label: 'Order Number' },
    { key: '{order_date}', label: 'Order Date' },
    { key: '{customer_name}', label: 'Customer Name' },
    { key: '{customer_email}', label: 'Customer Email' },
    { key: '{customer_company}', label: 'Customer Company' },
    { key: '{customer_vat}', label: 'Customer VAT' },
    { key: '{customer_phone}', label: 'Customer Phone' },
    { key: '{billing_address}', label: 'Billing Address' },
    { key: '{shipping_address}', label: 'Shipping Address' },
    { key: '{items_table}', label: 'Products Table (HTML)' },
    { key: '{subtotal_net}', label: 'Subtotal Net' },
    { key: '{vat_total}', label: 'VAT Total' },
    { key: '{shipping_cost}', label: 'Shipping Cost' },
    { key: '{total_amount}', label: 'Grand Total' },
    { key: '{payment_method}', label: 'Payment Method' },
    { key: '{tracking_number}', label: 'Tracking Number' },
    { key: '{carrier_name}', label: 'Carrier Name' },
    { key: '{rma_number}', label: 'RMA Number' },
    { key: '{return_reason}', label: 'Return Reason' },
]

// ─── Preview sample data ────────────────────────────────────────────────────
const PREVIEW: Record<string, string> = {
    '{company_logo}': '/initra-logo.png',
    '{company_name}': 'Initra Energija d.o.o.',
    '{company_address}': 'Podsmreka 59A, 1356 Dobrova, SI',
    '{company_vat}': 'SI 62518313',
    '{company_email}': 'info@tigoenergy.si',
    '{company_phone}': '+386 1 542 41 80',
    '{company_iban_si}': 'SI56 6100 0002 8944 371',
    '{company_iban_be}': 'BE55 9052 7486 2944',
    '{company_bic_si}': 'HDELSI22',
    '{company_bic_be}': 'TRWIBEB1XXX',
    '{place_of_issue}': 'Podsmreka',
    '{invoice_number}': 'ETRG-INV-2026-0001',
    '{storno_number}': 'ETRG-STORNO-ETRG-INV-2026-0001',
    '{invoice_date}': '6 Mar 2026',
    '{due_date}': '13 Mar 2026',
    '{reference}': 'SI00 26-00001',
    '{dispatch_date}': 'Upon payment',
    '{order_number}': 'ETRG-ORD-1741258800000',
    '{order_date}': '6 Mar 2026',
    '{customer_name}': 'Johan Müller',
    '{customer_company}': 'Solar Solutions GmbH',
    '{customer_vat}': 'DE 299 123 456',
    '{customer_email}': 'j.muller@solarsolutions.de',
    '{customer_phone}': '+49 89 12345678',
    '{billing_address}': 'Hauptstraße 12, 80331 München, Germany',
    '{shipping_address}': 'Hauptstraße 12, 80331 München, Germany',
    '{payment_method}': 'Bank Transfer',
    '{subtotal_net}': '€ 1,000.00',
    '{vat_total}': '€ 0.00',
    '{shipping_cost}': '€ 11.93',
    '{total_amount}': '€ 1,011.93',
    '{tracking_number}': 'LT123456789DE',
    '{carrier_name}': 'DHL Express',
    '{rma_number}': 'RMA-2026-001',
    '{return_reason}': 'Defective product — not functioning as described',
    '{items_table}': `<table style="width:100%;border-collapse:collapse;margin-top:20px;font-size:11px;"><thead><tr><th style="background:#f7fafc;color:#64748b;font-weight:700;text-align:left;padding:9px 12px;font-size:9px;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">No.</th><th style="background:#f7fafc;color:#64748b;font-weight:700;text-align:left;padding:9px 12px;font-size:9px;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">Description</th><th style="background:#f7fafc;color:#64748b;font-weight:700;text-align:left;padding:9px 12px;font-size:9px;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">SKU</th><th style="background:#f7fafc;color:#64748b;font-weight:700;text-align:center;padding:9px 12px;font-size:9px;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">Qty</th><th style="background:#f7fafc;color:#64748b;font-weight:700;text-align:right;padding:9px 12px;font-size:9px;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">Unit Price</th><th style="background:#f7fafc;color:#64748b;font-weight:700;text-align:right;padding:9px 12px;font-size:9px;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">Amount</th></tr></thead><tbody><tr><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#94a3b8;font-size:10px;">1</td><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;"><div style="font-weight:700;color:#0f172a;font-size:11px;">Tigo Optimizer TS4-A-O</div><div style="font-size:9px;color:#64748b;">CN Code: 85414300</div></td><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:10px;color:#475569;">TS4-A-O</td><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;font-weight:700;font-size:11px;">20</td><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:right;color:#475569;font-size:11px;">€ 50.00</td><td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:800;font-size:11px;">€ 1,000.00</td></tr></tbody></table>`,
}

function applyPreview(html: string) {
    let r = html
    for (const [k, v] of Object.entries(PREVIEW)) r = r.split(k).join(v)
    return r
}

// ─── Professional HTML templates ────────────────────────────────────────────

const BANK_BLOCK = `<div style="margin-top:28px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;">
  <div style="background:#f7fafc;border-bottom:1px solid #e2e8f0;padding:10px 18px;display:flex;align-items:center;gap:20px;">
    <span style="font-size:9px;font-weight:800;color:#718096;text-transform:uppercase;letter-spacing:1.5px;">Bank Transfer Details</span>
    <span style="font-size:10px;color:#4a5568;">Reference: <strong style="font-family:Courier New,monospace;color:#1a202c;">{reference}</strong></span>
  </div>
  <table style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="width:50%;padding:16px 20px;vertical-align:top;border-right:1px solid #e2e8f0;">
        <div style="font-size:12px;font-weight:700;color:#1a202c;margin-bottom:10px;">NLB d.d. &mdash; Slovenia</div>
        <table style="border-collapse:collapse;font-size:11px;line-height:2.1;">
          <tr><td style="color:#718096;padding-right:14px;min-width:85px;">IBAN</td><td style="font-family:Courier New,monospace;font-weight:700;color:#1a202c;letter-spacing:0.5px;">{company_iban_si}</td></tr>
          <tr><td style="color:#718096;padding-right:14px;">BIC / SWIFT</td><td style="font-family:Courier New,monospace;font-weight:700;color:#1a202c;letter-spacing:0.5px;">{company_bic_si}</td></tr>
          <tr><td style="color:#718096;padding-right:14px;">Account of</td><td style="color:#4a5568;">{company_name}</td></tr>
        </table>
      </td>
      <td style="width:50%;padding:16px 20px;vertical-align:top;">
        <div style="font-size:12px;font-weight:700;color:#1a202c;margin-bottom:10px;">Wise (TransferWise) &mdash; International</div>
        <table style="border-collapse:collapse;font-size:11px;line-height:2.1;">
          <tr><td style="color:#718096;padding-right:14px;min-width:85px;">IBAN</td><td style="font-family:Courier New,monospace;font-weight:700;color:#1a202c;letter-spacing:0.5px;">{company_iban_be}</td></tr>
          <tr><td style="color:#718096;padding-right:14px;">BIC / SWIFT</td><td style="font-family:Courier New,monospace;font-weight:700;color:#1a202c;letter-spacing:0.5px;">{company_bic_be}</td></tr>
          <tr><td style="color:#718096;padding-right:14px;">Account of</td><td style="color:#4a5568;">{company_name}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</div>`

const TOTALS_BLOCK = `<table style="width:100%;border-collapse:collapse;margin-top:16px;">
  <tr>
    <td style="width:55%;"></td>
    <td style="width:45%;">
      <table style="width:100%;border-collapse:collapse;font-size:11.5px;">
        <tr style="border-bottom:1px solid #edf2f7;"><td style="padding:7px 0;color:#718096;">Subtotal (net)</td><td style="padding:7px 0;text-align:right;font-weight:600;">{subtotal_net}</td></tr>
        <tr style="border-bottom:1px solid #edf2f7;"><td style="padding:7px 0;color:#718096;">Shipping</td><td style="padding:7px 0;text-align:right;font-weight:600;">{shipping_cost}</td></tr>
        <tr style="border-bottom:2px solid #1a202c;"><td style="padding:7px 0;color:#718096;">VAT</td><td style="padding:7px 0;text-align:right;font-weight:600;">{vat_total}</td></tr>
        <tr><td colspan="2" style="padding-top:8px;"><table style="width:100%;border-collapse:collapse;"><tr><td style="background:#1a202c;color:#fff;font-weight:700;font-size:11.5px;padding:11px 14px;border-radius:4px 0 0 4px;">TOTAL DUE</td><td style="background:#1a202c;color:#fff;font-weight:900;font-size:15px;text-align:right;padding:11px 14px;border-radius:0 4px 4px 0;">{total_amount}</td></tr></table></td></tr>
      </table>
    </td>
  </tr>
</table>`

const FOOTER_BLOCK = `<div style="margin-top:28px;padding-top:14px;border-top:1px solid #edf2f7;font-size:9px;color:#a0aec0;text-align:center;line-height:1.8;">
  {company_name} &nbsp;&middot;&nbsp; {company_address} &nbsp;&middot;&nbsp; VAT: {company_vat} &nbsp;&middot;&nbsp; {company_email} &nbsp;&middot;&nbsp; {company_phone}
</div>`

const COMPANY_HEADER = `<img src="{company_logo}" alt="" style="height:50px;max-width:180px;object-fit:contain;display:block;margin-bottom:16px;">
  <div style="font-size:12px;color:#4a5568;line-height:1.8;">
    <strong style="font-size:13px;color:#1a202c;display:block;margin-bottom:2px;">{company_name}</strong>
    {company_address}<br>VAT: {company_vat}<br>{company_email} &nbsp;&middot;&nbsp; {company_phone}
  </div>`

const T: Record<string, string> = {

invoice: `<div style="font-family:Arial,Helvetica,sans-serif;width:714px;margin:0 auto;padding:48px;background:#ffffff;color:#1a202c;box-sizing:border-box;">
<table style="width:100%;border-collapse:collapse;margin-bottom:32px;"><tr>
  <td style="vertical-align:top;width:55%;padding-right:24px;">${COMPANY_HEADER}</td>
  <td style="vertical-align:top;text-align:right;width:45%;">
    <div style="font-size:28px;font-weight:900;color:#1a202c;letter-spacing:-1px;text-transform:uppercase;margin-bottom:16px;">Invoice</div>
    <table style="border-collapse:collapse;font-size:11.5px;margin-left:auto;">
      <tr><td style="padding:3px 14px 3px 0;color:#718096;text-align:right;">Invoice No.</td><td style="padding:3px 0;font-weight:700;color:#1a202c;">{invoice_number}</td></tr>
      <tr><td style="padding:3px 14px 3px 0;color:#718096;text-align:right;">Date</td><td style="padding:3px 0;font-weight:600;color:#1a202c;">{invoice_date}</td></tr>
      <tr><td style="padding:3px 14px 3px 0;color:#718096;text-align:right;">Due Date</td><td style="padding:3px 0;font-weight:700;color:#c53030;">{due_date}</td></tr>
      <tr><td style="padding:3px 14px 3px 0;color:#718096;text-align:right;">Order Ref.</td><td style="padding:3px 0;color:#718096;">{order_number}</td></tr>
    </table>
  </td>
</tr></table>
<div style="height:3px;background:#1a202c;border-radius:2px;margin-bottom:28px;"></div>
<table style="width:100%;border-collapse:collapse;margin-bottom:28px;"><tr>
  <td style="width:50%;vertical-align:top;padding-right:20px;">
    <div style="font-size:9px;font-weight:800;color:#a0aec0;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Bill To</div>
    <div style="font-size:13px;font-weight:700;color:#1a202c;margin-bottom:6px;">{customer_name}</div>
    <div style="font-size:12px;color:#4a5568;line-height:1.8;">{customer_company}<br>VAT: {customer_vat}<br>{billing_address}<br>{customer_email}</div>
  </td>
  <td style="width:50%;vertical-align:top;padding-left:20px;border-left:2px solid #edf2f7;">
    <div style="font-size:9px;font-weight:800;color:#a0aec0;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Deliver To</div>
    <div style="font-size:12px;color:#4a5568;line-height:1.8;margin-bottom:12px;">{shipping_address}</div>
    <div style="font-size:10px;color:#718096;">Payment: <strong style="color:#1a202c;">{payment_method}</strong></div>
    <div style="font-size:10px;color:#718096;">Dispatch: <strong style="color:#1a202c;">{dispatch_date}</strong></div>
    <div style="font-size:10px;color:#718096;">Place of issue: <strong style="color:#1a202c;">{place_of_issue}</strong></div>
  </td>
</tr></table>
{items_table}
${TOTALS_BLOCK}
${BANK_BLOCK}
${FOOTER_BLOCK}
</div>`,

proforma_invoice: `<div style="font-family:Arial,Helvetica,sans-serif;width:714px;margin:0 auto;padding:48px;background:#ffffff;color:#1a202c;box-sizing:border-box;">
<table style="width:100%;border-collapse:collapse;margin-bottom:32px;"><tr>
  <td style="vertical-align:top;width:55%;padding-right:24px;">${COMPANY_HEADER}</td>
  <td style="vertical-align:top;text-align:right;width:45%;">
    <div style="font-size:22px;font-weight:900;color:#1a202c;text-transform:uppercase;margin-bottom:4px;">Proforma Invoice</div>
    <div style="font-size:10px;color:#718096;margin-bottom:14px;font-style:italic;">This is not a tax document</div>
    <table style="border-collapse:collapse;font-size:11.5px;margin-left:auto;">
      <tr><td style="padding:3px 14px 3px 0;color:#718096;text-align:right;">Proforma No.</td><td style="padding:3px 0;font-weight:700;color:#1a202c;">{invoice_number}</td></tr>
      <tr><td style="padding:3px 14px 3px 0;color:#718096;text-align:right;">Date</td><td style="padding:3px 0;font-weight:600;color:#1a202c;">{invoice_date}</td></tr>
      <tr><td style="padding:3px 14px 3px 0;color:#718096;text-align:right;">Valid Until</td><td style="padding:3px 0;font-weight:700;color:#c53030;">{due_date}</td></tr>
      <tr><td style="padding:3px 14px 3px 0;color:#718096;text-align:right;">Order Ref.</td><td style="padding:3px 0;color:#718096;">{order_number}</td></tr>
    </table>
  </td>
</tr></table>
<div style="height:3px;background:#1a202c;border-radius:2px;margin-bottom:20px;"></div>
<div style="background:#fffbeb;border:1px solid #f59e0b;border-radius:6px;padding:12px 18px;margin-bottom:24px;font-size:11px;color:#92400e;">
  <strong>Note:</strong> This Proforma Invoice is provided for your records and payment purposes only. A tax invoice will be issued upon shipment. Goods will be dispatched upon receipt of full payment.
</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:28px;"><tr>
  <td style="width:50%;vertical-align:top;padding-right:20px;">
    <div style="font-size:9px;font-weight:800;color:#a0aec0;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Bill To</div>
    <div style="font-size:13px;font-weight:700;color:#1a202c;margin-bottom:6px;">{customer_name}</div>
    <div style="font-size:12px;color:#4a5568;line-height:1.8;">{customer_company}<br>VAT: {customer_vat}<br>{billing_address}<br>{customer_email}</div>
  </td>
  <td style="width:50%;vertical-align:top;padding-left:20px;border-left:2px solid #edf2f7;">
    <div style="font-size:9px;font-weight:800;color:#a0aec0;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Deliver To</div>
    <div style="font-size:12px;color:#4a5568;line-height:1.8;">{shipping_address}</div>
  </td>
</tr></table>
{items_table}
${TOTALS_BLOCK}
${BANK_BLOCK}
${FOOTER_BLOCK}
</div>`,

storno_invoice: `<div style="font-family:Arial,Helvetica,sans-serif;width:714px;margin:0 auto;padding:48px;background:#ffffff;color:#1a202c;box-sizing:border-box;">
<table style="width:100%;border-collapse:collapse;margin-bottom:32px;"><tr>
  <td style="vertical-align:top;width:55%;padding-right:24px;">${COMPANY_HEADER}</td>
  <td style="vertical-align:top;text-align:right;width:45%;">
    <div style="font-size:24px;font-weight:900;color:#1a202c;text-transform:uppercase;margin-bottom:16px;">Credit Note</div>
    <table style="border-collapse:collapse;font-size:11.5px;margin-left:auto;">
      <tr><td style="padding:3px 14px 3px 0;color:#718096;text-align:right;">Credit Note No.</td><td style="padding:3px 0;font-weight:700;color:#1a202c;">{storno_number}</td></tr>
      <tr><td style="padding:3px 14px 3px 0;color:#718096;text-align:right;">Original Invoice</td><td style="padding:3px 0;font-weight:600;color:#1a202c;">{invoice_number}</td></tr>
      <tr><td style="padding:3px 14px 3px 0;color:#718096;text-align:right;">Date</td><td style="padding:3px 0;font-weight:600;color:#1a202c;">{invoice_date}</td></tr>
    </table>
  </td>
</tr></table>
<div style="height:3px;background:#dc2626;border-radius:2px;margin-bottom:20px;"></div>
<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:12px 18px;margin-bottom:24px;font-size:11px;color:#991b1b;">
  This Credit Note fully cancels and replaces invoice <strong>{invoice_number}</strong>. A refund of <strong>{total_amount}</strong> will be processed to your original payment method within 5&ndash;10 business days.
</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:28px;"><tr>
  <td style="width:50%;vertical-align:top;padding-right:20px;">
    <div style="font-size:9px;font-weight:800;color:#a0aec0;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Issued To</div>
    <div style="font-size:13px;font-weight:700;color:#1a202c;margin-bottom:6px;">{customer_name}</div>
    <div style="font-size:12px;color:#4a5568;line-height:1.8;">{customer_company}<br>VAT: {customer_vat}<br>{billing_address}<br>{customer_email}</div>
  </td>
  <td style="width:50%;vertical-align:top;padding-left:20px;border-left:2px solid #edf2f7;">
    <div style="font-size:9px;font-weight:800;color:#a0aec0;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Order Reference</div>
    <div style="font-size:12px;color:#4a5568;line-height:1.8;">Order: {order_number}<br>Date: {order_date}<br>Place of issue: {place_of_issue}</div>
  </td>
</tr></table>
{items_table}
<table style="width:100%;border-collapse:collapse;margin-top:16px;">
  <tr>
    <td style="width:55%;"></td>
    <td style="width:45%;">
      <table style="width:100%;border-collapse:collapse;font-size:11.5px;">
        <tr style="border-bottom:1px solid #edf2f7;"><td style="padding:7px 0;color:#718096;">Subtotal (net)</td><td style="padding:7px 0;text-align:right;font-weight:600;">{subtotal_net}</td></tr>
        <tr style="border-bottom:1px solid #edf2f7;"><td style="padding:7px 0;color:#718096;">Shipping</td><td style="padding:7px 0;text-align:right;font-weight:600;">{shipping_cost}</td></tr>
        <tr style="border-bottom:2px solid #dc2626;"><td style="padding:7px 0;color:#718096;">VAT</td><td style="padding:7px 0;text-align:right;font-weight:600;">{vat_total}</td></tr>
        <tr><td colspan="2" style="padding-top:8px;"><table style="width:100%;border-collapse:collapse;"><tr><td style="background:#dc2626;color:#fff;font-weight:700;font-size:11.5px;padding:11px 14px;border-radius:4px 0 0 4px;">AMOUNT CREDITED</td><td style="background:#dc2626;color:#fff;font-weight:900;font-size:15px;text-align:right;padding:11px 14px;border-radius:0 4px 4px 0;">{total_amount}</td></tr></table></td></tr>
      </table>
    </td>
  </tr>
</table>
${FOOTER_BLOCK}
</div>`,

order_confirmation: `<div style="font-family:Arial,Helvetica,sans-serif;width:714px;margin:0 auto;padding:48px;background:#ffffff;color:#1a202c;box-sizing:border-box;">
<table style="width:100%;border-collapse:collapse;margin-bottom:32px;"><tr>
  <td style="vertical-align:top;width:55%;padding-right:24px;">${COMPANY_HEADER}</td>
  <td style="vertical-align:top;text-align:right;width:45%;">
    <div style="font-size:22px;font-weight:900;color:#1a202c;text-transform:uppercase;margin-bottom:16px;">Order Confirmation</div>
    <table style="border-collapse:collapse;font-size:11.5px;margin-left:auto;">
      <tr><td style="padding:3px 14px 3px 0;color:#718096;text-align:right;">Order No.</td><td style="padding:3px 0;font-weight:700;color:#1a202c;">{order_number}</td></tr>
      <tr><td style="padding:3px 14px 3px 0;color:#718096;text-align:right;">Date</td><td style="padding:3px 0;font-weight:600;color:#1a202c;">{order_date}</td></tr>
      <tr><td style="padding:3px 14px 3px 0;color:#718096;text-align:right;">Est. Dispatch</td><td style="padding:3px 0;font-weight:600;color:#1a202c;">{dispatch_date}</td></tr>
    </table>
  </td>
</tr></table>
<div style="height:3px;background:#059669;border-radius:2px;margin-bottom:20px;"></div>
<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:6px;padding:14px 18px;margin-bottom:24px;font-size:12px;color:#166534;">
  <strong>Thank you for your order, {customer_name}!</strong> We have received your order and will process it promptly. You will receive a separate invoice once your order is dispatched.
</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:28px;"><tr>
  <td style="width:50%;vertical-align:top;padding-right:20px;">
    <div style="font-size:9px;font-weight:800;color:#a0aec0;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Bill To</div>
    <div style="font-size:13px;font-weight:700;color:#1a202c;margin-bottom:6px;">{customer_name}</div>
    <div style="font-size:12px;color:#4a5568;line-height:1.8;">{customer_company}<br>VAT: {customer_vat}<br>{billing_address}<br>{customer_email}</div>
  </td>
  <td style="width:50%;vertical-align:top;padding-left:20px;border-left:2px solid #edf2f7;">
    <div style="font-size:9px;font-weight:800;color:#a0aec0;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Ship To</div>
    <div style="font-size:12px;color:#4a5568;line-height:1.8;">{shipping_address}</div>
    <div style="margin-top:12px;font-size:10px;color:#718096;">Payment: <strong style="color:#1a202c;">{payment_method}</strong></div>
  </td>
</tr></table>
{items_table}
${TOTALS_BLOCK}
${FOOTER_BLOCK}
</div>`,

packing_slip: `<div style="font-family:Arial,Helvetica,sans-serif;width:714px;margin:0 auto;padding:48px;background:#ffffff;color:#1a202c;box-sizing:border-box;">
<table style="width:100%;border-collapse:collapse;margin-bottom:32px;"><tr>
  <td style="vertical-align:top;width:55%;padding-right:24px;">${COMPANY_HEADER}</td>
  <td style="vertical-align:top;text-align:right;width:45%;">
    <div style="font-size:26px;font-weight:900;color:#1a202c;text-transform:uppercase;margin-bottom:16px;">Packing Slip</div>
    <table style="border-collapse:collapse;font-size:11.5px;margin-left:auto;">
      <tr><td style="padding:3px 14px 3px 0;color:#718096;text-align:right;">Order No.</td><td style="padding:3px 0;font-weight:700;color:#1a202c;">{order_number}</td></tr>
      <tr><td style="padding:3px 14px 3px 0;color:#718096;text-align:right;">Date</td><td style="padding:3px 0;font-weight:600;color:#1a202c;">{order_date}</td></tr>
    </table>
  </td>
</tr></table>
<div style="height:3px;background:#1a202c;border-radius:2px;margin-bottom:28px;"></div>
<table style="width:100%;border-collapse:collapse;margin-bottom:28px;"><tr>
  <td style="width:50%;vertical-align:top;padding-right:20px;">
    <div style="font-size:9px;font-weight:800;color:#a0aec0;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Ship From</div>
    <div style="font-size:12px;color:#4a5568;line-height:1.8;">{company_name}<br>{company_address}</div>
  </td>
  <td style="width:50%;vertical-align:top;padding-left:20px;border-left:2px solid #edf2f7;">
    <div style="font-size:9px;font-weight:800;color:#a0aec0;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Ship To</div>
    <div style="font-size:13px;font-weight:700;color:#1a202c;margin-bottom:4px;">{customer_name}</div>
    <div style="font-size:12px;color:#4a5568;line-height:1.8;">{customer_company}<br>{shipping_address}<br>{customer_phone}</div>
  </td>
</tr></table>
<table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:11px;">
  <thead>
    <tr>
      <th style="background:#f7fafc;color:#64748b;font-weight:700;text-align:left;padding:9px 12px;font-size:9px;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">No.</th>
      <th style="background:#f7fafc;color:#64748b;font-weight:700;text-align:left;padding:9px 12px;font-size:9px;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">Product Description</th>
      <th style="background:#f7fafc;color:#64748b;font-weight:700;text-align:left;padding:9px 12px;font-size:9px;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">SKU / Article</th>
      <th style="background:#f7fafc;color:#64748b;font-weight:700;text-align:center;padding:9px 12px;font-size:9px;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">Qty</th>
      <th style="background:#f7fafc;color:#64748b;font-weight:700;text-align:center;padding:9px 12px;font-size:9px;text-transform:uppercase;border-bottom:2px solid #e2e8f0;">Checked &#10003;</th>
    </tr>
  </thead>
</table>
<div style="margin-top:32px;padding:14px 18px;border:1px dashed #e2e8f0;border-radius:6px;font-size:11px;color:#718096;">
  Please verify all items before sealing the package. Report any discrepancies to <strong>{company_email}</strong>.
</div>
${FOOTER_BLOCK}
</div>`,

delivery_note: `<div style="font-family:Arial,Helvetica,sans-serif;width:714px;margin:0 auto;padding:48px;background:#ffffff;color:#1a202c;box-sizing:border-box;">
<table style="width:100%;border-collapse:collapse;margin-bottom:32px;"><tr>
  <td style="vertical-align:top;width:55%;padding-right:24px;">${COMPANY_HEADER}</td>
  <td style="vertical-align:top;text-align:right;width:45%;">
    <div style="font-size:26px;font-weight:900;color:#1a202c;text-transform:uppercase;margin-bottom:16px;">Delivery Note</div>
    <table style="border-collapse:collapse;font-size:11.5px;margin-left:auto;">
      <tr><td style="padding:3px 14px 3px 0;color:#718096;text-align:right;">Order No.</td><td style="padding:3px 0;font-weight:700;color:#1a202c;">{order_number}</td></tr>
      <tr><td style="padding:3px 14px 3px 0;color:#718096;text-align:right;">Dispatch Date</td><td style="padding:3px 0;font-weight:600;color:#1a202c;">{dispatch_date}</td></tr>
      <tr><td style="padding:3px 14px 3px 0;color:#718096;text-align:right;">Carrier</td><td style="padding:3px 0;font-weight:600;color:#1a202c;">{carrier_name}</td></tr>
      <tr><td style="padding:3px 14px 3px 0;color:#718096;text-align:right;">Tracking No.</td><td style="padding:3px 0;font-weight:700;color:#2563eb;">{tracking_number}</td></tr>
    </table>
  </td>
</tr></table>
<div style="height:3px;background:#1a202c;border-radius:2px;margin-bottom:28px;"></div>
<table style="width:100%;border-collapse:collapse;margin-bottom:28px;"><tr>
  <td style="width:50%;vertical-align:top;padding-right:20px;">
    <div style="font-size:9px;font-weight:800;color:#a0aec0;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Shipped From</div>
    <div style="font-size:12px;color:#4a5568;line-height:1.8;">{company_name}<br>{company_address}</div>
  </td>
  <td style="width:50%;vertical-align:top;padding-left:20px;border-left:2px solid #edf2f7;">
    <div style="font-size:9px;font-weight:800;color:#a0aec0;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Delivered To</div>
    <div style="font-size:13px;font-weight:700;color:#1a202c;margin-bottom:4px;">{customer_name}</div>
    <div style="font-size:12px;color:#4a5568;line-height:1.8;">{customer_company}<br>{shipping_address}<br>{customer_phone}</div>
  </td>
</tr></table>
{items_table}
<div style="margin-top:24px;padding:14px 18px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;font-size:11px;color:#0369a1;">
  Please inspect all items upon receipt. Any damage or shortages must be reported to <strong>{company_email}</strong> within 48 hours of delivery.
</div>
${FOOTER_BLOCK}
</div>`,

return_rma: `<div style="font-family:Arial,Helvetica,sans-serif;width:714px;margin:0 auto;padding:48px;background:#ffffff;color:#1a202c;box-sizing:border-box;">
<table style="width:100%;border-collapse:collapse;margin-bottom:32px;"><tr>
  <td style="vertical-align:top;width:55%;padding-right:24px;">${COMPANY_HEADER}</td>
  <td style="vertical-align:top;text-align:right;width:45%;">
    <div style="font-size:22px;font-weight:900;color:#1a202c;text-transform:uppercase;margin-bottom:16px;">Return Authorization</div>
    <table style="border-collapse:collapse;font-size:11.5px;margin-left:auto;">
      <tr><td style="padding:3px 14px 3px 0;color:#718096;text-align:right;">RMA Number</td><td style="padding:3px 0;font-weight:700;color:#1a202c;">{rma_number}</td></tr>
      <tr><td style="padding:3px 14px 3px 0;color:#718096;text-align:right;">Original Order</td><td style="padding:3px 0;font-weight:600;color:#1a202c;">{order_number}</td></tr>
      <tr><td style="padding:3px 14px 3px 0;color:#718096;text-align:right;">Date</td><td style="padding:3px 0;color:#718096;">{order_date}</td></tr>
    </table>
  </td>
</tr></table>
<div style="height:3px;background:#f59e0b;border-radius:2px;margin-bottom:20px;"></div>
<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:14px 18px;margin-bottom:24px;font-size:11px;color:#92400e;">
  <strong>Return Reason:</strong> {return_reason}
</div>
<table style="width:100%;border-collapse:collapse;margin-bottom:28px;"><tr>
  <td style="width:50%;vertical-align:top;padding-right:20px;">
    <div style="font-size:9px;font-weight:800;color:#a0aec0;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Customer</div>
    <div style="font-size:13px;font-weight:700;color:#1a202c;margin-bottom:6px;">{customer_name}</div>
    <div style="font-size:12px;color:#4a5568;line-height:1.8;">{customer_company}<br>{billing_address}<br>{customer_email}<br>{customer_phone}</div>
  </td>
  <td style="width:50%;vertical-align:top;padding-left:20px;border-left:2px solid #edf2f7;">
    <div style="font-size:9px;font-weight:800;color:#a0aec0;text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">Return Address</div>
    <div style="font-size:12px;font-weight:700;color:#1a202c;margin-bottom:4px;">{company_name}</div>
    <div style="font-size:12px;color:#4a5568;line-height:1.8;">{company_address}</div>
    <div style="margin-top:8px;font-size:11px;color:#f59e0b;font-weight:700;">Mark package: RMA {rma_number}</div>
  </td>
</tr></table>
{items_table}
<div style="margin-top:24px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;">
  <div style="background:#f7fafc;border-bottom:1px solid #e2e8f0;padding:10px 18px;">
    <span style="font-size:9px;font-weight:800;color:#718096;text-transform:uppercase;letter-spacing:1.5px;">Return Instructions</span>
  </div>
  <div style="padding:16px 18px;font-size:11px;color:#4a5568;line-height:1.8;">
    1. Pack all items securely in original packaging if possible.<br>
    2. Include this Return Authorization document inside the package.<br>
    3. Write <strong>RMA {rma_number}</strong> clearly on the outside of the package.<br>
    4. Ship to the return address above. Return shipping costs are covered by the customer unless otherwise agreed.<br>
    5. Contact us at <strong>{company_email}</strong> with the tracking number once shipped.
  </div>
</div>
${FOOTER_BLOCK}
</div>`,

}

// ─── Iframe preview ──────────────────────────────────────────────────────────
const IframePreview = ({ html }: { html: string }) => {
    const ref = useRef<HTMLIFrameElement>(null)
    useEffect(() => {
        const doc = ref.current?.contentDocument
        if (doc) { doc.open(); doc.write(applyPreview(html)); doc.close() }
    }, [html])
    return <iframe ref={ref} className="w-full h-full border-0 bg-white" title="Preview" />
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function TemplateManager() {
    const [templates, setTemplates] = useState<any[]>([])
    const [selectedType, setSelectedType] = useState('invoice')
    const [language, setLanguage] = useState('en')
    const [editing, setEditing] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [view, setView] = useState<'edit' | 'preview'>('edit')
    const [translating, setTranslating] = useState(false)
    const supabase = createClient()

    useEffect(() => { fetchTemplates() }, [])

    useEffect(() => {
        if (!loading) loadTemplate(selectedType, language)
    }, [selectedType, language, loading])

    async function fetchTemplates() {
        setLoading(true)
        const { data } = await supabase.from('document_templates').select('*').order('type')
        if (data) setTemplates(data)
        setLoading(false)
    }

    function loadTemplate(type: string, lang: string) {
        const match = templates.find(t => t.type === type && t.language === lang && t.is_default)
            || templates.find(t => t.type === type && t.language === lang)
        if (match) {
            setEditing({ ...match })
        } else {
            setEditing({
                type,
                language: lang,
                name: `${DOCUMENT_TYPES.find(d => d.value === type)?.label} (${lang.toUpperCase()})`,
                content_html: T[type] || '',
                is_active: true,
                is_default: true,
            })
        }
    }

    async function handleSave() {
        if (!editing) return
        setSaving(true)
        const { id, created_at, updated_at, ...payload } = editing
        // Unset other defaults for same type+language
        if (payload.is_default) {
            const others = templates.filter(t => t.type === payload.type && t.language === payload.language && t.is_default && t.id !== id)
            for (const t of others) await supabase.from('document_templates').update({ is_default: false }).eq('id', t.id)
        }
        const { data, error } = id
            ? await supabase.from('document_templates').update(payload).eq('id', id).select().single()
            : await supabase.from('document_templates').insert([{ ...payload, is_default: true }]).select().single()
        if (!error && data) {
            await fetchTemplates()
            setEditing(data)
        } else {
            alert('Save failed: ' + error?.message)
        }
        setSaving(false)
    }

    async function handleTranslate(targetLang: string) {
        if (!editing?.id || editing.language !== 'en') {
            alert('Translation must be started from an English template.')
            return
        }
        setTranslating(true)
        try {
            const { translateTemplateAction } = await import('@/app/actions/admin')
            const result = await translateTemplateAction(editing.id, targetLang)
            if (result.success) {
                await fetchTemplates()
                setLanguage(targetLang)
            } else {
                alert('Translation failed')
            }
        } catch (e: any) { alert('Translation failed: ' + e.message) }
        setTranslating(false)
    }

    const templateExists = !!(templates.find(t => t.type === selectedType && t.language === language))

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col min-h-[700px]">
            {/* Top bar */}
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b gap-4 flex-wrap">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-widest">Document Templates</h3>
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-medium">Language:</span>
                        <select
                            className="border rounded px-2 py-1 text-xs font-medium bg-white"
                            value={language}
                            onChange={e => setLanguage(e.target.value)}
                        >
                            {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                        </select>
                    </div>
                    {editing && (
                        <>
                            <button
                                onClick={() => setView(v => v === 'edit' ? 'preview' : 'edit')}
                                className="text-xs px-3 py-1.5 border rounded font-medium text-gray-600 hover:bg-gray-100"
                            >
                                {view === 'edit' ? '👁 Preview' : '✏️ Edit'}
                            </button>
                            <button
                                onClick={() => {
                                    if (confirm('Replace current content with the professional default template?'))
                                        setEditing({ ...editing, content_html: T[selectedType] || '' })
                                }}
                                className="text-xs px-3 py-1.5 border border-blue-200 rounded font-medium text-blue-600 bg-blue-50 hover:bg-blue-100"
                            >
                                Apply Professional Default
                            </button>
                            {language === 'en' && editing.id && (
                                <div className="relative group">
                                    <button
                                        disabled={translating}
                                        className="text-xs px-3 py-1.5 border border-purple-200 rounded font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 disabled:opacity-50"
                                    >
                                        {translating ? 'Translating…' : 'Auto-Translate ▾'}
                                    </button>
                                    {!translating && (
                                        <div className="absolute right-0 top-full mt-1 bg-white border rounded shadow-lg z-50 hidden group-hover:block">
                                            {LANGUAGES.filter(l => l.value !== 'en').map(l => (
                                                <button
                                                    key={l.value}
                                                    onClick={() => handleTranslate(l.value)}
                                                    className="block w-full text-left px-4 py-2 text-xs hover:bg-gray-50"
                                                >
                                                    {l.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="text-xs px-4 py-1.5 bg-slate-900 text-white rounded font-bold hover:bg-slate-700 disabled:opacity-50"
                            >
                                {saving ? 'Saving…' : 'Save Template'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Document type tabs */}
            <div className="flex border-b bg-white overflow-x-auto">
                {DOCUMENT_TYPES.map(dt => {
                    const exists = templates.find(t => t.type === dt.value && t.language === language && t.is_default)
                        || templates.find(t => t.type === dt.value && t.language === language)
                    const isSelected = selectedType === dt.value
                    return (
                        <button
                            key={dt.value}
                            onClick={() => setSelectedType(dt.value)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${isSelected
                                ? 'border-slate-900 text-slate-900 bg-white'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            <span className={`w-1.5 h-1.5 rounded-full ${exists ? 'bg-green-500' : 'bg-gray-300'}`} />
                            {dt.label}
                        </button>
                    )
                })}
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading templates…</div>
            ) : !editing ? null : (
                <div className="flex-1 flex overflow-hidden" style={{ minHeight: 600 }}>
                    {/* Sidebar */}
                    <div className="w-56 border-r bg-gray-50/40 flex flex-col overflow-y-auto shrink-0">
                        {/* Template name + default toggle */}
                        <div className="p-4 border-b space-y-3">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Template Name</label>
                                <input
                                    className="w-full border rounded px-2 py-1 text-xs"
                                    value={editing.name}
                                    onChange={e => setEditing({ ...editing, name: e.target.value })}
                                />
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={editing.is_default}
                                    onChange={e => setEditing({ ...editing, is_default: e.target.checked })}
                                />
                                <span className="text-xs font-semibold text-gray-700">Set as Default</span>
                            </label>
                            {!templateExists && (
                                <div className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                    No saved template for {language.toUpperCase()} — save to create one.
                                </div>
                            )}
                        </div>

                        {/* Placeholders */}
                        <div className="p-3 flex-1">
                            <div className="text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-widest">Placeholders</div>
                            <p className="text-[9px] text-gray-400 mb-2">Click to copy · Drag into editor</p>
                            <div className="space-y-0.5">
                                {PLACEHOLDERS.map(p => (
                                    <button
                                        key={p.key}
                                        draggable
                                        onDragStart={e => { e.dataTransfer.setData('text/plain', p.key); e.dataTransfer.effectAllowed = 'copy' }}
                                        onClick={() => navigator.clipboard.writeText(p.key)}
                                        className="w-full text-left group hover:bg-blue-50/50 px-1 py-0.5 rounded transition-colors"
                                        title={p.key}
                                    >
                                        <div className="text-[10px] font-mono text-blue-600 font-bold truncate group-hover:underline">{p.key}</div>
                                        <div className="text-[8px] text-gray-400 uppercase leading-none">{p.label}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Editor / Preview */}
                    <div className="flex-1 overflow-hidden flex flex-col bg-gray-100 p-4">
                        {view === 'edit' ? (
                            <TemplateEditor
                                content={editing.content_html}
                                onChange={html => setEditing({ ...editing, content_html: html })}
                            />
                        ) : (
                            <div className="flex-1 bg-white border rounded shadow-inner overflow-hidden">
                                <IframePreview html={editing.content_html} />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
