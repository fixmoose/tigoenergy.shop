# Tigo Energy EU - Development Roadmap

## ✅ Week 0: Foundation (COMPLETED)
- [x] Project initialized
- [x] Next.js 15 + TypeScript setup
- [x] Supabase configuration
- [x] Database schema designed
- [x] Documentation created
- [x] Git repository ready

---

## 📅 Week 1: Core Infrastructure

### Database
- [ ] Run SQL migrations on Supabase
- [ ] Create storage buckets
- [ ] Set up RLS policies
- [ ] Test database connection
- [ ] Seed initial data (system_settings)

### UI Foundation
- [ ] Install shadcn/ui
- [ ] Set up components folder structure
- [ ] Create layout components (Header, Footer, Navigation)
- [ ] Implement responsive design
- [ ] Add company branding

### Multi-Language Setup
- [ ] Install next-intl
- [ ] Configure supported languages (sl, de, en, fr, it, es, nl, pl)
- [ ] Create translation files structure
- [ ] Implement language switcher
- [ ] Test language routing

---

## 📅 Week 2: Product Catalog

### Product Management
- [ ] Create product list page
- [ ] Create product detail page
- [ ] Implement product search
- [ ] Add category filtering
- [ ] Product image optimization

### Admin - Products
- [ ] Product creation form
- [ ] Product edit form
- [ ] Bulk upload interface
- [ ] Image upload to Supabase Storage
- [ ] Product translations management

### Data Entry
- [ ] Upload all Tigo product data
- [ ] Add product images
- [ ] Set CN codes for Intrastat
- [ ] Configure pricing
- [ ] Set stock levels

---

## 📅 Week 3: Shopping Cart & Checkout

### Shopping Cart
- [ ] Cart context/state management
- [ ] Add to cart functionality
- [ ] Cart page UI
- [ ] Quantity adjustment
- [ ] Remove from cart
- [ ] Cart persistence (local storage)

### Checkout Flow
- [ ] Shipping address form
- [ ] Billing address form
- [ ] VAT number validation (VIES API)
- [ ] Auto-fill company data
- [ ] Shipping method selection (GLS/DPD/Local Pickup)
- [ ] Real-time shipping calculation
- [ ] Order summary

---

## 📅 Week 4: Payment Integration

### Wise Integration
- [ ] Set up Wise Business account
- [ ] Get API credentials
- [ ] Implement payment initialization
- [ ] Configure webhooks
- [ ] Test payment flow
- [ ] Handle payment errors

### Stripe Integration (Backup)
- [ ] Set up Stripe account
- [ ] Install Stripe SDK
- [ ] Create payment intent API
- [ ] Implement Stripe Elements
- [ ] Configure webhooks
- [ ] Test mode verification

### Order Processing
- [ ] Webhook handler (`/api/webhooks/payment`)
- [ ] Order status updates
- [ ] Inventory reservation
- [ ] Error handling & retries

---

## 📅 Week 5: Automation & Fulfillment

### PDF Generation
- [ ] Invoice template (multi-language)
- [ ] Packing slip template
- [ ] Pickup slip template
- [ ] Test PDF generation
- [ ] Upload to Supabase Storage

### Email System
- [ ] Set up Resend account
- [ ] Verify domain
- [ ] Create email templates
  - [ ] Order confirmation
  - [ ] Shipping notification
  - [ ] Pickup ready
  - [ ] Warehouse alert
- [ ] Test email delivery

### Shipping Labels (Mock)
- [ ] Mock GLS label generation
- [ ] Mock DPD label generation
- [ ] Local pickup workflow
- [ ] Track label generation in database

### Queue System
- [ ] Set up Upstash Redis
- [ ] Configure BullMQ
- [ ] Create job processors
  - [ ] Invoice generation
  - [ ] Email sending
  - [ ] Label generation
- [ ] Monitor queue dashboard

---

## 📅 Week 6: Admin Dashboard & Testing

### Admin Dashboard
- [ ] Dashboard home (stats, alerts)
- [ ] Orders list page
  - [ ] Filters (status, date, market)
  - [ ] Search functionality
  - [ ] Mark as shipped action
