# AI Prompting System for Tigo Energy Platform
## How to Delegate Development Tasks Effectively to AI

---

## 🎯 THE CORE PRINCIPLE

**Good AI prompts = Less back-and-forth = Faster development**

You need to give AI enough context that it can make smart decisions without asking you 100 questions.

---

## 📋 MASTER PROMPT TEMPLATE

Use this structure for ANY feature request:

```
## TASK: [Feature Name]

### CONTEXT
[What is this feature? Why does it matter? How fits into the larger system?]

### CURRENT STATE
[What exists already? What can be reused?]

### REQUIREMENTS
1. [Specific requirement]
2. [Specific requirement]
3. [Specific requirement with details]

### DATA & FLOWS
- Input: [What data comes in?]
- Processing: [What happens to it?]
- Output: [What happens after?]
- Database: [Which tables involved?]

### VALIDATION & RULES
- [Rule 1] - why it matters
- [Rule 2] - consequence if broken
- [Rule 3] - error handling needed

### UI/UX NOTES
- Layout: [Description or reference]
- Components: [What should be interactive]
- Feedback: [How user knows action worked]

### EDGE CASES
- What if [scenario]? → [Expected behavior]
- What if [scenario]? → [Expected behavior]
- What if [scenario]? → [Expected behavior]

### SUCCESS CRITERIA
- [ ] Feature does X
- [ ] Feature prevents Y
- [ ] User sees Z

### DELIVERABLES
- [ ] Code file(s)
- [ ] Database schema updates
- [ ] API endpoints
- [ ] Component documentation
```

---

## 🏗️ YOUR SPECIFIC PROMPTS

### PROMPT #1: B2C ACCOUNT CREATION

```
## TASK: B2C Account Creation Form

### CONTEXT
B2C customers need accounts to track orders and save carts. This is their entry point 
to the platform. Must be simple, not overwhelming.

### CURRENT STATE
- Supabase ready for customers table
- Google Maps API available
- Email/SMS validation ready
- VIES SOAP integration in place (for future B2B)
- Username suggestion: firstname.lastname.### (3 random numbers)

### REQUIREMENTS
1. Email validation FIRST (validate human before asking other info)
   - Send code to email (NO LINKS, just plain code)
   - User enters code within 5 minutes
   - If fails, show "invalid code, try again"
   - Once valid, proceed to next step

2. Basic Info Collection
   - First Name (required)
   - Last Name (required)
   - Phone (required for SMS delivery validation)
   - Address (required, EU only)
   - Occupation (optional)
   - Date of Birth (optional, but if provided, verify 18+)

3. Address Validation
   - Use Google Maps API to validate address
   - Show suggestions if address not exact
   - Allow user to accept suggestion or keep original
   - Store both original and validated address

4. Phone Validation
   - Send SMS code to phone number
   - User enters code
   - Same 5-minute rule as email

5. Username & Password
   - Suggest: firstname.lastname.### (3 random numbers)
   - Allow user to use suggestion OR enter custom username
   - Password: min 8 chars, at least 1 uppercase, 1 lowercase, 1 number, 1 special char
   - Check if username already exists (live validation)

6. Legal Agreements
   - Checkbox for Terms & Conditions
   - Checkbox for Privacy Policy
   - Checkbox for Cookie Policy
   - Cannot proceed without all checked

7. Bot Protection
   - Google Captcha v3
   - Don't block on score, but log suspicious activity

8. Create Account Flow
   - Button shows "Creating account..." with loading state
   - On success: Clear form, redirect to account dashboard
   - On error: Show which field failed and why
   - Generate UUID on creation

9. Success State
   - Redirect to B2C dashboard
   - Show welcome message with customer name
   - Show "Recent Orders" section (empty initially)
   - Show "Save Cart" feature
   - Show account settings link

### DATA & FLOWS
- Input: Email → Phone → Personal Info → Address → Username/Pass → Agreements
- Processing: Validate each field → Check availability → Google Maps → Send codes → Create user
- Output: UUID generated → Redirect to dashboard
- Database: 
  - customers table (id, email, phone, first_name, last_name, address, 
    address_validated, dob, occupation, created_at, customer_type='b2c')
  - Add columns: email_verified_at, phone_verified_at, username, hashed_password

### VALIDATION & RULES
- Email must be valid format AND verified via code
- Phone must be valid EU format AND verified via SMS
- Age must be 18+ IF dob provided
- Address must pass Google Maps validation
- Username must be 3-20 chars, alphanumeric + dot, no spaces
- Password must meet complexity rules
- Cannot use same email/username twice

### UI/UX NOTES
- Single page form with step indicators (1/6, 2/6, etc.)
- Show progress bar at top
- Each section has clear heading
- Use inline validation (show error below field immediately)
- Green checkmark when field passes validation
- Button text changes: "Next Step" → "Create Account" on final step
- Show estimated time: "Takes 2 minutes"
- Mobile responsive (especially important for phone field)

### EDGE CASES
- Email code expires after 5 minutes → Show "Code expired, resend?"
- SMS fails to send → Show "Can't reach phone number, try different?"
- User closes form halfway → Warn "Your progress won't be saved"
- Address not found on Google Maps → Ask "Is this correct? Save anyway?"
- Someone tries registering with same email → Show "Email already registered, login instead?"

### SUCCESS CRITERIA
- [ ] Form validates all 5 required fields before account creation
- [ ] Email verification works (code sent and checked)
- [ ] Phone verification works (SMS sent and checked)
- [ ] Google Maps validation works and shows alternatives
- [ ] Username availability checked live
- [ ] Account created with proper UUID
- [ ] User redirected to dashboard after creation
- [ ] Form shows helpful error messages
- [ ] Form works on mobile

### DELIVERABLES
- [ ] React component: B2CRegistration.jsx
- [ ] Supabase schema updates (if needed)
- [ ] API endpoints: /api/auth/register, /api/validate/email-code, /api/validate/phone-code, 
  /api/validate/username, /api/validate/address
- [ ] Database migrations
- [ ] Error handling guide
```

