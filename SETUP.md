# Quick Setup Guide

## 1. Prerequisites Check

Make sure you have:
- ✅ Node.js 20+ installed
- ✅ Git installed
- ✅ Supabase project created (already done)
- ⏳ Wise Business account (for payments)
- ⏳ Stripe account (for backup payments)
- ⏳ Resend account (for emails)
- ⏳ GLS API credentials (request from info@gls-slovenia.com)
- ⏳ DPD API credentials (request from account manager)

## 2. Clone Repository

```bash
git clone https://github.com/fixmoose/tigoenergy.si.git
cd tigoenergy.si
```

## 3. Install Dependencies

```bash
npm install
# or
pnpm install
```

## 4. Environment Setup

```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local with your credentials
# Supabase is already configured!
```

## 5. Database Setup

### Option A: Using Supabase Dashboard

1. Go to https://unoruqsweyrmkshmscub.supabase.co
2. Click "SQL Editor"
3. Copy contents of `/database/schema.sql`
4. Paste and execute

### Option B: Using Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Link project
supabase link --project-ref unoruqsweyrmkshmscub

# Run migrations
supabase db push
```

## 6. Create Storage Buckets

In Supabase Dashboard → Storage, create:
- `invoices` (private)
- `packing-slips` (private)
- `shipping-labels` (private)
- `product-images` (public)

## 7. Start Development

```bash
npm run dev
```

Visit `http://localhost:3000`

## 8. Test Supabase Connection

Create a test file:

```typescript
// src/app/test/page.tsx
import { createClient } from '@/lib/supabase/server'

export default async function TestPage() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('system_settings')
    .select('*')
    .limit(1)
  
  return (
    <div>
      <h1>Supabase Connection Test</h1>
      <pre>{JSON.stringify({ data, error }, null, 2)}</pre>
    </div>
  )
}
```

Visit `http://localhost:3000/test`

## 9. Next Steps

Once basic setup works:

1. **Add Product Data**
   - Create products table entries
   - Upload Tigo product images
   - Set up product catalog

2. **Configure Payments**
   - Set up Wise API key
   - Configure Stripe webhooks
   - Test payment flow

3. **Email Setup**
   - Create Resend account
   - Verify domain
   - Test email templates

4. **Shipping APIs**
   - Wait for GLS credentials
   - Wait for DPD credentials
   - Implement integrations

## 10. Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Configure environment variables in Vercel dashboard
# Add custom domains (tigoenergy.si, etc.)
```

---

## Troubleshooting

### "Module not found" errors
```bash
npm install
# or delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Supabase connection fails
- Check `.env.local` has correct URL and key
- Verify Supabase project is not paused
- Check RLS policies allow access

### Build errors
```bash
# Clear Next.js cache
rm -rf .next
npm run dev
```

---

## Getting Help

1. Check `/docs` folder for detailed specs
2. Review README.md for architecture
3. Contact: dejan@adriapower.si

---

**Current Status:** ✅ Project initialized, ready for development

**Next Milestone:** Complete database setup + product catalog
