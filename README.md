# Tigo Energy EU - E-Commerce Platform

Multi-domain, fully automated e-commerce platform for Tigo Energy products across 21+ European markets.

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ 
- npm or pnpm
- Supabase account (already configured)

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Run database migrations (see Database Setup below)

# Start development server
npm run dev
```

Visit `http://localhost:3000`

---

## 📁 Project Structure

```
tigoenergy/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── [locale]/          # Multi-language routing
│   │   ├── api/               # API routes (webhooks, cron jobs)
│   │   └── admin/             # Admin dashboard
│   ├── components/            # React components
│   │   ├── ui/                # shadcn/ui components
│   │   ├── cart/              # Shopping cart
│   │   ├── checkout/          # Checkout flow
│   │   └── products/          # Product displays
│   ├── lib/                   # Utilities
│   │   ├── supabase/          # Supabase clients
│   │   ├── shipping/          # GLS + DPD integrations
│   │   ├── payments/          # Wise + Stripe
│   │   ├── email/             # Resend templates
│   │   └── pdf/               # Invoice/label generation
│   └── types/                 # TypeScript types
├── public/                    # Static assets
└── database/                  # SQL migration files
```

---

## 🗄️ Database Setup

### 1. Create Tables

Connect to your Supabase project and run the SQL from `/database/schema.sql`:

```sql
-- Run the complete schema provided in database-schema-complete.sql
-- This includes:
-- - products
-- - orders
-- - order_items
-- - customers
-- - inventory_movements
-- - invoices
-- - shipping_rates
-- - newsletter_subscribers
-- - intrastat_reports
-- - and more...
```

### 2. Set Up Row Level Security (RLS)

Enable RLS on all tables and create appropriate policies.

### 3. Configure Storage Buckets

Create the following Supabase Storage buckets:
- `invoices` - For invoice PDFs
- `packing-slips` - For packing slip PDFs
- `shipping-labels` - For shipping label PDFs
- `product-images` - For product images

---

## 🌍 Multi-Domain Configuration

### Domains

Platform supports 21+ domains:
- tigoenergy.si (Slovenia - B2B only)
- tigoenergy.de (Germany - B2B + B2C)
- tigoenergy.fr (France - B2B + B2C)
- tigoenergy.it (Italy - B2B + B2C)
- ... and 17 more

### Domain Routing

All domains point to same Vercel deployment. Routing handled by middleware:

```typescript
// middleware.ts determines market and language based on domain
tigoenergy.de → market: 'de', locale: 'de'
tigoenergy.fr → market: 'fr', locale: 'fr'
```

### Deployment

```bash
# Deploy to Vercel
vercel

# Configure custom domains in Vercel dashboard
# Point all tigoenergy.* domains to the deployment
```

---

## 💳 Payment Integration

### Wise Business (Primary)
1. Create Wise Business account
2. Get API key
3. Set `WISE_API_KEY` in .env.local
4. Configure webhooks in Wise dashboard

### Stripe (Backup)
1. Create Stripe account
2. Get API keys (test and live)
3. Set keys in .env.local
4. Configure webhooks

---

## 📦 Shipping Integration

### GLS

**Status:** ⏳ Awaiting API credentials

**Contact:** info@gls-slovenia.com

**Need:**
- Username
- Password  
- Client Number

**Once obtained:**
```env
GLS_USERNAME=your_username
GLS_PASSWORD=your_password
GLS_CLIENT_NUMBER=your_client_number
```

### DPD

**Status:** ⏳ Awaiting API credentials

**Contact:** DPD Slovenia sales rep

**Need:**
- API credentials (to generate JWT token)

**Once obtained:**
```env
DPD_API_TOKEN=your_jwt_token
```

### Local Pickup (Slovenia only)

Already configured:
- Location: Podsmreka 59A, 1356 Dobrova
- Free option for Slovenian customers
- Email + SMS notification when ready

---

## 🎨 Frontend

### Based on Relivator Template
- Next.js 15 + React 19
- Tailwind CSS
- shadcn/ui components
- Responsive, modern design

### Customizations
- Multi-language support (8+ languages)
- B2B features (VAT validation, bulk pricing)
- Dual shipping options
- Local pickup option

---

## 🤖 Automation

### Order Processing Flow

```
Payment received (webhook)
  ↓
Order status: 'paid'
  ↓
[Parallel processing]
├── Generate Invoice PDF
├── Generate Packing Slip PDF
├── Generate Shipping Label PDF (GLS/DPD/Local Pickup)
├── Update Inventory (stock out)
└── Send Emails (warehouse + customer)
  ↓
Order ready for fulfillment
```

### Email Notifications

**Warehouse:**
- New order with all PDFs attached
- One-click "Mark as Shipped" button

**Customer:**
- Order confirmation + invoice
- Shipping notification + tracking link
- Delivery confirmation

### Intrastat Reporting