---

### PROMPT #2: B2B ACCOUNT CREATION

```
## TASK: B2B Account Creation Form (VAT Verification First)

### CONTEXT
B2B customers are resellers/installers/distributors. They need different info than B2C.
VAT verification is critical for invoicing and Intrastat reporting.
Must be quick if VAT is valid, with fallback to manual verification.

### CURRENT STATE
- VIES SOAP integration ready (VIES_AI_INTEGRATION_GUIDE.md already created)
- Google Maps API available
- Email/SMS/phone validation same as B2C
- Payment method preferences needed
- Shipping preferences needed

### REQUIREMENTS
1. VAT Number Entry (FIRST STEP)
   - Input VAT number (any EU format)
   - "Verify VAT" button
   - Show loading state while checking VIES
   
   If VAT is VALID:
   - Auto-populate: Company name, Company address
   - Show "✓ VAT Verified" confirmation
   - Proceed to next step
   
   If VAT is INVALID:
   - Show "VAT not found in VIES database"
   - Offer two options:
     a) "Let us verify manually (48 hours)" → Add to manual verification queue
     b) "Create B2C account instead" → Redirect to B2C form
   - If choose manual: Show "We'll contact you within 48h to confirm"

2. Company Address Validation (if VIES successful)
   - Show address from VIES
   - Button: "Use this address" OR "Correct address"
   - If correcting: Run through Google Maps API
   - Show suggestions if needed
   - Store both VIES and validated address

3. Contact Person Info
   - First Name (required)
   - Last Name (required)
   - Email (required, validate same as B2C)
   - Phone (required, validate same as B2C)
   - Job Title (optional, e.g., "Procurement Manager")

4. Business Type Selection
   - Radio buttons for: Installer, Reseller, Distributor, Other
   - Show brief description for each
   - Use to segment customers later for marketing

5. Shipping Preferences
   - "Commercial vehicle shipping available at your address?" → Yes/No
   - "Preferred shipping method?" → DPD or GLS (save as default, changeable at checkout)
   - "Shipping address same as company address?" → Yes (copy) / No (enter different)

6. Website & Additional Info
   - Company website (optional)
   - Company phone (optional, different from contact person phone)
   - Number of employees (optional, helps segment)

7. Payment Method Preference
   - IMPORTANT NOTE: "We prefer Wise (instant, lowest fees) but accept all methods"
   - Checkboxes for available methods:
     - Wise (show: instant, 0.5-1% fee, can connect now or at checkout)
     - PayPal (show: accepted, 2.9% fee, can connect now or at checkout)
     - Stripe Cards (show: accepted, 2.9% + €0.30 fee, at checkout only)
     - SEPA/IBAN (show: free, 1-2 days, auto-debit, at checkout only)
   - NOTE: Items won't ship until payment cleared on our side
   - If Wise selected: Can connect account now (optional) or at checkout

8. Legal Agreements (same as B2C)
   - Terms & Conditions
   - Privacy Policy
   - B2B specific: "I certify this is a legitimate business"

9. Account Creation
   - Same loading states, error handling as B2C
   - Generate UUID on creation
   - Send confirmation email

10. Success State (B2B Dashboard)
    - Show company name prominently
    - Show VAT verified status badge
    - Show business type
    - Show default shipping method
    - Access to saved carts (can name them "Customer Name - Order #1")
    - Ability to create recurring orders

### DATA & FLOWS
- Input: VAT # → (VIES API) → Company Info → Contact Person → Shipping → Payment → Agreements
- Processing: VIES validation → Google Maps if needed → Send email/SMS → Create user
- Output: UUID generated → B2B dashboard
- Database:
  - customers table add columns: vat_number, vat_verified, vat_verified_at, 
    company_name, company_address, business_type, website, employees_count
  - payment_methods table: customer_id, method, connected, preferred
  - shipping_preferences table: customer_id, preferred_carrier (DPD/GLS), 
    commercial_vehicle_possible

### VALIDATION & RULES
- VAT must be validated against VIES (or manual verification pending)
- Company address must pass Google Maps validation
- Contact email must be verified via code
- Contact phone must be verified via SMS
- At least one payment method must be selected
- If VIES fails, must either accept manual verification OR create B2C account
- VAT number must be unique per customer

### UI/UX NOTES
- Show progress bar: "Step 1/8: Verify VAT"
- VAT step should look "official" (blue, slightly formal)
- When VIES returns data, highlight it as "Verified by EU system"
- Show helpful icons for each business type
- Payment method section: Show clear pricing comparison
- "Wise preferred" note should be prominent but not aggressive
- Mobile responsive

### EDGE CASES
- VIES API timeout → "Can't verify right now, try again in 5 minutes"
- VIES says invalid → Clear path to manual verification or B2C fallback
- Customer wants B2B but VIES fails → Don't block, show manual path
- Customer provides different address than VIES → Store both, ask which to use for shipping
- Payment method API unavailable → Skip for now, ask at checkout
- Someone tries to register with same VAT → Show "This VAT is already registered, login instead?"

### SUCCESS CRITERIA
- [ ] VAT verified against VIES successfully
- [ ] Company data auto-populated from VIES
- [ ] Address validated with Google Maps
- [ ] Contact person email verified
- [ ] Contact person phone verified
- [ ] Payment method preference saved
- [ ] Shipping preference saved
- [ ] Account created with UUID
- [ ] Admin can see B2B customer under Customers → B2B section
- [ ] B2B dashboard shows correct information

### DELIVERABLES
- [ ] React component: B2BRegistration.jsx (multi-step form)
- [ ] React component: VAT verification step (with VIES integration)
- [ ] Supabase schema updates
- [ ] API endpoints: /api/b2b/verify-vat, /api/b2b/register, plus all validation endpoints
- [ ] Payment method integration (Wise, PayPal, Stripe)
- [ ] Error handling for VIES failures
- [ ] Manual verification workflow documentation
```

