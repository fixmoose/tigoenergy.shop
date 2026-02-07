# TIGO ENERGY EU - FINAL TECHNICAL SPECIFICATION
## Multi-Domain E-Commerce Platform with Full Automation

---

## EXECUTIVE SUMMARY

Building a production-grade, fully automated e-commerce platform for Tigo Energy products across 21+ EU markets. Zero manual operations except warehouse "Mark as Shipped" button.

**Timeline:** 6 weeks to launch
**First Market:** tigoenergy.si (Slovenia, B2B only)
**Scale Target:** All 21+ domains within 3 months

---

## 1. FRONTEND TEMPLATE DECISION

### Chosen: **Relivator Next.js Template** (Modified)

**Why Relivator:**
- ✅ Modern, professional design (https://relivator.com)
- ✅ Already built with Next.js 15 + React 19
- ✅ Uses shadcn/ui + Tailwind (exactly what we want)
- ✅ Built for e-commerce specifically
- ✅ Clean, minimal aesthetic (perfect for B2B)
- ✅ Responsive, mobile-optimized
- ✅ Open source, fully customizable

**What we'll keep:**
- Product catalog layouts
- Cart UI
- Checkout flow UI
- General page layouts

**What we'll replace/customize:**
- Backend (use Supabase instead of their DB)
- Auth (use Supabase Auth)
- Payment (Wise + Stripe instead of Polar)
- Add our automation layer
- Add our shipping integrations (DPD + GLS)
- Add our admin dashboard
- Multi-language with next-intl
- Multi-domain routing

**License:** MIT (free, commercial use allowed)

---

## 2. SHIPPING OPTIONS

### Three Options: GLS + DPD + Local Pickup

**Customer Experience:**
```
At checkout:
├── Calculate shipping options based on country:
│
├── IF country = Slovenia:
│   ├── Local Pickup - FREE (Slovenia only)
│   ├── GLS Standard - €X.XX (2-3 days)
│   └── DPD Express - €X.XX (1-2 days)
│
└── IF country ≠ Slovenia:
    ├── GLS Standard - €XX.XX (3-5 days)
    └── DPD Express - €XX.XX (2-3 days)
```

### Local Pickup (Slovenia Only)

**Pickup Location:**
```
Initra Energija d.o.o.
Podsmreka 59A
1356 Dobrova
Slovenia
```

**How It Works:**
1. Customer selects "Local Pickup" at checkout (only shown for SI addresses)
2. Order processes normally (payment, invoice, inventory)
3. Instead of shipping label → generate "Ready for Pickup" notification
4. Send notification to customer (email + SMS + optional phone call)
5. Customer picks up from warehouse
6. Warehouse marks as "Picked Up" (instead of "Shipped")

### API Integrations Required

#### GLS API
```
Endpoints:
- POST /shipments - Create shipment, get label
- GET /shipments/{id}/track - Track shipment
- POST /shipments/rates - Get shipping rates

Response:
{
  "tracking_number": "ABC123456789",
  "label_pdf_url": "https://...",
  "estimated_delivery": "2026-02-05"
}
```

#### DPD API  
```
Endpoints:
- POST /parcels - Create parcel, get label
- GET /parcels/{id} - Track parcel
- POST /parcels/quote - Get shipping quote

Response:
{
  "parcel_id": "1234567890",
  "label_url": "https://...",
  "tracking_number": "DPD987654321"
}
```

### Database Schema Addition

```sql
-- Add to orders table
ALTER TABLE orders ADD COLUMN shipping_carrier TEXT; -- 'GLS', 'DPD', or 'LOCAL_PICKUP'
ALTER TABLE orders ADD COLUMN shipping_carrier_parcel_id TEXT;
ALTER TABLE orders ADD COLUMN pickup_notified_at TIMESTAMPTZ; -- For local pickup
ALTER TABLE orders ADD COLUMN pickup_notification_method TEXT; -- 'email', 'sms', 'phone'
ALTER TABLE orders ADD COLUMN picked_up_at TIMESTAMPTZ; -- When customer collected

-- Shipping rate quotes (cached for 1 hour)
CREATE TABLE shipping_quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country_code TEXT NOT NULL,
  weight_kg DECIMAL(6,2) NOT NULL,
  carrier TEXT NOT NULL, -- 'GLS', 'DPD', or 'LOCAL_PICKUP'
  rate_eur DECIMAL(10,2) NOT NULL,
  service_type TEXT,
  estimated_days INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_shipping_quotes_lookup ON shipping_quotes(country_code, weight_kg, carrier, created_at);
```

### Local Pickup Workflow

```javascript
// 1. Show pickup option only for Slovenia
async function getShippingOptions(address, cartWeight) {
  const country = address.country;
  const weight = cartWeight;
  
  const options = [];
  
  // Local pickup only for Slovenia
  if (country === 'SI') {
    options.push({
      carrier: 'LOCAL_PICKUP',
      service: 'Local Pickup',
      price: 0,
      days: 'Same day',
      description: 'Pick up from Podsmreka 59A, 1356 Dobrova',
      recommended: true // Free is always recommended
    });
  }
  
  // Always show carrier options
  const [glsQuote, dpdQuote] = await Promise.all([
    fetchGLSQuote(country, weight),
    fetchDPDQuote(country, weight)
  ]);
  
  options.push({
    carrier: 'GLS',
    service: 'Standard',
    price: glsQuote.rate,
    days: country === 'SI' ? '2-3' : '3-5'
  });
  
  options.push({
    carrier: 'DPD',
    service: 'Express', 
    price: dpdQuote.rate,
    days: country === 'SI' ? '1-2' : '2-3'
  });
  
  return { options };
}

// 2. Handle local pickup fulfillment
async function fulfillLocalPickupOrder(orderId) {
  const order = await getOrderDetails(orderId);
  
  // Generate invoice (same as shipped orders)
  await generateInvoice(orderId);
  
  // Generate pickup slip (instead of packing slip)
  await generatePickupSlip(orderId);
  
  // NO shipping label needed
  
  // Update inventory
  await updateInventory(orderId);
  
  // Send notification to customer
  await sendPickupReadyNotification(order);
  
  // Send warehouse email
  await sendWarehousePickupEmail(order);
  
  // Update order status
  await db.orders.update(orderId, {
    status: 'ready_for_pickup',
    fulfillment_status: 'fulfilled'
  });
}

// 3. Customer notification (multi-channel)
async function sendPickupReadyNotification(order) {
  const message = `
    Pozdravljeni ${order.customer_name},
    
    Vaše naročilo ${order.order_number} je pripravljeno za prevzem.
    
    Lokacija:
    Initra Energija d.o.o.
    Podsmreka 59A
    1356 Dobrova
    
    Delovni čas: Pon-Pet 8:00-16:00
    
    Prosimo prinesite osebni dokument in ta email.
    
    Lep pozdrav,
    Tigo Energy
  `;
  
  // Email notification
  await resend.emails.send({
    from: 'Tigo Energy <orders@tigoenergy.si>',
    to: order.customer_email,
    subject: 'Naročilo pripravljeno za prevzem / Order Ready for Pickup',
    html: PickupReadyEmailTemplate({
      order,
      pickupAddress: {
        name: 'Initra Energija d.o.o.',
        street: 'Podsmreka 59A',
        city: 'Dobrova',
        postal: '1356',
        hours: 'Pon-Pet 8:00-16:00'
      }
    })
  });
  
  // SMS notification (optional - if phone provided)
  if (order.customer_phone) {
    await sendSMS({
      to: order.customer_phone,
      message: `Tigo Energy: Naročilo ${order.order_number} pripravljeno za prevzem. Podsmreka 59A, Dobrova.`
    });
  }
  
  // Update notification log
  await db.orders.update(order.id, {
    pickup_notified_at: new Date(),
    pickup_notification_method: order.customer_phone ? 'email+sms' : 'email'
  });
}

// 4. Warehouse marks as picked up
async function markAsPickedUp(orderId, pickedUpBy) {
  await db.orders.update(orderId, {
    status: 'delivered', // Same as delivered for shipped orders
    fulfillment_status: 'fulfilled',
    picked_up_at: new Date()
  });
  
  // Send thank you email
  await sendPickupThankYouEmail(orderId);
  
  // Log audit
  await db.audit_log.create({
    action: 'order_picked_up',
    entity_type: 'order',
    entity_id: orderId,
    user_id: pickedUpBy
  });
}
```

### Pickup Slip Template (PDF)

Similar to packing slip but says "PREVZEM / PICKUP":
- Order number (large)
- Customer name + company
- Items list with checkboxes
- "Za prevzem pripravljeno" / "Ready for pickup"
- Customer must bring: ID + this slip (or order number)

### Shipping Flow

```javascript
// 1. Customer enters address at checkout
async function calculateShipping(address, cartWeight) {
  const country = address.country;
  const weight = cartWeight;
  
  // Check cache first (avoid excessive API calls)
  const cached = await getShippingQuotes(country, weight);
  if (cached) return cached;
  
  // Fetch from both APIs in parallel
  const [glsQuote, dpdQuote] = await Promise.all([
    fetchGLSQuote(country, weight),
    fetchDPDQuote(country, weight)
  ]);
  
  // Cache results
  await cacheShippingQuotes(country, weight, [glsQuote, dpdQuote]);
  
  return {
    options: [
      {
        carrier: 'GLS',
        service: 'Standard',
        price: glsQuote.rate,
        days: '3-5',
        recommended: glsQuote.rate < dpdQuote.rate
      },
      {
        carrier: 'DPD',
        service: 'Express',
        price: dpdQuote.rate,
        days: '2-3',
        recommended: dpdQuote.rate < glsQuote.rate
      }
    ]
  };
}

// 2. Generate label based on selected carrier
async function generateShippingLabel(orderId) {
  const order = await getOrder(orderId);
  
  if (order.shipping_carrier === 'GLS') {
    return await generateGLSLabel(order);
  } else {
    return await generateDPDLabel(order);
  }
}
```

### Carrier Selection Strategy

**Default recommendation logic:**
- Show cheaper option as "Recommended"
- If price difference <€2, recommend faster carrier
- Highlight if one has better coverage for destination country

---

## 3. INTRASTAT XML REPORTING

### Requirements

**Two Separate XML Reports:**
1. **Arrivals (Prihodi)** - Goods you receive from suppliers
2. **Dispatches (Odpošlje)** - Goods you sell to customers

**Format:** XML (Slovenian customs eDavki format)
**Frequency:** Monthly
**Due Date:** 15th of following month

### Arrivals Tracking

Need to track incoming shipments from Tigo:

```sql
-- New table for purchase orders/arrivals
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_number TEXT UNIQUE NOT NULL,
  supplier TEXT NOT NULL, -- 'Tigo Energy Inc.'
  supplier_country TEXT DEFAULT 'US',
  
  -- Shipment details
  shipment_date DATE,
  arrival_date DATE,
  
  -- Value
  total_value_eur DECIMAL(12,2) NOT NULL,
  total_weight_kg DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  
  -- Intrastat
  intrastat_reported BOOLEAN DEFAULT false,
  intrastat_report_date DATE,
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, received, cancelled
  
  -- Notes
  invoice_number TEXT,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  
  sku TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL,
  total_cost DECIMAL(10,2) NOT NULL,
  
  -- For Intrastat
  cn_code TEXT NOT NULL,
  weight_kg DECIMAL(6,2) NOT NULL,
  country_of_origin TEXT DEFAULT 'US',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### XML Generation (Monthly Cron Job)

```javascript
// Runs on 1st of each month at 9:00 AM
async function generateIntrastatXML() {
  const lastMonth = getPreviousMonth();
  
  // Generate ARRIVALS XML
  const arrivals = await generateArrivalsXML(lastMonth);
  
  // Generate DISPATCHES XML  
  const dispatches = await generateDispatchesXML(lastMonth);
  
  // Email both XMLs to admin
  await emailIntrastatReports(arrivals, dispatches);
}

async function generateDispatchesXML(period) {
  // Query all B2B cross-border orders shipped last month
  const orders = await db.orders.findMany({
    where: {
      is_b2b: true,
      shipped_at: {
        gte: period.start,
        lt: period.end
      },
      shipping_address: {
        country: { not: 'SI' }
      }
    },
    include: { items: true }
  });
  
  // Aggregate by country + CN code
  const aggregated = aggregateByCountryAndCNCode(orders);
  
  // Generate XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Intrastat xmlns="http://edavki.durs.si/Documents/Schemas/Intrastat_v2_0.xsd">
  <Header>
    <TaxNumber>SI${VAT_ID}</TaxNumber>
    <Period>${period.year}${String(period.month).padStart(2, '0')}</Period>
    <FlowCode>D</FlowCode> <!-- D = Dispatches -->
  </Header>
  <Body>
    ${aggregated.map(item => `
    <Item>
      <CommodityCode>${item.cn_code}</CommodityCode>
      <DestinationCountry>${item.country}</DestinationCountry>
      <TransactionNature>11</TransactionNature> <!-- 11 = Outright sale -->
      <TransportMode>3</TransportMode> <!-- 3 = Road -->
      <NetMass>${item.total_weight_kg}</NetMass>
      <InvoicedAmount>${item.total_value_eur}</InvoicedAmount>
    </Item>
    `).join('')}
  </Body>
</Intrastat>`;
  
  return xml;
}

async function generateArrivalsXML(period) {
  // Query all purchase orders received last month
  const pos = await db.purchase_orders.findMany({
    where: {
      arrival_date: {
        gte: period.start,
        lt: period.end
      },
      supplier_country: { not: 'SI' }
    },
    include: { items: true }
  });
  
  // Aggregate by origin country + CN code
  const aggregated = aggregateByOriginAndCNCode(pos);
  
  // Generate XML (similar structure, but FlowCode=A for Arrivals)
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Intrastat xmlns="http://edavki.durs.si/Documents/Schemas/Intrastat_v2_0.xsd">
  <Header>
    <TaxNumber>SI${VAT_ID}</TaxNumber>
    <Period>${period.year}${String(period.month).padStart(2, '0')}</Period>
    <FlowCode>A</FlowCode> <!-- A = Arrivals -->
  </Header>
  <Body>
    ${aggregated.map(item => `
    <Item>
      <CommodityCode>${item.cn_code}</CommodityCode>
      <OriginCountry>${item.country}</OriginCountry>
      <TransactionNature>11</TransactionNature>
      <TransportMode>3</TransportMode>
      <NetMass>${item.total_weight_kg}</NetMass>
      <InvoicedAmount>${item.total_value_eur}</InvoicedAmount>
    </Item>
    `).join('')}
  </Body>
</Intrastat>`;
  
  return xml;
}
```

**Note:** You'll share the actual XML sample file format, and I'll adjust to match exactly.

### Admin Interface for Arrivals

```
Admin Dashboard → Inventory → Receive Shipment

Form:
- PO Number (auto-generated or manual)
- Supplier (dropdown: Tigo Energy Inc., Other)
- Arrival Date
- Items:
  - Product (select from catalog)
  - Quantity
  - Unit Cost
  - [Add Row button]
- Total Value: €XX,XXX (auto-calculated)
- Total Weight: XXX kg (auto-calculated)
- Invoice Number (optional)
- Notes (optional)

[Submit] → Creates PO, updates inventory, logs for Intrastat
```

---

## 4. AUTOMATION - MISSION CRITICAL

### Zero-Tolerance Reliability Architecture

#### Webhook Reliability

```javascript
// Payment webhook handler with retry logic
async function handlePaymentWebhook(payload) {
  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      // Process payment
      await processPayment(payload);
      
      // Log success
      await logWebhookEvent({
        type: 'payment.success',
        attempt: attempt + 1,
        payload
      });
      
      return { success: true };
      
    } catch (error) {
      attempt++;
      
      // Log failure
      await logWebhookEvent({
        type: 'payment.error',
        attempt,
        error: error.message,
        payload
      });
      
      if (attempt >= maxRetries) {
        // Alert admin after 3 failures
        await sendCriticalAlert({
          title: 'Payment Webhook Failed',
          order_id: payload.order_id,
          error: error.message,
          attempts: maxRetries
        });
        
        throw error;
      }
      
      // Exponential backoff: wait 1s, 2s, 4s
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
}
```

#### Queue-Based Document Generation

Instead of generating all documents synchronously (which could timeout), use a queue:

```javascript
// Order paid → Add jobs to queue
async function onOrderPaid(orderId) {
  await updateOrder(orderId, { status: 'paid' });
  
  // Add jobs to queue (processed independently)
  await queue.add('generate-invoice', { orderId });
  await queue.add('generate-packing-slip', { orderId });
  await queue.add('generate-shipping-label', { orderId });
  await queue.add('update-inventory', { orderId });
  await queue.add('send-emails', { orderId });
}

// Each job runs independently
queue.process('generate-invoice', async (job) => {
  try {
    await generateInvoice(job.data.orderId);
  } catch (error) {
    // Job automatically retries (BullMQ handles this)
    throw error;
  }
});
```

**Queue System:** BullMQ (Redis-based, production-grade)
- Auto-retry failed jobs
- Monitor job status in admin dashboard
- Alert if job fails 3 times

#### Fallback Mechanisms

```javascript
// Shipping label generation with fallback
async function generateLabel(order) {
  try {
    if (order.shipping_carrier === 'GLS') {
      return await generateGLSLabel(order);
    } else {
      return await generateDPDLabel(order);
    }
  } catch (error) {
    // Log error
    await logError('shipping-label-failed', {
      order_id: order.id,
      carrier: order.shipping_carrier,
      error: error.message
    });
    
    // Try alternative carrier as fallback
    const altCarrier = order.shipping_carrier === 'GLS' ? 'DPD' : 'GLS';
    
    try {
      await updateOrder(order.id, { shipping_carrier: altCarrier });
      return await generateLabel({ ...order, shipping_carrier: altCarrier });
    } catch (fallbackError) {
      // Both failed - alert admin for manual processing
      await sendCriticalAlert({
        title: 'Shipping Label Generation Failed',
        order_id: order.id,
        message: 'Both GLS and DPD failed. Manual label needed.',
        primary_error: error.message,
        fallback_error: fallbackError.message
      });
      
      // Mark order for manual processing
      await updateOrder(order.id, {
        status: 'requires_manual_processing',
        internal_notes: `Label generation failed: ${error.message}`
      });
    }
  }
}
```

#### Comprehensive Error Logging

```sql
CREATE TABLE error_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  error_type TEXT NOT NULL,
  severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
  message TEXT NOT NULL,
  stack_trace TEXT,
  context JSONB, -- { order_id, user_id, etc. }
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_errors_unresolved ON error_log(created_at DESC) WHERE resolved = false;
```

#### Health Check System

```javascript
// Runs every 5 minutes
async function healthCheck() {
  const checks = {
    database: await checkDatabaseConnection(),
    supabase: await checkSupabaseConnection(),
    wise_api: await checkWiseAPI(),
    stripe_api: await checkStripeAPI(),
    gls_api: await checkGLSAPI(),
    dpd_api: await checkDPDAPI(),
    email_service: await checkEmailService(),
    queue_system: await checkQueueStatus()
  };
  
  // Log health status
  await logHealthCheck(checks);
  
  // Alert if critical service down
  const failures = Object.entries(checks)
    .filter(([service, status]) => !status.healthy)
    .map(([service, status]) => service);
  
  if (failures.length > 0) {
    await sendHealthAlert({
      title: 'Service Health Check Failed',
      failed_services: failures,
      timestamp: new Date()
    });
  }
}
```

#### Admin Alert System

```javascript
async function sendCriticalAlert(alert) {
  // Email
  await resend.emails.send({
    from: 'Tigo Alerts <alerts@tigoenergy.si>',
    to: 'dejan@adriapower.si',
    subject: `🚨 CRITICAL: ${alert.title}`,
    html: CriticalAlertTemplate(alert)
  });
  
  // SMS (optional but recommended for critical failures)
  await sendSMS({
    to: '+386-YOUR-NUMBER',
    message: `Tigo System Alert: ${alert.title}`
  });
  
  // Log in database
  await db.alerts.create({
    type: 'critical',
    title: alert.title,
    details: alert,
    sent_at: new Date()
  });
}
```

---

## 5. TESTING PROTOCOL

### Before Launch: Comprehensive Testing

#### Unit Tests
- Payment webhook handlers
- VAT validation logic
- Shipping calculation
- Inventory updates

#### Integration Tests
- Complete order flow (cart → checkout → payment → fulfillment)
- GLS API integration (label generation, tracking)
- DPD API integration (label generation, tracking)
- Email delivery
- PDF generation

#### E2E Tests (Playwright)
```javascript
test('Complete B2B order flow', async ({ page }) => {
  // Add products to cart
  await addToCart(page, 'TS4-AO-700', 10);
  
  // Enter VAT number
  await page.fill('#vat-id', 'DE123456789');
  await page.waitForSelector('[data-validated="true"]');
  
  // Select shipping
  await page.click('[data-carrier="GLS"]');
  
  // Complete payment (test mode)
  await completeStripePayment(page);
  
  // Wait for order confirmation
  await page.waitForSelector('.order-success');
  
  // Verify order created in DB
  const order = await db.orders.findOne({ customer_email: testEmail });
  expect(order.status).toBe('paid');
  expect(order.invoice_url).toBeTruthy();
  expect(order.shipping_label_url).toBeTruthy();
});
```

#### Load Testing
- 100 concurrent users
- 1000 orders/hour simulation
- Verify no queue backlog
- Check response times <2s

---

## 6. MONITORING & OBSERVABILITY

### Metrics to Track

**Business Metrics:**
- Orders per day/week/month
- Average order value
- Conversion rate
- Cart abandonment rate
- Top-selling products

**Technical Metrics:**
- API response times
- Webhook success rate
- Queue processing time
- Document generation time
- Database query performance

**Error Metrics:**
- Failed payments
- Failed label generation
- Failed email delivery
- API timeouts

### Tools

- **Vercel Analytics** (included) - Page performance, web vitals
- **Sentry** - Error tracking, performance monitoring
- **Supabase Dashboard** - Database monitoring, query performance
- **BullMQ Dashboard** - Queue monitoring

---

## 7. ADMIN DASHBOARD (Functional, Not Fancy)

### Pages Needed

**Dashboard Home:**
- Today's orders count
- This week revenue
- Pending shipments count
- Low stock alerts
- Recent errors (if any)

**Orders:**
- List view (filterable, sortable)
- Order detail view
- Actions: View, Mark Shipped, Cancel, Refund
- Bulk actions: Export CSV, Print labels

**Inventory:**
- Product list (stock levels)
- Receive Shipment form
- Stock movements history
- Low stock alerts

**Reports:**
- Sales by country (chart)
- Sales by product (chart)
- Intrastat data (table, exportable XML)
- Revenue trends (monthly chart)

**Settings:**
- Company information
- Email templates
- Shipping rates (manual override if needed)
- User management (admin accounts)

**Design:** Basic shadcn/ui components, clean tables, functional. Focus 100% on usability, 0% on aesthetics.

---

## 8. FINAL TECH STACK

### Frontend
- **Template:** Relivator (modified)
- **Framework:** Next.js 15 + React 19
- **UI:** shadcn/ui + Tailwind CSS
- **Language:** TypeScript
- **i18n:** next-intl

### Backend
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage (PDFs)
- **Queue:** BullMQ + Redis (Upstash)

### Payments
- **Primary:** Wise Business API
- **Backup:** Stripe

### Shipping
- **Carriers:** GLS + DPD
- **Integration:** Direct APIs

### Emails
- **Service:** Resend
- **Templates:** React Email

### PDFs
- **Generator:** @react-pdf/renderer

### External APIs
- **VAT:** VIES API (EU)
- **Business Data:** EU Business Registry APIs

### Hosting
- **Frontend:** Vercel
- **Database:** Supabase (EU region)
- **Queue/Redis:** Upstash (EU region)

### Monitoring
- **Errors:** Sentry
- **Analytics:** Vercel Analytics
- **Logs:** Supabase + custom error_log table

---

## 9. DEPLOYMENT STRATEGY

### Environments

**Development:**
- Local: `localhost:3000`
- Database: Local Supabase or dev instance
- Payments: Stripe test mode, Wise sandbox
- Shipping: Mock APIs

**Staging:**
- URL: `staging.tigoenergy.si`
- Database: Supabase staging
- Payments: Test mode
- Shipping: Test mode
- Purpose: Final testing before production

**Production:**
- URLs: All 21+ tigoenergy.* domains
- Database: Supabase production (EU)
- Payments: Live mode
- Shipping: Live APIs
- Monitoring: Full observability

### CI/CD Pipeline (Vercel)

```yaml
# Automatic deployments
main branch → Production (all domains)
develop branch → Staging
feature/* branches → Preview deployments
```

### Domain Routing

All domains point to same Vercel deployment, routing handled by middleware:

```javascript
// middleware.ts
export function middleware(request) {
  const host = request.headers.get('host');
  const config = getDomainConfig(host);
  
  // Set market context
  request.headers.set('x-market', config.market);
  request.headers.set('x-default-locale', config.defaultLocale);
  
  return NextResponse.next();
}
```

---

## 11. NEWSLETTER & CUSTOMER ENGAGEMENT

### Newsletter Subscription

**Where to Show Subscription:**

1. **Checkout Page** (optional checkbox):
```
☐ Subscribe to Tigo Energy newsletter for product updates and exclusive offers
```

2. **Footer** (all pages):
```
Newsletter Signup:
[Email input] [Subscribe Button]
"Stay updated with latest Tigo products and solar industry news"
```

3. **Post-Purchase** (order confirmation page):
```
"Want to stay informed about new Tigo products?"
[Yes, subscribe me] [No thanks]
```

### Subscription Flow

```javascript
// 1. Customer subscribes
async function subscribe(email, source, market, language) {
  // Check if already subscribed
  const existing = await db.newsletter_subscribers.findOne({ email });
  
  if (existing) {
    if (existing.status === 'unsubscribed') {
      // Resubscribe
      await db.newsletter_subscribers.update(existing.id, {
        status: 'active',
        unsubscribed_at: null,
        updated_at: new Date()
      });
    } else {
      // Already subscribed
      return { success: true, message: 'Already subscribed' };
    }
  } else {
    // New subscriber
    await db.newsletter_subscribers.create({
      email,
      source, // 'checkout', 'footer', 'post_purchase'
      market,
      language,
      status: 'active',
      confirmed: false // Will send confirmation email
    });
  }
  
  // Send confirmation email (double opt-in for GDPR)
  await sendNewsletterConfirmation(email, language);
  
  return { success: true, message: 'Confirmation email sent' };
}

// 2. Confirmation email
async function sendNewsletterConfirmation(email, language) {
  const token = generateConfirmationToken(email);
  const confirmUrl = `https://tigoenergy.${market}/newsletter/confirm?token=${token}`;
  
  const translations = {
    sl: {
      subject: 'Potrdite vašo naročnino',
      heading: 'Potrdite vašo e-poštno naročnino',
      body: 'Kliknite spodnji gumb za potrditev naročnine na Tigo Energy novice.',
      button: 'Potrdi naročnino'
    },
    de: {
      subject: 'Bestätigen Sie Ihr Newsletter-Abonnement',
      heading: 'Bestätigen Sie Ihr E-Mail-Abonnement',
      body: 'Klicken Sie auf die Schaltfläche unten, um Ihr Abonnement des Tigo Energy Newsletters zu bestätigen.',
      button: 'Abonnement bestätigen'
    },
    en: {
      subject: 'Confirm your newsletter subscription',
      heading: 'Confirm your email subscription',
      body: 'Click the button below to confirm your Tigo Energy newsletter subscription.',
      button: 'Confirm Subscription'
    }
  };
  
  const t = translations[language] || translations.en;
  
  await resend.emails.send({
    from: 'Tigo Energy <newsletter@tigoenergy.si>',
    to: email,
    subject: t.subject,
    html: NewsletterConfirmationTemplate({ confirmUrl, translations: t })
  });
}

// 3. User clicks confirmation link
async function confirmSubscription(token) {
  const email = verifyConfirmationToken(token);
  
  await db.newsletter_subscribers.update({ email }, {
    confirmed: true,
    confirmed_at: new Date()
  });
  
  // Send welcome email
  await sendWelcomeEmail(email);
}

// 4. Unsubscribe (one-click)
async function unsubscribe(email, reason) {
  await db.newsletter_subscribers.update({ email }, {
    status: 'unsubscribed',
    unsubscribed_at: new Date(),
    unsubscribe_reason: reason
  });
}
```

### Newsletter Campaigns (Admin Dashboard)

**Admin → Marketing → Newsletters**

**Create Campaign Form:**
- Campaign name (internal)
- Subject line
- Preview text
- Content (rich text editor or HTML)
- Target audience:
  - Markets: [All] or select specific (DE, SI, FR, etc.)
  - Languages: [All] or select specific
  - Customer type: [All], B2B only, B2C only
- Schedule: [Send now] or [Schedule for date/time]

**Campaign Creation:**
```javascript
async function createCampaign(campaignData) {
  const campaign = await db.newsletter_campaigns.create({
    name: campaignData.name,
    subject: campaignData.subject,
    html_content: campaignData.html,
    preview_text: campaignData.preview,
    target_markets: campaignData.markets,
    target_languages: campaignData.languages,
    target_customer_types: campaignData.customerTypes,
    status: campaignData.sendNow ? 'sending' : 'scheduled',
    scheduled_at: campaignData.scheduledAt,
    created_by: adminUserId
  });
  
  if (campaignData.sendNow) {
    await sendCampaign(campaign.id);
  }
  
  return campaign;
}

async function sendCampaign(campaignId) {
  const campaign = await db.newsletter_campaigns.findOne(campaignId);
  
  // Get targeted subscribers
  const subscribers = await db.newsletter_subscribers.findMany({
    where: {
      status: 'active',
      confirmed: true,
      market: { in: campaign.target_markets || undefined },
      language: { in: campaign.target_languages || undefined }
    }
  });
  
  // Send in batches (avoid rate limits)
  const batchSize = 100;
  for (let i = 0; i < subscribers.length; i += batchSize) {
    const batch = subscribers.slice(i, i + batchSize);
    
    await Promise.all(batch.map(subscriber => 
      sendNewsletterEmail(campaign, subscriber)
    ));
    
    // Wait 1 second between batches
    await sleep(1000);
  }
  
  // Update campaign
  await db.newsletter_campaigns.update(campaignId, {
    status: 'sent',
    sent_at: new Date(),
    recipients_count: subscribers.length
  });
}

async function sendNewsletterEmail(campaign, subscriber) {
  // Add unsubscribe link to all emails (GDPR requirement)
  const unsubscribeToken = generateUnsubscribeToken(subscriber.email);
  const unsubscribeUrl = `https://tigoenergy.si/newsletter/unsubscribe?token=${unsubscribeToken}`;
  
  const htmlWithUnsubscribe = `
    ${campaign.html_content}
    
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc; font-size: 12px; color: #666;">
      <p>
        You're receiving this email because you subscribed to Tigo Energy newsletter.
        <br>
        <a href="${unsubscribeUrl}">Unsubscribe</a>
      </p>
    </div>
  `;
  
  await resend.emails.send({
    from: 'Tigo Energy <newsletter@tigoenergy.si>',
    to: subscriber.email,
    subject: campaign.subject,
    html: htmlWithUnsubscribe,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`
    }
  });
  
  // Update last sent
  await db.newsletter_subscribers.update(subscriber.id, {
    last_email_sent_at: new Date()
  });
}
```

### Newsletter Content Ideas

**Monthly:**
- New Tigo products launched
- Industry news (solar regulations, incentives)
- Customer case studies
- Technical tips

**Quarterly:**
- Seasonal promotions
- Product comparisons
- Installation guides

**Ad-hoc:**
- Major announcements
- Limited-time offers
- Event invitations (webinars, trade shows)

### GDPR Compliance

✅ **Double opt-in** (confirmation email required)
✅ **Clear consent** at signup
✅ **Easy unsubscribe** (one-click link in every email)
✅ **Data retention** policy (delete unsubscribed after 2 years)
✅ **Privacy policy** link in footer
✅ **List-Unsubscribe header** (RFC 2369 compliant)

### Metrics Dashboard

**Admin → Marketing → Newsletter Analytics**

Show:
- Total subscribers (by market, by status)
- Growth rate (new subscribers this month)
- Campaign performance:
  - Sent count
  - Open rate
  - Click rate
  - Unsubscribe rate
- Best performing campaigns
- Most engaged subscribers

---

## 12. LAUNCH CHECKLIST

### Pre-Launch (Week 6)

**Legal/Compliance:**
- [ ] OSS VAT registration complete
- [ ] Terms & Conditions finalized
- [ ] Privacy Policy finalized
- [ ] GDPR compliance verified

**Technical:**
- [ ] All tests passing (unit, integration, E2E)
- [ ] Load testing completed
- [ ] Error monitoring configured
- [ ] Backup system tested
- [ ] All APIs tested (live credentials)

**Content:**
- [ ] All Tigo products uploaded
- [ ] Product images optimized
- [ ] Product descriptions (all languages)
- [ ] Shipping rates configured
- [ ] Email templates tested

**Infrastructure:**
- [ ] Domains configured
- [ ] SSL certificates active
- [ ] CDN configured
- [ ] Database backed up
- [ ] Monitoring dashboards set up

### Launch Day

**tigoenergy.si (Slovenia B2B only):**
- [ ] Deploy to production
- [ ] Verify domain resolves
- [ ] Test complete order flow (real payment)
- [ ] Verify warehouse email received
- [ ] Test "Mark as Shipped" workflow
- [ ] Monitor errors for 24 hours

### Post-Launch (Week 7+)

**Day 1-7:**
- Monitor all metrics closely
- Fix any critical issues immediately
- Gather user feedback

**Week 2:**
- Prepare OSS VAT for B2C markets
- Configure remaining domains
- Test multi-market setup

**Week 3-4:**
- Deploy to Tier 1 markets (DE, IT, ES, NL, FR)
- Enable B2C on non-Slovenia domains
- Ramp up marketing

**Week 5-8:**
- Deploy remaining domains
- Optimize based on data
- Scale operations

---

## CONCLUSION

This is a production-ready, enterprise-grade e-commerce platform with:

✅ **Full automation** (payment → fulfillment in <60 seconds)
✅ **Dual shipping** (GLS + DPD customer choice)
✅ **Intrastat compliance** (XML format, arrivals + dispatches)
✅ **Professional design** (Relivator template)
✅ **Zero-tolerance reliability** (retry logic, fallbacks, monitoring)
✅ **Multi-domain scalability** (21+ markets, one codebase)
✅ **B2B + B2C ready** (VAT validation, OSS compliant)

**Timeline:** 6 weeks from start to first market launch.

**Operating Cost:** ~€100/month (Supabase + Vercel + Resend + monitoring)

**Maintenance:** <5 hours/month after launch (review reports, handle exceptions)

This platform will scale to millions in revenue with minimal operational overhead.

---

**Ready to build?** Next step: Initialize Next.js project with Relivator template and start customization.