**Monthly automated:**
- 1st of month: Generate XML reports
  - Arrivals (incoming goods)
  - Dispatches (outgoing sales)
- Email to admin for review
- Submit to Slovenian customs

---

## 📧 Email Service

Using **Resend** for transactional emails:

1. Create Resend account
2. Verify domain (tigoenergy.si recommended)
3. Get API key
4. Set `RESEND_API_KEY`

**Email types:**
- Order confirmations
- Shipping notifications
- Pickup ready notifications
- Newsletter campaigns
- Low stock alerts
- System alerts

---

## 📰 Newsletter System

### Features
- Double opt-in (GDPR compliant)
- Multi-language campaigns
- Segmentation by market/customer type
- Analytics (opens, clicks, unsubscribes)

### Subscription Points
- Checkout page (optional checkbox)
- Footer on every page
- Post-purchase offer

---

## 🛠️ Admin Dashboard

Access: `/admin`

### Pages
1. **Dashboard** - Overview, stats, alerts
2. **Orders** - List, filter, process
3. **Inventory** - Stock levels, receive shipments
4. **Products** - Manage catalog
5. **Customers** - B2B/B2C accounts
6. **Reports** - Sales, Intrastat, VAT
7. **Marketing** - Newsletter campaigns
8. **Settings** - Company info, rates, users

---

## 🔒 Security

### Environment Variables
Never commit `.env.local` to git.

### API Keys
- Supabase: RLS enabled on all tables
- Payment: Test keys for development
- Shipping: Secure credential storage

### GDPR Compliance
- Cookie consent
- Privacy policy
- Data retention policies
- Right to erasure

---

## 🧪 Testing

### Manual Testing Checklist

**Before Launch:**
- [ ] Product catalog loads
- [ ] Add to cart works
- [ ] VAT validation (enter test VAT ID)
- [ ] Checkout flow (all steps)
- [ ] Payment processing (Stripe test mode)
- [ ] Order confirmation emails
- [ ] Warehouse email with PDFs
- [ ] Admin dashboard access
- [ ] Inventory updates correctly

**Shipping:**
- [ ] Slovenia: See local pickup + GLS + DPD
- [ ] Other EU: See only GLS + DPD
- [ ] Label generation (once APIs connected)

---

## 📋 TODO / Next Steps

### Immediate (Week 1-2)
- [x] Project initialization
- [ ] Complete database schema setup
- [ ] Install shadcn/ui components
- [ ] Create product catalog UI
- [ ] Implement shopping cart
- [ ] Build checkout flow

### Short-term (Week 3-4)
- [ ] Payment integration (Wise + Stripe)
- [ ] Email system setup (Resend)
- [ ] Invoice PDF generation
- [ ] Basic admin dashboard
- [ ] Multi-language setup (next-intl)

### Medium-term (Week 5-6)
- [ ] Shipping integration (GLS + DPD)
- [ ] Local pickup workflow
- [ ] Newsletter system
- [ ] Intrastat XML generation
- [ ] Testing & bug fixes

### Before Production
- [ ] OSS VAT registration (Slovenia)
- [ ] Get shipping API credentials
- [ ] Domain configuration
- [ ] SSL certificates
- [ ] Load testing
- [ ] Security audit

---

## 🚨 Critical Reminders

1. **OSS VAT Registration Required** for B2C sales outside Slovenia
2. **Shipping APIs** - Contact GLS and DPD ASAP
3. **Payment Processors** - Set up Wise Business account
4. **Email Domain** - Verify with Resend
5. **Google APIs** - Will be needed for:
   - Address validation
   - Maps (ParcelShop finder)
   - reCAPTCHA

---

## 📞 Support Contacts

**GLS Slovenia**
- Email: info@gls-slovenia.com
- For: API access

**DPD Slovenia**
- Contact: Account manager
- For: API credentials

**Tigo Energy**
- Your distributor contact
- For: Product data, images, pricing

---

## 🔗 Resources

- [Supabase Dashboard](https://unoruqsweyrmkshmscub.supabase.co)
- [GitHub Repo](https://github.com/fixmoose/tigoenergy.si.git)
- [Documentation Files](/docs)
  - database-schema-complete.sql
  - automation-workflows.md
  - final-technical-specification.md

---

## 🎯 Project Goals

**Phase 1: Slovenia Launch** (tigoenergy.si)
- B2B only
- Local pickup + GLS + DPD shipping
- Manual OSS not needed yet

**Phase 2: EU Expansion** (All domains)
- Enable B2C
- OSS VAT in place
- Full automation
- 5+ markets live

**Phase 3: Scale** (3-6 months)
- All 21+ domains operational
- Newsletter campaigns
- Marketing automation
- Analytics & optimization

---

**Built with:** Next.js 15, React 19, TypeScript, Tailwind CSS, Supabase, Vercel

**License:** Proprietary - Initra Energija d.o.o.