- [ ] Order detail page
- [ ] Inventory management
  - [ ] Stock levels view
  - [ ] Receive shipment form
  - [ ] Stock movements log
- [ ] Reports
  - [ ] Sales by country
  - [ ] Best-selling products
  - [ ] Revenue trends

### Testing
- [ ] Manual test: Complete order flow (B2B)
- [ ] Manual test: Complete order flow (B2C)
- [ ] Manual test: Local pickup (Slovenia)
- [ ] Manual test: Admin order processing
- [ ] Manual test: Email delivery
- [ ] Manual test: PDF generation
- [ ] Fix critical bugs

---

## 🚀 Pre-Launch Checklist

### Legal & Compliance
- [ ] OSS VAT registration (Slovenia)
- [ ] Terms & Conditions finalized
- [ ] Privacy Policy finalized
- [ ] Cookie policy implemented
- [ ] GDPR compliance verified

### Infrastructure
- [ ] Domain DNS configured (tigoenergy.si)
- [ ] SSL certificate active
- [ ] Vercel deployment tested
- [ ] Environment variables set (production)
- [ ] Database backup configured

### Content
- [ ] All products uploaded (with images)
- [ ] Product descriptions (all languages)
- [ ] Shipping rates configured
- [ ] Email templates finalized
- [ ] Company information complete

### Integrations (Wait for credentials)
- [ ] GLS API credentials received
- [ ] DPD API credentials received
- [ ] Implement real shipping integrations
- [ ] Test label generation (live)
- [ ] Test tracking

---

## 📅 Post-Launch (Week 7-8)

### Monitoring
- [ ] Set up Sentry error tracking
- [ ] Configure Vercel Analytics
- [ ] Monitor order processing
- [ ] Track email delivery rates
- [ ] Watch for API failures

### Newsletter System
- [ ] Create newsletter campaigns interface
- [ ] Design email templates
- [ ] Test double opt-in flow
- [ ] Implement segmentation
- [ ] Schedule first campaign

### Intrastat Reporting
- [ ] Purchase order tracking (arrivals)
- [ ] Monthly cron job setup
- [ ] XML generation implementation
- [ ] Test report generation
- [ ] Submit to customs (manual review)

### Optimization
- [ ] Performance testing
- [ ] SEO optimization
- [ ] Image optimization
- [ ] Code splitting
- [ ] Lighthouse audit

---

## 📅 Expansion (Month 2-3)

### Multi-Domain Deployment
- [ ] Configure tigoenergy.de
- [ ] Configure tigoenergy.fr
- [ ] Configure tigoenergy.it
- [ ] Configure tigoenergy.es
- [ ] Configure tigo-energy.nl
- [ ] Test all domains
- [ ] Enable B2C on non-Slovenia domains

### Marketing
- [ ] SEO optimization per market
- [ ] Google Shopping integration (optional)
- [ ] Social media links
- [ ] Blog/news section (optional)

### Advanced Features
- [ ] Customer account system
- [ ] Order history
- [ ] Saved addresses
- [ ] Wishlist
- [ ] Product recommendations

---

## 🎯 Success Metrics

### Month 1 (Slovenia only)
- Target: 10+ orders
- Target: €5K+ revenue
- Metric: <1 week fulfillment time
- Metric: 0 critical errors

### Month 3 (5 markets)
- Target: 50+ orders/month
- Target: €25K+ monthly revenue
- Metric: <3 day fulfillment time
- Metric: 95%+ uptime

### Month 6 (All markets)
- Target: 100+ orders/month
- Target: €50K+ monthly revenue
- Metric: <24h fulfillment time
- Metric: 99%+ uptime

---

## 📞 Key Contacts

**Immediate Actions Needed:**
1. ✉️ Email GLS Slovenia: info@gls-slovenia.com (Request API access)
2. ✉️ Contact DPD account manager (Request API credentials)
3. 💳 Set up Wise Business account
4. 💳 Set up Stripe account
5. 📧 Create Resend account

**Technical Support:**
- Supabase: support@supabase.com
- Vercel: support@vercel.com
- Next.js: GitHub issues

---

**Last Updated:** 2026-02-02
**Current Status:** ✅ Foundation Complete - Ready for Week 1