---

### PROMPT #3: ADMIN DASHBOARD STRUCTURE

```
## TASK: Admin Dashboard Navigation & Layout

### CONTEXT
Admin needs to manage customers, products, payments, and business operations.
Must be organized but not overwhelming. Should follow your existing structure.

### CURRENT STATE
- You have customers (need to split B2C/B2B/Guests)
- You have products
- Payment processing happening
- Intrastat/Accounting needed

### REQUIREMENTS
1. Main Navigation (Left Sidebar)
   - Dashboard (home)
   - Customers
     - Guests
     - B2C
     - B2B
   - Products
   - Orders (add this!)
   - Suppliers
   - Accounting
     - Intrastat
     - VAT Reports
     - Invoicing
   - Marketing
     - Email Campaigns
     - Customer Segmentation
   - Settings
     - General
     - APIs
     - UUIDs

2. Customers Section
   - Guests subsection
     - List of guest checkouts (GuestXXX identifiers)
     - Email, phone, one-time purchases
     - No login capability
     - Can manually create if admin wants
   
   - B2C subsection
     - List of B2C accounts (UUID)
     - Name, email, phone, registration date
     - Click to open customer detail page
     - Can manually add customer if needed
     - Can search/filter
   
   - B2B subsection
     - List of B2B accounts (UUID)
     - Company name, VAT, contact name, business type
     - VAT verification status badge
     - Click to open customer detail page
     - Can manually add customer if needed
     - Can search/filter

3. Customers Detail Page
   - Personal/Company Info
   - Email + phone verification status
   - VAT status (B2B only)
   - Recent Orders (with links to order details)
   - Saved Carts (B2B can have multiple)
   - Shipping Addresses
   - Invoices
   - Payment Methods on file
   - Communication history (last emails, last contact)
   - Edit button for admin changes

4. Products Section
   - Keep existing product list
   - Before category list, add:
     - "Export Catalog" button (PDF, all products)
     - "Export Price List" button (Excel, current prices)
     - "Print" button (printer friendly)
   - Each product can be clicked
   - Under each product: Reviews section
     - Show all reviews with stars
     - Review author shows as: "Joh***" (first 3 letters + asterisks)
     - Admin button to moderate: approve/delete review
     - Admin can manually add review too
     - Sort by: newest, highest rated, most helpful

5. Orders Section (NEW)
   - List all orders
   - Filter by: status (pending, paid, shipped, delivered), date, customer
   - Click order to see detail
   - Show payment status, shipping status
   - Ability to manually adjust status if needed
   - Export orders to CSV/Excel

6. Suppliers Section (PLACEHOLDER)
   - List your suppliers (Thailand, China, etc.)
   - Their contact info
   - Lead times
   - This will grow later, for now just basic structure

7. Accounting Section
   - Intrastat subsection
     - Exports by country
     - HS codes for products
     - Country of origin
     - Country of purchase
     - Supplier VAT numbers
     - Calculate monthly totals for reporting
     - Export in required format for EU reporting
   
   - VAT Reports subsection
     - VAT collected vs VAT paid
     - By country
     - By quarter
     - Graphs
   
   - Invoicing subsection
     - Generate invoices
     - Download invoices
     - Invoice history

8. Marketing Section
   - Customer segments
     - By country
     - By business type (B2B: installer/reseller/distributor)
     - By purchase history
     - By opt-in status
   - Email campaigns
     - Create campaign
     - Select segment
     - Schedule send
     - Track opens/clicks
   - Promotional pricing rules
     - Apply to specific segments
     - Time-based or quantity-based

9. Settings Section
   - General Settings
     - Company info
     - Contact details
   
   - APIs subsection
     - List all APIs in use
     - Show status for each (✓ working / ✗ failed)
     - Test button for each API
     - Show last tested timestamp
     - APIs to list:
       - Google Maps API (address validation)
       - VIES SOAP (VAT verification)
       - Stripe (payments)
       - PayPal (payments)
       - Wise (payments)
       - SendGrid (emails)
       - SMS provider (SMS codes)
       - Supabase (database)
       - EasyPost (shipping)
   
   - UUIDs subsection (READ ONLY)
     - List all customer UUIDs ever created
     - Show: UUID, Customer Name, Customer Type (B2C/B2B/Guest), Created Date
     - Sortable by date
     - Searchable by UUID or name
     - Non-editable (view only)
     - Useful for creating contracts later

10. Dashboard Home
    - Welcome message
    - Key metrics: Total customers, Total revenue, Orders this month, Pending payments
    - Recent orders
    - Low stock alerts
    - Failed API alerts
    - Recent reviews to moderate

### UI/UX NOTES
- Clean, professional design
- Use consistent color scheme
- Icons for each navigation item
- Breadcrumb navigation (Dashboard > Customers > B2B > Company Name)
- Responsive (works on tablet for quick checks)
- Dark mode option appreciated by admins
- Quick search bar at top (search customers, products, orders)
- Success/error toasts for actions

### SUCCESS CRITERIA
- [ ] All navigation sections present
- [ ] Can navigate between sections smoothly
- [ ] Customer detail pages load correctly
- [ ] API status dashboard shows correct status
- [ ] UUID list is read-only and searchable
- [ ] Order list can be filtered and searched
- [ ] All links work

### DELIVERABLES
- [ ] Navigation structure (sidebar component)
- [ ] Layout template
- [ ] Routing configuration
- [ ] Placeholder pages for each section
- [ ] Data structure for each page
```

