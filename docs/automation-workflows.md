# TIGO ENERGY EU - COMPLETE AUTOMATION WORKFLOWS

## Overview
This document describes every automated workflow in the system. Goal: Zero manual intervention from order to delivery.

---

## 1. CHECKOUT FLOW (Customer Experience)

### Step 1: VAT Number Entry (B2B)
```
Customer enters VAT ID (e.g., DE123456789)
↓
Real-time VIES API validation
↓
IF VALID:
  ├── Auto-fill company name
  ├── Auto-fill company address
  ├── Set VAT rate = 0% (reverse charge)
  └── Display: "VAT reverse charge applies"
ELSE:
  └── Treat as B2C (apply local VAT)
```

**Implementation:**
- VIES API: `https://ec.europa.eu/taxation_customs/vies/rest-api/`
- EU Business Registry APIs for company data
- Real-time validation (not on form submit, but on field blur)

### Step 2: Shipping Calculation
```
Customer enters shipping address
↓
Calculate total weight from cart items
↓
Query shipping_rates table (country + weight)
↓
OR: GLS API real-time rate request
↓
Display shipping cost + estimated delivery
```

### Step 3: Payment
```
Customer chooses payment method:
├── Wise (primary)
├── Stripe (backup)
└── Bank Transfer (manual, for large B2B orders)

Redirect to payment gateway
↓
Payment completed
↓
WEBHOOK triggers Order Processing workflow
```

---

## 2. ORDER PROCESSING WORKFLOW (Fully Automated)

**Trigger:** Wise/Stripe webhook receives "payment.succeeded"

### Webhook Handler (Next.js API route: `/api/webhooks/payment`)

```javascript
POST /api/webhooks/payment
├── Verify webhook signature (security)
├── Extract payment_intent_id
├── Find order in database
├── IF order.payment_status === 'unpaid':
│   ├── Update order:
│   │   ├── status = 'paid'
│   │   ├── payment_status = 'paid'
│   │   ├── paid_at = NOW()
│   │   └── fulfillment_status = 'processing'
│   ├── Reserve inventory (update reserved_quantity)
│   └── TRIGGER: Fulfillment Workflow
└── Return 200 OK (acknowledge webhook)
```

---

## 3. FULFILLMENT WORKFLOW (The Magic)

**Trigger:** Order status changes to 'paid'

### Automatic Actions (Parallel Processing):

#### 3.1 Generate Invoice PDF
```javascript
async function generateInvoice(orderId) {
  // Fetch order + items + customer
  const order = await getOrderDetails(orderId);
  
  // Generate invoice number: SI-INV-2026-00001
  const invoiceNumber = await getNextInvoiceNumber(order.market);
  
  // Create invoice record in database
  const invoice = await db.invoices.create({
    invoice_number: invoiceNumber,
    order_id: orderId,
    invoice_date: new Date(),
    due_date: new Date(), // Immediate for pre-paid orders
    // ... all order details
  });
  
  // Generate PDF using @react-pdf/renderer
  const pdfBuffer = await InvoicePDF.generate({
    invoice,
    order,
    company: COMPANY_INFO,
    language: order.language
  });
  
  // Upload to Supabase Storage
  const pdfUrl = await supabase.storage
    .from('invoices')
    .upload(`${invoiceNumber}.pdf`, pdfBuffer);
  
  // Update invoice record with PDF URL
  await db.invoices.update(invoice.id, { pdf_url: pdfUrl });
  
  // Update order with invoice info
  await db.orders.update(orderId, {
    invoice_number: invoiceNumber,
    invoice_url: pdfUrl,
    invoice_created_at: new Date()
  });
  
  return { invoice, pdfUrl };
}
```

**Invoice Template (Multi-language):**
- Company header (Initra Energija d.o.o.)
- "Invoice" / "Rechnung" / "Faktura" (based on order.language)
- Invoice number, date, due date
- Customer details
- Line items (product, quantity, unit price, total)
- Subtotal, VAT (or "Reverse Charge" for B2B), Total
- Payment terms
- Bank details
- Footer: Company registration, VAT ID, etc.

