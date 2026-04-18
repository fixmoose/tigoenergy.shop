// Shared document template HTML builders used by both TemplateManager (editor preview)
// and the PDF generation routes (server-side fallback when no DB template is pinned).

// Compact header: thin navy border on top, white background, less ink
const COMPACT_HDR = (title: string, subtitle: string, extraInfo?: string) => `<div style="border-top:6px solid #1a2b3c;padding:16px 36px;background:#ffffff;">
  <table style="width:100%;border-collapse:collapse;"><tr>
    <td style="vertical-align:top;width:58%;padding-right:16px;">
      <img src="{company_logo}" alt="" style="height:32px;max-width:140px;object-fit:contain;display:block;margin-bottom:8px;">
      <div style="font-size:10px;color:#6b7280;line-height:1.7;">
        <strong style="font-size:11px;color:#1a2b3c;display:block;margin-bottom:1px;">{company_name}</strong>
        {company_address}${extraInfo ? `<br>${extraInfo}` : ''}
      </div>
    </td>
    <td style="vertical-align:top;text-align:right;width:42%;">
      <div style="font-size:24px;font-weight:300;letter-spacing:-1px;color:#1a2b3c;line-height:1;">${title}</div>
      <div style="font-size:11px;color:#9ca3af;margin:4px 0;">${subtitle}</div>
    </td>
  </tr></table>
</div>`

export const NAVY_HDR = (title: string, subtitle: string) => COMPACT_HDR(title, subtitle, 'VAT: {company_vat}<br>{company_email}')

export const META_ROW = (fields: { label: string, value: string, highlight?: boolean }[]) =>
    `<div style="background:#f9fafb;border-bottom:1px solid #f3f4f6;padding:8px 36px;">
  <table style="width:100%;border-collapse:collapse;"><tr>
    ${fields.map(f => `<td style="padding:2px 24px 2px 0;"><span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;display:block;">${f.label}</span><span style="font-size:11px;font-weight:600;color:${f.highlight ? '#f59e0b' : '#1a2b3c'};">${f.value}</span></td>`).join('')}
  </tr></table>
</div>`

export const BILL_SHIP = (leftLabel: string, leftContent: string, rightLabel: string, rightContent: string) =>
    `<div style="padding:16px 36px;border-bottom:1px solid #f3f4f6;">
  <table style="width:100%;border-collapse:collapse;"><tr>
    <td style="width:50%;vertical-align:top;padding-right:20px;">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;margin-bottom:6px;">${leftLabel}</div>
      ${leftContent}
    </td>
    <td style="width:50%;vertical-align:top;padding-left:20px;border-left:1px solid #f3f4f6;">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;margin-bottom:6px;">${rightLabel}</div>
      ${rightContent}
    </td>
  </tr></table>
</div>`

export const ITEMS_SECTION = `<div style="padding:16px 36px;">
  <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;margin-bottom:10px;">Items &amp; Services</div>
  {items_table}
</div>`

export const TOTALS_SECTION = `<div style="padding:0 36px 16px;">
  <table style="width:100%;border-collapse:collapse;"><tr>
    <td style="width:55%;"></td>
    <td style="width:45%;">
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <tr><td style="padding:4px 0;color:#9ca3af;">Subtotal (net)</td><td style="padding:4px 0;text-align:right;font-weight:600;color:#1a2b3c;">{subtotal_net}</td></tr>
        <tr><td style="padding:4px 0;color:#9ca3af;">Shipping</td><td style="padding:4px 0;text-align:right;font-weight:600;color:#1a2b3c;">{shipping_cost}</td></tr>
        <tr style="border-bottom:2px solid #1a2b3c;"><td style="padding:4px 0 8px;color:#9ca3af;">VAT</td><td style="padding:4px 0 8px;text-align:right;font-weight:600;color:#1a2b3c;">{vat_total}</td></tr>
        <tr><td style="padding:10px 0 4px;font-size:13px;font-weight:700;color:#1a2b3c;">Grand Total</td><td style="padding:10px 0 4px;text-align:right;font-size:18px;font-weight:700;color:#1a2b3c;">{total_amount}</td></tr>
      </table>
    </td>
  </tr></table>