---

## 🎤 HOW TO USE THESE PROMPTS

### **Method 1: Direct Prompting** (for one feature)
```
Copy the exact prompt above
Add any modifications you need
Paste into Claude
Add: "Build this now, I'll check the result"
```

### **Method 2: Step by Step** (for complex features)
```
1. Send PROMPT #1 (B2C Registration)
   → Review result
   → Ask for adjustments if needed
   → Once happy, get code

2. Send PROMPT #2 (B2B Registration)
   → Review result
   → Ask for adjustments

3. Send PROMPT #3 (Admin Dashboard)
   → Review result
```

### **Method 3: Batch Execution** (fastest)
```
Send all 3 prompts in one message like:

"Build these in order:

TASK 1: [Paste Prompt #1]

TASK 2: [Paste Prompt #2]

TASK 3: [Paste Prompt #3]

Prioritize: B2C first (I'll test that), then B2B, then admin.
Start with B2C Registration component and API endpoints."
```

---

## ✏️ HOW TO MODIFY PROMPTS FOR YOUR NEEDS

**Want to change something?** Follow this pattern:

### Example 1: Change email validation
```
ORIGINAL:
"Email validation FIRST (validate human before asking other info)
- Send code to email (NO LINKS, just plain code)"

YOUR VERSION:
"Email validation FIRST
- Send code to email (NO LINKS)
- Allow max 3 attempts before blocking for 15 minutes"
```