#### 3.2 Generate Packing Slip PDF
```javascript
async function generatePackingSlip(orderId) {
  const order = await getOrderDetails(orderId);
  
  const pdfBuffer = await PackingSlipPDF.generate({
    order_number: order.order_number,
    items: order.items,
    shipping_address: order.shipping_address,
    notes: order.customer_notes
  });
  
  const pdfUrl = await supabase.storage
    .from('packing-slips')
    .upload(`${order.order_number}-packing.pdf`, pdfBuffer);
  
  await db.orders.update(orderId, {
    packing_slip_url: pdfUrl
  });
  
  return pdfUrl;
}
```

**Packing Slip Template:**
- Order number (large, bold)
- Shipping address (large text for easy reading)
- Line items:
  - SKU
  - Product name
  - Quantity
  - ☐ Checkbox (for warehouse to check off)
- Total items count
- Special instructions (if any)

#### 3.3 Generate Shipping Label (GLS API)
```javascript
async function generateShippingLabel(orderId) {
  const order = await getOrderDetails(orderId);
  
  // Call GLS API to create shipment
  const glsResponse = await fetch('https://api.gls-group.eu/shipments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GLS_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      shipper: {
        name: 'Initra Energija d.o.o.',
        address: WAREHOUSE_ADDRESS,
        country: 'SI'
      },
      consignee: {
        name: order.shipping_address.name,
        address: order.shipping_address.street,
        city: order.shipping_address.city,
        postal_code: order.shipping_address.postal_code,
        country: order.shipping_address.country,
        phone: order.customer_phone,
        email: order.customer_email
      },
      parcels: [{
        weight: order.total_weight_kg,
        reference: order.order_number
      }],
      service: 'PARCEL' // Standard service
    })
  });
  
  const { tracking_number, label_pdf_url } = glsResponse;
  
  // Download label PDF and store in Supabase
  const labelPdf = await fetch(label_pdf_url).then(r => r.arrayBuffer());
  const storageUrl = await supabase.storage
    .from('shipping-labels')
    .upload(`${order.order_number}-label.pdf`, labelPdf);
  
  // Update order with tracking info
  await db.orders.update(orderId, {
    tracking_number,
    tracking_url: `https://gls-group.eu/track/${tracking_number}`,
    shipping_label_url: storageUrl,
    shipping_label_created_at: new Date()
  });
  
  return { tracking_number, label_url: storageUrl };
}
```

#### 3.4 Update Inventory (Stock Out)
```javascript
async function updateInventory(orderId) {
  const order = await getOrderDetails(orderId);
  
  for (const item of order.items) {
    // Create inventory movement record
    await db.inventory_movements.create({
      product_id: item.product_id,
      sku: item.sku,
      movement_type: 'out',
      quantity: -item.quantity, // Negative = stock out
      reference_type: 'sale',
      reference_id: orderId,
      cost_per_unit: item.unit_cost,
      stock_after: await getStockAfterMovement(item.product_id, -item.quantity)
    });
    
    // Trigger automatic function to update products.stock_quantity
    // (This happens via database trigger)
    
    // Check if low stock alert needed
    const product = await db.products.findOne(item.product_id);
    if (product.stock_quantity < product.low_stock_threshold) {
      await sendLowStockAlert(product);
    }
  }
}
```

#### 3.5 Send Warehouse Email
```javascript
async function sendWarehouseEmail(orderId) {
  const order = await getOrderDetails(orderId);
  
  await resend.emails.send({
    from: 'Tigo Orders <orders@tigoenergy.si>',
    to: 'warehouse@adriapower.si', // Your warehouse email
    subject: `🚨 NEW ORDER: ${order.order_number} - ${order.market.toUpperCase()} - ${order.items.length} items`,
    html: `
      <h2>New Order Ready to Ship</h2>
      <p><strong>Order:</strong> ${order.order_number}</p>
      <p><strong>Customer:</strong> ${order.shipping_address.name} (${order.shipping_address.country})</p>
      <p><strong>Items:</strong></p>
      <ul>
        ${order.items.map(item => `
          <li>${item.quantity}x ${item.product_name} (${item.sku})</li>
        `).join('')}
      </ul>
      <p><strong>Total Weight:</strong> ${order.total_weight_kg} kg</p>
      <p><strong>Tracking:</strong> ${order.tracking_number}</p>
      
      <h3>📎 Documents Attached:</h3>
      <ul>
        <li>Packing Slip (what to pack)</li>
        <li>Shipping Label (stick on box)</li>
        <li>Invoice (for customer)</li>
      </ul>
      
      <p style="margin-top: 20px;">
        <a href="${ADMIN_URL}/orders/${order.id}/mark-shipped" 
           style="background: green; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">
          ✅ Mark as Shipped
        </a>
      </p>
    `,
    attachments: [
      {
        filename: `${order.order_number}-packing-slip.pdf`,
        content: await getFileBuffer(order.packing_slip_url)
      },
      {
        filename: `${order.order_number}-label.pdf`,
        content: await getFileBuffer(order.shipping_label_url)
      },
      {
        filename: `${order.invoice_number}.pdf`,
        content: await getFileBuffer(order.invoice_url)
      }
    ]
  });
}
```

#### 3.6 Send Customer Confirmation Email
```javascript
async function sendCustomerConfirmation(orderId) {
  const order = await getOrderDetails(orderId);
  const translations = getTranslations(order.language);
  
  await resend.emails.send({
    from: 'Tigo Energy <orders@tigoenergy.si>',
    to: order.customer_email,
    subject: translations.orderConfirmation.subject,
    html: CustomerConfirmationTemplate({
      order,
      translations,
      tracking_url: order.tracking_url
    }),
    attachments: [
      {
        filename: `${order.invoice_number}.pdf`,
        content: await getFileBuffer(order.invoice_url)
      }
    ]
  });
}
```

**Email Content (Multi-language):**
- Order confirmation
- Order number
- Thank you message
- Order summary (items, prices)
- Shipping info
- Tracking link (when available)
- Invoice attached
- Support contact

---

### Main Fulfillment Function (Orchestrates Everything)

```javascript
async function fulfillOrder(orderId) {
  console.log(`[Fulfillment] Starting for order ${orderId}`);
  
  try {
    // Run all tasks in parallel (faster)
    const [invoice, packingSlip, shippingLabel] = await Promise.all([
      generateInvoice(orderId),
      generatePackingSlip(orderId),
      generateShippingLabel(orderId)
    ]);
    
    console.log(`[Fulfillment] Documents generated`);
    
    // Update inventory (sequential to avoid race conditions)
    await updateInventory(orderId);
    console.log(`[Fulfillment] Inventory updated`);
    
    // Send emails (parallel)
    await Promise.all([
      sendWarehouseEmail(orderId),
      sendCustomerConfirmation(orderId)
    ]);
    
    console.log(`[Fulfillment] Emails sent`);
    
    // Update order status
    await db.orders.update(orderId, {
      fulfillment_status: 'fulfilled',
      status: 'processing' // Waiting for warehouse to ship
    });
    
    // Log audit trail
    await db.audit_log.create({
      action: 'order_fulfilled',
      entity_type: 'order',
      entity_id: orderId,
      metadata: { invoice_number: invoice.invoice_number, tracking_number: shippingLabel.tracking_number }
    });
    
    console.log(`[Fulfillment] Order ${orderId} fully processed`);
    
  } catch (error) {
    console.error(`[Fulfillment] Error for order ${orderId}:`, error);
    
    // Alert admin
    await sendAdminAlert({
      type: 'fulfillment_error',
      order_id: orderId,
      error: error.message
    });
    
    // Update order with error flag
    await db.orders.update(orderId, {
      internal_notes: `Fulfillment error: ${error.message}`
    });
  }
}
```

---

## 4. WAREHOUSE SHIPPING WORKFLOW

**Trigger:** Warehouse worker clicks "Mark as Shipped" button (in email or admin)

### Endpoint: `POST /api/orders/:id/mark-shipped`

```javascript
async function markAsShipped(orderId, shippedBy) {
  // Update order status
  await db.orders.update(orderId, {
    status: 'shipped',
    fulfillment_status: 'fulfilled',
    shipped_at: new Date()
  });
  
  // Update warehouse task
  await db.warehouse_tasks.update({ order_id: orderId }, {
    status: 'completed',
    completed_at: new Date(),
    completed_by: shippedBy
  });
  
  // Send tracking email to customer
  await sendTrackingEmail(orderId);
  
  // Log audit
  await db.audit_log.create({
    action: 'order_shipped',
    entity_type: 'order',
    entity_id: orderId,
    user_id: shippedBy
  });
}
```

### Tracking Email to Customer

```javascript
async function sendTrackingEmail(orderId) {
  const order = await getOrderDetails(orderId);
  const translations = getTranslations(order.language);
  
  await resend.emails.send({
    from: 'Tigo Energy <orders@tigoenergy.si>',
    to: order.customer_email,
    subject: translations.shipping.subject,
    html: TrackingEmailTemplate({
      order,
      translations,
      tracking_url: order.tracking_url,
      estimated_delivery: order.estimated_delivery
    })
  });
}
```

---

## 5. DELIVERY TRACKING (Optional Enhancement)

**If GLS provides webhook for delivery status:**

### Webhook: `POST /api/webhooks/gls-tracking`

```javascript
async function handleTrackingUpdate(tracking_number, status) {
  const order = await db.orders.findOne({ tracking_number });
  
  if (!order) return;
  
  switch (status) {
    case 'in_transit':
      // Update order status
      await db.orders.update(order.id, { status: 'shipped' });
      break;
      
    case 'out_for_delivery':
      // Send "Arriving today" email
      await sendDeliveryNotification(order.id);
      break;
      
    case 'delivered':
      // Update order status
      await db.orders.update(order.id, {
        status: 'delivered',
        delivered_at: new Date()
      });
      
      // Send "Thanks for your order" email (optional)
      await sendPostDeliveryEmail(order.id);
      break;
      
    case 'delivery_failed':
      // Alert customer and admin
      await sendDeliveryFailureAlert(order.id);
      break;
  }
}
```

---

## 6. INTRASTAT REPORTING (Monthly Automation)

**Trigger:** Cron job runs on 1st of each month at 9:00 AM

### Cron Job (Vercel Cron or Supabase Edge Function)

```javascript
// Route: /api/cron/generate-intrastat
// Schedule: 0 9 1 * * (1st of month, 9 AM)