</div>`

export const BANK_SECTION = `<div style="margin:0 36px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
  <div style="padding:8px 16px;border-bottom:1px solid #e5e7eb;">
    <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;">Podatki za nakazilo / Bank Transfer Details</span>
    <span style="font-size:10px;color:#6b7280;margin-left:12px;">Referenca / Reference: <strong style="font-family:monospace;color:#1a2b3c;">{reference}</strong></span>
  </div>
  <table style="width:100%;border-collapse:collapse;"><tr>
    <td style="width:50%;padding:12px 16px;vertical-align:top;border-right:1px solid #f3f4f6;">
      <div style="font-size:10px;font-weight:700;color:#16a34a;margin-bottom:2px;">Hitrejše — priporočeno za takojšnji prevzem</div>
      <div style="font-size:8px;color:#166534;margin-bottom:6px;">Faster — recommended for immediate pickup</div>
      <table style="border-collapse:collapse;font-size:10px;line-height:1.9;">
        <tr><td style="color:#9ca3af;padding-right:10px;min-width:60px;font-size:9px;text-transform:uppercase;">IBAN</td><td style="font-family:monospace;font-weight:600;color:#1a2b3c;">{company_iban_be}</td></tr>
        <tr><td style="color:#9ca3af;padding-right:10px;font-size:9px;text-transform:uppercase;">BIC/SWIFT</td><td style="font-family:monospace;font-weight:600;color:#1a2b3c;">{company_bic_be}</td></tr>
        <tr><td style="color:#9ca3af;padding-right:10px;font-size:9px;text-transform:uppercase;">Account</td><td style="color:#6b7280;">{company_name}</td></tr>
      </table>
    </td>
    <td style="width:50%;padding:12px 16px;vertical-align:top;">
      <div style="font-size:10px;font-weight:700;color:#1a2b3c;margin-bottom:2px;">Običajno — Delavska hranilnica</div>
      <div style="font-size:8px;color:#9ca3af;margin-bottom:6px;">Knjiženje lahko traja 1+ delovni dan. Ne uporabljajte za takojšnji prevzem.<br>Processing may take 1+ business day. Do not use for immediate pickup.</div>
      <table style="border-collapse:collapse;font-size:10px;line-height:1.9;">
        <tr><td style="color:#9ca3af;padding-right:10px;min-width:60px;font-size:9px;text-transform:uppercase;">IBAN</td><td style="font-family:monospace;font-weight:600;color:#1a2b3c;">{company_iban_si}</td></tr>
        <tr><td style="color:#9ca3af;padding-right:10px;font-size:9px;text-transform:uppercase;">BIC/SWIFT</td><td style="font-family:monospace;font-weight:600;color:#1a2b3c;">{company_bic_si}</td></tr>
        <tr><td style="color:#9ca3af;padding-right:10px;font-size:9px;text-transform:uppercase;">Account</td><td style="color:#6b7280;">{company_name}</td></tr>
      </table>
    </td>
  </tr></table>
</div>`

export const FOOTER_SECTION = `<div style="padding:10px 36px;border-top:1px solid #f3f4f6;text-align:center;font-size:8px;color:#9ca3af;letter-spacing:0.3px;">
  {company_name} &nbsp;&middot;&nbsp; {company_address} &nbsp;&middot;&nbsp; VAT: {company_vat} &nbsp;&middot;&nbsp; {company_email} &nbsp;&middot;&nbsp; {company_phone}
</div>`

export const WRAP_START = `<div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;width:794px;margin:0 auto;background:#ffffff;color:#333333;box-sizing:border-box;">`
export const WRAP_END = `</div>`

export const CUSTOMER_BLOCK = `<div style="font-size:12px;font-weight:700;color:#1a2b3c;margin-bottom:3px;">{customer_name}</div>
      <div style="font-size:10px;color:#6b7280;line-height:1.7;">{customer_company}<br>VAT: {customer_vat}<br>{billing_address}<br>{customer_email}</div>`