### Example 2: Add new field
```
Add to REQUIREMENTS section:

"X. New Field Name
   - What it is
   - Why it matters
   - Validation rules
   - Where it's stored"
```

### Example 3: Change flow
```
Modify the DATA & FLOWS section:

ORIGINAL:
"- Input: Email → Phone → Personal Info..."

YOUR VERSION:
"- Input: Phone → Email → Personal Info..."
(This tells AI to reverse the order)
```

---

## 🚨 RED FLAGS: Signs Your Prompt Needs Work

**Vague prompt → AI asks you questions:**
- "What should happen if...?"
- "Should I use...?"
- "How many..."

**Solution:** Add that scenario to EDGE CASES section

---

## 💪 POWER TECHNIQUES

### Technique 1: Reference Existing Files
```
"Use the code structure from `/lib/supabase.js` for database calls.
Follow the pattern in `/api/auth/register` for error handling."
```

### Technique 2: Specify Exact Component Props
```
"Component should accept:
<AccountDashboard 
  customerId={uuid}
  userName={string}
  userType={'b2c'|'b2b'|'guest'}
  onLogout={function}
/>"
```

### Technique 3: Show Example Output
```
"When form validates, show:
{
  success: true,
  userId: 'uuid-xxx',
  nextStep: '/dashboard',
  message: 'Welcome, John!'
}"
```

### Technique 4: Specify Error Handling
```
"Error cases:
- Email already exists → Status 409, message: 'Email registered'
- VAT invalid → Status 400, message: 'VAT not verified'
- Server error → Status 500, log error, show generic message"
```

---

## 🎯 YOUR NEXT STEPS

1. **Customize these 3 prompts** with any changes specific to your platform
2. **Send them to Claude** in order (B2C → B2B → Admin)
3. **Review each piece** before moving to next
4. **Keep these prompts** - reuse them if you need changes later

Example message to Claude:
```
I have 3 development tasks. Build them in this order:

TASK 1 - B2C Account Creation [paste prompt #1]

TASK 2 - B2B Account Creation [paste prompt #2]

TASK 3 - Admin Dashboard [paste prompt #3]

Priority: Get B2C working first (fully functional). 
Then B2B. Then admin dashboard.

Start with B2C Registration component and all required API endpoints.
Include database schema updates.
```

---

## 📝 BONUS: CREATE YOUR OWN PROMPT TEMPLATE

For future features, use this structure:

```
## TASK: [Name]
### CONTEXT - [5 sentences explaining why this matters]
### CURRENT STATE - [What exists]
### REQUIREMENTS - [Numbered list with details]
### DATA & FLOWS - [Input/Processing/Output/Database]
### VALIDATION & RULES - [What must be true]
### UI/UX NOTES - [How it should look/feel]
### EDGE CASES - [What if...?]
### SUCCESS CRITERIA - [Checklist of working features]
### DELIVERABLES - [What code files you'll get]
```

This pattern works for ANY feature!

---

Good prompts = better results = less revision = faster shipping! 🚀