async function generateIntrastatReport() {
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const year = lastMonth.getFullYear();
  const month = lastMonth.getMonth() + 1;
  
  console.log(`[Intrastat] Generating report for ${year}-${month}`);
  
  // Query all shipped B2B orders from last month to other EU countries
  const orders = await db.orders.findMany({
    where: {
      is_b2b: true,
      shipped_at: {
        gte: new Date(year, month - 1, 1),
        lt: new Date(year, month, 1)
      },
      shipping_address: {
        country: { not: 'SI' } // Exclude Slovenia (domestic)
      }
    },
    include: { items: true }
  });
  
  console.log(`[Intrastat] Found ${orders.length} eligible orders`);
  
  // Group by country and CN code
  const aggregated = {};
  
  for (const order of orders) {
    const country = order.shipping_address.country;
    
    for (const item of order.items) {
      const key = `${country}-${item.cn_code}`;
      
      if (!aggregated[key]) {
        aggregated[key] = {
          destination_country: country,
          cn_code: item.cn_code,
          total_value_eur: 0,
          total_weight_kg: 0,
          transaction_count: 0,
          order_ids: []
        };
      }
      
      aggregated[key].total_value_eur += item.total_price;
      aggregated[key].total_weight_kg += item.weight_kg * item.quantity;
      aggregated[key].transaction_count += 1;
      aggregated[key].order_ids.push(order.id);
    }
  }
  
  // Insert into intrastat_reports table
  for (const report of Object.values(aggregated)) {
    await db.intrastat_reports.create({
      year,
      month,
      ...report
    });
  }
  
  // Mark orders as reported
  await db.orders.updateMany(
    { id: { in: orders.map(o => o.id) } },
    { intrastat_reported: true, intrastat_report_date: new Date() }
  );
  
  // Generate CSV export for Slovenian customs
  const csv = generateIntrastatCSV(year, month);
  
  // Email report to admin
  await resend.emails.send({
    from: 'Tigo System <system@tigoenergy.si>',
    to: 'dejan@adriapower.si',
    subject: `📊 Intrastat Report - ${year}-${month}`,
    html: `
      <h2>Intrastat Report Generated</h2>
      <p>Period: ${year}-${String(month).padStart(2, '0')}</p>
      <p>Orders processed: ${orders.length}</p>
      <p>Total export value: €${Object.values(aggregated).reduce((sum, r) => sum + r.total_value_eur, 0).toFixed(2)}</p>
      <p>Report attached. Please review and submit to Slovenian customs.</p>
    `,
    attachments: [
      {
        filename: `intrastat-${year}-${month}.csv`,
        content: csv
      }
    ]
  });
  
  console.log(`[Intrastat] Report generated and emailed`);
}
```

### Intrastat CSV Format (for Slovenian customs)

```
"Reference Period","Flow","CN Code","Country","Nature of Transaction","Mode of Transport","Net Mass (kg)","Invoiced Amount (EUR)"
"202601","D","85414090","DE","11","3","125.50","4500.00"
"202601","D","85414090","FR","11","3","89.20","3200.00"
...
```

Where:
- **D** = Dispatches (exports from Slovenia)
- **11** = Outright purchase/sale
- **3** = Road transport

---

## 7. STOCK MANAGEMENT WORKFLOWS

### Low Stock Alert (Automatic)

**Trigger:** Product stock falls below threshold

```javascript
async function checkLowStock(productId) {
  const product = await db.products.findOne(productId);
  
  if (product.stock_quantity < product.low_stock_threshold) {
    await resend.emails.send({
      from: 'Tigo Inventory <inventory@tigoenergy.si>',
      to: 'dejan@adriapower.si',
      subject: `⚠️ LOW STOCK ALERT: ${product.name_en}`,
      html: `
        <h2>Low Stock Alert</h2>
        <p><strong>Product:</strong> ${product.name_en}</p>
        <p><strong>SKU:</strong> ${product.sku}</p>
        <p><strong>Current Stock:</strong> ${product.stock_quantity} units</p>
        <p><strong>Threshold:</strong> ${product.low_stock_threshold} units</p>
        <p><strong>Reserved:</strong> ${product.reserved_quantity} units (in unpaid orders)</p>
        <p style="margin-top: 20px;">
          <a href="${ADMIN_URL}/products/${product.id}">View Product →</a>
        </p>
      `
    });
  }
}
```

### Stock In (Manual Entry)

**Admin Interface:** "Receive Shipment" form

```javascript
async function receiveShipment(shipmentData) {
  const { products, supplier, reference_number, received_date } = shipmentData;
  
  for (const item of products) {
    // Create inventory movement
    await db.inventory_movements.create({
      product_id: item.product_id,
      sku: item.sku,
      movement_type: 'in',
      quantity: item.quantity, // Positive
      reference_type: 'purchase',
      reference_id: reference_number,
      cost_per_unit: item.cost,
      notes: `Received from ${supplier}`
    });
    
    // Stock automatically updated via database trigger
  }
  
  // Send confirmation email
  await resend.emails.send({
    from: 'Tigo Inventory <inventory@tigoenergy.si>',
    to: 'dejan@adriapower.si',
    subject: `✅ Shipment Received: ${reference_number}`,
    html: `
      <h2>Shipment Received</h2>
      <p><strong>Reference:</strong> ${reference_number}</p>
      <p><strong>Supplier:</strong> ${supplier}</p>
      <p><strong>Date:</strong> ${received_date}</p>
      <p><strong>Items:</strong></p>
      <ul>
        ${products.map(p => `<li>${p.quantity}x ${p.sku}</li>`).join('')}
      </ul>
    `
  });
}
```

---

## 8. ADMIN DASHBOARD VIEWS

### Orders Dashboard
- Filter by: status, market, date range
- Columns: Order #, Customer, Country, Total, Status, Actions
- Actions: View, Mark Shipped, Cancel, Refund
- Bulk actions: Export CSV, Print packing slips

### Inventory Dashboard
- Real-time stock levels
- Low stock warnings (red badge)
- Stock movements history
- Add stock (receive shipment)
- Adjust stock (corrections)

### Reports
- Sales by country (chart + table)
- Best-selling products
- Revenue trends (monthly)
- Intrastat reports (downloadable)
- VAT collected by country (for OSS)

---

## 9. ERROR HANDLING & MONITORING

### Failed Webhook Handling
- Retry logic (3 attempts with exponential backoff)
- Dead letter queue for failed webhooks
- Admin alert email after 3 failures

### Payment Issues
- If webhook not received within 10 minutes: check payment status via API
- If payment failed: send recovery email to customer
- If payment pending: send reminder after 24 hours

### Shipping Label Failures
- Fallback: manual label generation
- Admin alert with order details
- Order marked for manual processing

### Email Delivery Failures
- Track email status via Resend webhooks
- Retry failed emails
- Log all email events in audit_log

---

## 10. SUMMARY: WHAT'S AUTOMATED

✅ **VAT validation & company data auto-fill**
✅ **Shipping cost calculation**
✅ **Payment detection (webhooks)**
✅ **Invoice generation (PDF)**
✅ **Packing slip generation (PDF)**
✅ **Shipping label generation (GLS API)**
✅ **Inventory updates (stock out)**
✅ **Low stock alerts**
✅ **Warehouse email with all documents**
✅ **Customer confirmation email**
✅ **Tracking email when shipped**
✅ **Intrastat monthly reports**
✅ **Order status updates**
✅ **Audit logging**

## WHAT REQUIRES 1 MANUAL ACTION

⚡ **Warehouse worker clicks "Mark as Shipped"** (or scans barcode)
  - Everything else is automatic

---

## 11. TIMELINE TO BUILD THIS

**Week 1-2: Core Platform**
- Next.js setup
- Supabase database
- Product catalog
- Shopping cart
- Basic checkout

**Week 3-4: Automation Layer**
- Payment webhooks
- PDF generation (invoice, packing slip)
- Email system
- Inventory tracking

**Week 5-6: Shipping & Advanced**
- GLS API integration
- Admin dashboard
- Intrastat reporting
- Testing & launch

**Total: 6 weeks** to fully automated system

---

## 12. ONGOING OPERATIONS (ZERO MANUAL WORK)

**Daily:**
- Orders process automatically
- Warehouse ships based on emails
- Customers get tracking info

**Weekly:**
- Review low stock alerts
- Receive new inventory shipments (manual entry)

**Monthly:**
- Review Intrastat report (1 click submit to customs)
- Check sales reports

**That's it. System runs itself.**