export const DOCUMENT_TEMPLATES: Record<string, string> = {

storno_invoice: `${WRAP_START}
${COMPACT_HDR('Credit Note', '{storno_number}', 'VAT: {company_vat}<br>{company_email}')}
<div style="background:#fef2f2;border-bottom:2px solid #ef4444;padding:8px 36px;font-size:10px;color:#991b1b;">
  This Credit Note cancels invoice <strong>{invoice_number}</strong>. A refund of <strong>{total_amount}</strong> will be processed within 5&ndash;10 business days.
</div>
${META_ROW([
    { label: 'Credit Note No.', value: '{storno_number}' },
    { label: 'Original Invoice', value: '{invoice_number}' },
    { label: 'Date', value: '{invoice_date}' },
])}
${BILL_SHIP('Issued To', CUSTOMER_BLOCK,
    'Order Reference',
    `<div style="font-size:10px;color:#6b7280;line-height:1.7;">Order: {order_number}<br>Date: {order_date}<br>Place of issue: {place_of_issue}</div>`
)}
${ITEMS_SECTION}
<div style="padding:0 36px 16px;">
  <table style="width:100%;border-collapse:collapse;"><tr>
    <td style="width:55%;"></td>
    <td style="width:45%;">
      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <tr><td style="padding:4px 0;color:#9ca3af;">Subtotal (net)</td><td style="padding:4px 0;text-align:right;font-weight:600;color:#1a2b3c;">{subtotal_net}</td></tr>
        <tr><td style="padding:4px 0;color:#9ca3af;">Shipping</td><td style="padding:4px 0;text-align:right;font-weight:600;color:#1a2b3c;">{shipping_cost}</td></tr>
        <tr style="border-bottom:2px solid #ef4444;"><td style="padding:4px 0 8px;color:#9ca3af;">VAT</td><td style="padding:4px 0 8px;text-align:right;font-weight:600;color:#1a2b3c;">{vat_total}</td></tr>
        <tr><td style="padding:10px 0 4px;font-size:13px;font-weight:700;color:#ef4444;">Amount Credited</td><td style="padding:10px 0 4px;text-align:right;font-size:18px;font-weight:700;color:#ef4444;">{total_amount}</td></tr>
      </table>
    </td>
  </tr></table>
</div>
${FOOTER_SECTION}
${WRAP_END}`,

order_confirmation: `${WRAP_START}
${COMPACT_HDR('Order Confirmation', '{order_number}', 'VAT: {company_vat}<br>{company_email}')}
<div style="background:#f0fdf4;border-bottom:2px solid #22c55e;padding:8px 36px;font-size:11px;color:#166534;">
  <strong>Thank you for your order, {customer_name}!</strong> Your order has been confirmed and is being prepared. A separate invoice will be issued upon dispatch.
</div>
${META_ROW([
    { label: 'Order Date', value: '{order_date}' },
    { label: 'Est. Dispatch', value: '{dispatch_date}' },
    { label: 'Payment', value: '{payment_method}' },
])}
${BILL_SHIP('Bill To', CUSTOMER_BLOCK, 'Ship To', `<div style="font-size:10px;color:#6b7280;line-height:1.7;">{shipping_address}</div>`)}
${ITEMS_SECTION}
${TOTALS_SECTION}
${FOOTER_SECTION}
${WRAP_END}`,

packing_slip: `${WRAP_START}
${COMPACT_HDR('Packing Slip', '{order_number}')}
${META_ROW([{ label: 'Order Date', value: '{order_date}' }])}
${BILL_SHIP(
    'Ship From',
    `<div style="font-size:10px;color:#6b7280;line-height:1.7;">{company_name}<br>{company_address}</div>`,
    'Ship To',
    `<div style="font-size:12px;font-weight:700;color:#1a2b3c;margin-bottom:3px;">{customer_name}</div>
      <div style="font-size:10px;color:#6b7280;line-height:1.7;">{customer_company}<br>{shipping_address}<br>{customer_phone}</div>`
)}
{payment_proof_warning}
<div style="padding:16px 36px;">
  <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;margin-bottom:10px;">Items to Pack</div>
  {packing_items_table}
  <div style="margin-top:12px;padding:10px 14px;background:#f0f9ff;border:1px solid #bfdbfe;border-radius:6px;">
    <table style="width:100%;border-collapse:collapse;font-size:11px;color:#1e40af;">
      <tr>
        <td style="padding:2px 0;font-weight:700;">Total Parcels / Boxes:</td>
        <td style="padding:2px 0;text-align:right;font-size:14px;font-weight:900;">{total_boxes}</td>
        <td style="padding:2px 0 2px 24px;font-weight:700;">Total Weight:</td>
        <td style="padding:2px 0;text-align:right;font-size:14px;font-weight:900;">{total_weight}</td>
      </tr>
    </table>
  </div>
  <div style="margin-top:8px;padding:8px 14px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;font-size:10px;color:#6b7280;">
    Verify all items before sealing. Report discrepancies to <strong>{company_email}</strong>.
  </div>
</div>
${FOOTER_SECTION}
${WRAP_END}`,

delivery_note: `${WRAP_START}
${COMPACT_HDR('Delivery Note', '{order_number}', 'VAT: {company_vat}')}
${META_ROW([
    { label: 'Dispatch Date', value: '{dispatch_date}' },
    { label: 'Carrier', value: '{carrier_name}' },
    { label: 'Tracking No.', value: '{tracking_number}' },
])}
${BILL_SHIP(
    'Shipped From',
    `<div style="font-size:10px;color:#6b7280;line-height:1.7;">{company_name}<br>{company_address}</div>`,
    'Delivered To',
    `<div style="font-size:12px;font-weight:700;color:#1a2b3c;margin-bottom:3px;">{customer_name}</div>
      <div style="font-size:10px;color:#6b7280;line-height:1.7;">{customer_company}<br>{shipping_address}<br>{customer_phone}</div>`
)}
${ITEMS_SECTION}
<div style="margin:0 36px 16px;padding:10px 14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;font-size:10px;color:#1d4ed8;">
  Please inspect all items upon receipt. Any damage or shortages must be reported to <strong>{company_email}</strong> within 48 hours.
</div>
${FOOTER_SECTION}
${WRAP_END}`,

return_rma: `${WRAP_START}
${COMPACT_HDR('Return Authorization', 'RMA {rma_number}', 'VAT: {company_vat}')}
<div style="background:#fffbeb;border-bottom:2px solid #f59e0b;padding:8px 36px;font-size:10px;color:#92400e;">
  <strong>Return Reason:</strong> {return_reason}
</div>
${META_ROW([
    { label: 'RMA Number', value: '{rma_number}' },
    { label: 'Original Order', value: '{order_number}' },
    { label: 'Date', value: '{order_date}' },
])}
${BILL_SHIP(
    'Customer',
    `<div style="font-size:12px;font-weight:700;color:#1a2b3c;margin-bottom:3px;">{customer_name}</div>
      <div style="font-size:10px;color:#6b7280;line-height:1.7;">{customer_company}<br>{billing_address}<br>{customer_email}<br>{customer_phone}</div>`,
    'Return Address',
    `<div style="font-size:12px;font-weight:700;color:#1a2b3c;margin-bottom:3px;">{company_name}</div>
      <div style="font-size:10px;color:#6b7280;line-height:1.7;margin-bottom:6px;">{company_address}</div>
      <div style="font-size:10px;font-weight:700;color:#f59e0b;">Mark package: RMA {rma_number}</div>`
)}
${ITEMS_SECTION}
<div style="margin:0 36px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
  <div style="padding:8px 14px;border-bottom:1px solid #e5e7eb;">
    <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#9ca3af;">Return Instructions</span>
  </div>
  <div style="padding:10px 14px;font-size:10px;color:#6b7280;line-height:1.8;">
    1. Pack all items securely in original packaging if possible.<br>
    2. Include this Return Authorization document inside the package.<br>
    3. Write <strong>RMA {rma_number}</strong> clearly on the outside of the package.<br>
    4. Ship to the return address above. Return shipping costs are borne by the customer unless otherwise agreed.<br>
    5. Send the tracking number to <strong>{company_email}</strong> once shipped.
  </div>
</div>
${FOOTER_SECTION}
${WRAP_END}`,

invoice: `${WRAP_START}
${NAVY_HDR('Invoice', '{invoice_number}')}
${META_ROW([
    { label: 'Date', value: '{invoice_date}' },
    { label: 'Due Date', value: '{due_date}', highlight: true },
    { label: 'Order Ref.', value: '{order_number}' },
    { label: 'Place of Issue', value: '{place_of_issue}' },
])}
${BILL_SHIP('Bill To', CUSTOMER_BLOCK,
    'Ship To',
    `<div style="font-size:10px;color:#6b7280;line-height:1.7;margin-bottom:8px;">{shipping_address}</div>
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;margin-bottom:2px;">Payment Method</div>
      <div style="font-size:10px;font-weight:600;color:#1a2b3c;margin-bottom:6px;">{payment_method}</div>
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#9ca3af;margin-bottom:2px;">Dispatch</div>
      <div style="font-size:10px;color:#6b7280;">{dispatch_date}</div>`
)}
${ITEMS_SECTION}
${TOTALS_SECTION}
<!-- PAYMENT_SUMMARY -->
${BANK_SECTION}
${FOOTER_SECTION}
${WRAP_END}`,

proforma_invoice: `${WRAP_START}
${COMPACT_HDR('{proforma_title}', '{invoice_number}', 'VAT: {company_vat}<br>{company_email}')}
<div style="background:#fffbeb;border-bottom:2px solid #f59e0b;padding:8px 36px;font-size:10px;color:#92400e;">
  <strong>{proforma_note_label}</strong> {proforma_note_text}
</div>
${META_ROW([
    { label: 'Date', value: '{invoice_date}' },
    { label: 'Valid Until', value: '{due_date}', highlight: true },
    { label: 'Order Ref.', value: '{order_number}' },
    { label: 'Payment Method', value: '{payment_method}' },
])}
${BILL_SHIP('Bill To', CUSTOMER_BLOCK, 'Ship To', `<div style="font-size:10px;color:#6b7280;line-height:1.7;">{shipping_address}</div>`)}
${ITEMS_SECTION}
${TOTALS_SECTION}
${BANK_SECTION}
${FOOTER_SECTION}
${WRAP_END}`,

}
