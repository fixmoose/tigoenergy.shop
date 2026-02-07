# VIES Integration Instructions for AI Development

## 🎯 Overview

VIES validation will be integrated into the account registration flow. When a B2B customer registers, they enter their VAT number, which gets validated against the free EC VIES API. The returned data (company name, address) auto-populates the registration form. If VIES returns incomplete data (hidden by the company), customers can manually enter missing information.

---

## 📋 Registration Flow Architecture

```
1. Customer enters VAT number on registration form
   ↓
2. Real-time validation via /api/validate-vat
   ↓
3. If VALID:
   - Auto-populate: company name, address, country
   - Show confirmation of VIES data
   - Allow customer to override/edit fields
   - Apply B2B customer designation in database
   ↓
4. If INVALID:
   - Show error message
   - Offer two options:
     a) Try another VAT number
     b) Register as consumer (no VAT exemption)
   ↓
5. Save registration with VAT validation proof
```

---

## 🗄️ Database Schema (Supabase)

### customers Table (Add These Columns)

```sql
ALTER TABLE customers ADD COLUMN IF NOT EXISTS (
  -- B2B/Consumer identification
  customer_type VARCHAR(20) NOT NULL DEFAULT 'consumer', -- 'consumer' or 'b2b'
  
  -- VAT Information
  vat_number VARCHAR(50),
  vat_country_code VARCHAR(2),
  vat_validated BOOLEAN DEFAULT false,
  vat_validation_date TIMESTAMP,
  vat_request_identifier VARCHAR(100), -- From VIES response
  
  -- Company Information (from VIES or manual entry)
  company_name VARCHAR(255),
  company_address VARCHAR(500),
  company_city VARCHAR(100),
  company_country VARCHAR(100),
  
  -- Flags for data completion
  company_data_from_vies BOOLEAN DEFAULT false,
  company_data_complete BOOLEAN DEFAULT false,
  customer_provided_address_override BOOLEAN DEFAULT false,
  
  -- Audit trail
  vies_response_json JSONB, -- Store full VIES response for records
  registration_notes TEXT
);

-- Index for performance
CREATE INDEX idx_customers_vat_number ON customers(vat_number, vat_country_code);
CREATE INDEX idx_customers_customer_type ON customers(customer_type);
```

---

## 🔧 API Route Enhancement

### Path: `app/api/register/route.js`

```javascript
/**
 * POST /api/register
 * Handles customer registration with VIES validation
 * 
 * Request Body:
 * {
 *   email: string,
 *   password: string,
 *   firstName: string,
 *   lastName: string,
 *   vatId?: string,           // Optional - VAT number for B2B
 *   acceptManualEntry?: boolean, // If customer chooses to skip VIES
 *   manualCompanyData?: {      // If VIES incomplete or customer chooses manual
 *     companyName: string,
 *     address: string,
 *     city: string,
 *     country: string
 *   }
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   customerId: string,
 *   customerType: 'consumer' | 'b2b',
 *   viesValidation?: {
 *     valid: boolean,
 *     data: {...}
 *   },
 *   message: string
 * }
 */

import { createClient } from '@supabase/supabase-js';
import { validateVAT, parseVATId } from '@/lib/vies-integration';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const body = await request.json();
    
    const {
      email,
      password,
      firstName,
      lastName,
      vatId,
      acceptManualEntry,
      manualCompanyData
    } = body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return Response.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    let customerType = 'consumer';
    let viesValidation = null;
    let companyData = null;

    // === VIES VALIDATION BLOCK ===
    if (vatId && vatId.trim()) {
      try {
        // Parse and validate VAT number
        const { countryCode, vatNumber } = parseVATId(vatId);

        // Call VIES API
        const viesResponse = await validateVAT(countryCode, vatNumber);

        viesValidation = {
          valid: viesResponse.valid,
          requestIdentifier: viesResponse.requestIdentifier,
          rawResponse: viesResponse
        };

        if (viesResponse.valid) {
          customerType = 'b2b';
          
          // Auto-populate company data from VIES
          companyData = {
            companyName: viesResponse.name || '',
            address: viesResponse.address || '',
            city: '',
            country: viesResponse.countryCode,
            fromVies: true,
            dataComplete: viesResponse.name && viesResponse.address
          };

          // If VIES has incomplete data, allow customer to provide it
          if (!viesResponse.address || viesResponse.address === 'N/A') {
            companyData.needsManualAddress = true;
          }
        } else {
          // VAT invalid - check if customer accepts manual entry
          if (!acceptManualEntry) {
            return Response.json(
              {
                error: 'Invalid VAT number. Please try another or register as consumer.',
                viesValidation
              },
              { status: 400 }
            );
          }
          // Fall through to manual entry
        }

      } catch (viesError) {
        console.error('VIES validation error:', viesError);
        
        // VIES service error - don't block registration
        // but warn customer
        return Response.json(
          {
            error: 'Could not validate VAT number at this time. Please try again or register as consumer.',
            details: viesError.message
          },
          { status: 503 }
        );
      }
    }

    // === MANUAL DATA ENTRY BLOCK ===
    if (acceptManualEntry && manualCompanyData) {
      companyData = {
        ...manualCompanyData,
        fromVies: false,
        dataComplete: true,
        manuallyEntered: true
      };
      customerType = 'b2b'; // Still B2B if they provide company data
    }

    // === CREATE CUSTOMER IN SUPABASE ===
    
    // First, create auth user (using Supabase Auth)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false // Require email confirmation
    });

    if (authError) {
      return Response.json(
        { error: 'Failed to create account: ' + authError.message },
        { status: 400 }
      );
    }

    const userId = authData.user.id;

    // Then, create customer record
    const customerRecord = {
      id: userId,
      email,
      first_name: firstName,
      last_name: lastName,
      customer_type: customerType,
      
      // VAT fields (if B2B)
      vat_number: vatId ? parseVATId(vatId).vatNumber : null,
      vat_country_code: vatId ? parseVATId(vatId).countryCode : null,
      vat_validated: viesValidation?.valid || false,
      vat_validation_date: new Date().toISOString(),
      vat_request_identifier: viesValidation?.requestIdentifier,
      
      // Company fields
      company_name: companyData?.companyName || null,
      company_address: companyData?.address || null,
      company_city: companyData?.city || null,
      company_country: companyData?.country || null,
      
      // Data flags
      company_data_from_vies: companyData?.fromVies || false,
      company_data_complete: companyData?.dataComplete || false,
      customer_provided_address_override: companyData?.manuallyEntered || false,
      
      // Full VIES response for audit
      vies_response_json: viesValidation?.rawResponse || null,
      registration_notes: generateRegistrationNotes(
        customerType,
        viesValidation,
        companyData
      )
    };

    const { error: insertError } = await supabase
      .from('customers')
      .insert([customerRecord]);

    if (insertError) {
      // Clean up: delete the auth user if customer insert fails
      await supabase.auth.admin.deleteUser(userId);
      
      return Response.json(
        { error: 'Failed to save customer profile: ' + insertError.message },
        { status: 400 }
      );
    }

    // === SUCCESS RESPONSE ===
    return Response.json({
      success: true,
      customerId: userId,
      customerType,
      viesValidation,
      companyDataStatus: {
        populated: !!companyData,
        fromVies: companyData?.fromVies || false,
        needsManualAddress: companyData?.needsManualAddress || false
      },
      message: customerType === 'b2b'
        ? 'B2B account created. VAT exemption will apply to eligible transactions.'
        : 'Consumer account created.'
    });

  } catch (error) {
    console.error('Registration error:', error);
    return Response.json(
      { error: 'Registration failed: ' + error.message },
      { status: 500 }
    );
  }
}

function generateRegistrationNotes(customerType, viesValidation, companyData) {
  const notes = [];
  
  if (customerType === 'b2b') {
    notes.push(`B2B registration with VAT validation.`);
    
    if (viesValidation?.valid) {
      notes.push(`VAT validated successfully via VIES.`);
    }
    
    if (companyData?.fromVies) {
      notes.push(`Company data auto-populated from VIES.`);
    }
    
    if (companyData?.needsManualAddress) {
      notes.push(`Customer needs to provide address - not available in VIES.`);
    }
    
    if (companyData?.manuallyEntered) {
      notes.push(`Company data manually entered by customer.`);
    }
  }
  
  return notes.join(' ');
}
```

---

## 🎨 Registration Form Component

### Path: `components/RegisterForm.jsx`

```javascript
/**
 * Complete registration form with VIES integration
 * 
 * Features:
 * - Real-time VAT validation
 * - Auto-populate company data from VIES
 * - Manual entry option if VIES incomplete or invalid
 * - Shows VAT exemption eligibility
 * - Handles both consumer and B2B registration
 */

'use client';

import { useState } from 'react';
import VATValidator from './VATValidator';

export default function RegisterForm() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    customerType: 'consumer', // 'consumer' or 'b2b'
    vatId: '',
    companyName: '',
    companyAddress: '',
    companyCity: '',
    companyCountry: ''
  });

  const [viesData, setViesData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleViesValidation = (viesValidation) => {
    // This is called by VATValidator component when validation completes
    setViesData(viesValidation);

    if (viesValidation?.valid) {
      // Auto-populate company data from VIES
      setFormData(prev => ({
        ...prev,
        customerType: 'b2b',
        companyName: viesValidation.name || '',
        companyAddress: viesValidation.address || '',
        companyCountry: viesValidation.countryCode
      }));
      setShowManualEntry(false);
    }
  };

  const handleManualEntryClick = () => {
    setShowManualEntry(true);
    setFormData(prev => ({
      ...prev,
      customerType: 'b2b'
    }));
  };

  const handleRegisterAsConsumer = () => {
    setFormData(prev => ({
      ...prev,
      customerType: 'consumer',
      vatId: '',
      companyName: '',
      companyAddress: ''
    }));
    setViesData(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.customerType === 'b2b' && !viesData?.valid && !showManualEntry) {
      setError('Please validate VAT number or enter company data manually');
      setLoading(false);
      return;
    }

    try {
      const registrationPayload = {
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        vatId: formData.customerType === 'b2b' ? formData.vatId : null,
        acceptManualEntry: showManualEntry
      };

      if (showManualEntry) {
        registrationPayload.manualCompanyData = {
          companyName: formData.companyName,
          address: formData.companyAddress,
          city: formData.companyCity,
          country: formData.companyCountry
        };
      }

      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registrationPayload)
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Registration failed');
        return;
      }

      setSuccess(true);
      // Redirect or show success message
      console.log('Registration successful:', data);

    } catch (err) {
      setError('Registration failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-form-container">
      <form onSubmit={handleSubmit} className="register-form">
        <h1>Create Account</h1>

        {error && <div className="error-box">{error}</div>}
        {success && <div className="success-box">Account created successfully!</div>}

        {/* Personal Information Section */}
        <fieldset>
          <legend>Personal Information</legend>

          <div className="form-group">
            <label htmlFor="firstName">First Name *</label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              required
              value={formData.firstName}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="lastName">Last Name *</label>
            <input
              id="lastName"
              name="lastName"
              type="text"
              required
              value={formData.lastName}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password *</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password *</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
              disabled={loading}
            />
          </div>
        </fieldset>

        {/* VAT & Company Section */}
        <fieldset>
          <legend>Business Information</legend>
          <p className="section-help">
            Optional for consumers. B2B customers can benefit from VAT exemptions on intra-EU transactions.
          </p>

          {/* VAT Validator Component */}
          <div className="vat-section">
            <h3>Validate EU VAT Number (B2B)</h3>
            <VATValidator
              onValidation={handleViesValidation}
              disabled={formData.customerType === 'consumer'}
            />
          </div>

          {/* VIES Response - Show validation status */}
          {viesData && (
            <div className={`vies-status ${viesData.valid ? 'valid' : 'invalid'}`}>
              {viesData.valid ? (
                <>
                  <h4>✓ VAT Validated</h4>
                  <p className="company-name">{viesData.name}</p>
                  <p className="company-address">{viesData.address}</p>
                  
                  {(!viesData.address || viesData.address === 'N/A') && (
                    <div className="notice">
                      ℹ️ Address not available in VIES. 
                      <button
                        type="button"
                        onClick={handleManualEntryClick}
                        className="link-button"
                      >
                        Enter address manually
                      </button>
                    </div>
                  )}

                  <div className="vat-benefits">
                    <strong>✓ VAT Exemption Eligible</strong>
                    <p>Your B2B account qualifies for VAT exemption on intra-EU transactions.</p>
                  </div>

                  <button
                    type="button"
                    onClick={handleRegisterAsConsumer}
                    className="secondary-button"
                  >
                    Register as Consumer Instead
                  </button>
                </>
              ) : (
                <>
                  <h4>✗ Invalid VAT Number</h4>
                  <p>This VAT number could not be verified.</p>
                  
                  <div className="manual-entry-options">
                    <p>You can:</p>
                    <button
                      type="button"
                      onClick={handleManualEntryClick}
                      className="secondary-button"
                    >
                      Enter Company Data Manually
                    </button>
                    <button
                      type="button"
                      onClick={handleRegisterAsConsumer}
                      className="secondary-button"
                    >
                      Register as Consumer (No VAT Number)
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Manual Company Data Entry */}
          {showManualEntry && (
            <div className="manual-entry-section">
              <h4>Enter Company Information</h4>
              <p className="section-help">
                Since VIES data is incomplete or unavailable, please provide the following:
              </p>

              <div className="form-group">
                <label htmlFor="companyName">Company Name *</label>
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  required
                  value={formData.companyName}
                  onChange={handleChange}
                  disabled={loading}
                  placeholder="Your company legal name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="companyAddress">Street Address *</label>
                <input
                  id="companyAddress"
                  name="companyAddress"
                  type="text"
                  required
                  value={formData.companyAddress}
                  onChange={handleChange}
                  disabled={loading}
                  placeholder="Street and number"
                />
              </div>

              <div className="form-group">
                <label htmlFor="companyCity">City *</label>
                <input
                  id="companyCity"
                  name="companyCity"
                  type="text"
                  required
                  value={formData.companyCity}
                  onChange={handleChange}
                  disabled={loading}
                  placeholder="City"
                />
              </div>

              <div className="form-group">
                <label htmlFor="companyCountry">Country *</label>
                <input
                  id="companyCountry"
                  name="companyCountry"
                  type="text"
                  required
                  value={formData.companyCountry}
                  onChange={handleChange}
                  disabled={loading}
                  placeholder="Country"
                />
              </div>
            </div>
          )}
        </fieldset>

        <button type="submit" disabled={loading} className="submit-button">
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>

      <style jsx>{`
        .register-form-container {
          max-width: 600px;
          margin: 40px auto;
          padding: 20px;
        }

        .register-form {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          padding: 30px;
        }

        h1 {
          margin-top: 0;
          color: #333;
        }

        fieldset {
          border: none;
          padding: 0;
          margin: 30px 0;
        }

        legend {
          font-size: 18px;
          font-weight: 600;
          color: #333;
          margin-bottom: 16px;
        }

        .section-help {
          color: #666;
          font-size: 14px;
          margin-bottom: 20px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          color: #333;
        }

        input {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        input:focus {
          outline: none;
          border-color: #4f46e5;
          box-shadow: 0 0 0 3px rgba(79,70,229,0.1);
        }

        input:disabled {
          background-color: #f5f5f5;
        }

        .error-box {
          background-color: #fee;
          color: #c00;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 20px;
          border-left: 4px solid #c00;
        }

        .success-box {
          background-color: #efe;
          color: #060;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 20px;
          border-left: 4px solid #060;
        }

        .vat-section {
          margin-bottom: 30px;
          padding: 20px;
          background-color: #f9f9f9;
          border-radius: 6px;
        }

        .vat-section h3 {
          margin-top: 0;
          color: #333;
        }

        .vies-status {
          padding: 20px;
          border-radius: 6px;
          margin: 20px 0;
        }

        .vies-status.valid {
          background-color: #f1f8f4;
          border: 2px solid #4caf50;
        }

        .vies-status.invalid {
          background-color: #fdeae8;
          border: 2px solid #f44336;
        }

        .vies-status h4 {
          margin-top: 0;
          color: inherit;
        }

        .company-name {
          font-weight: 600;
          font-size: 16px;
          margin: 8px 0;
        }

        .company-address {
          color: #666;
          font-size: 14px;
          margin: 4px 0;
        }

        .notice,
        .manual-entry-options {
          background-color: rgba(255,255,255,0.6);
          padding: 12px;
          border-radius: 4px;
          margin: 12px 0;
          font-size: 14px;
        }

        .link-button {
          background: none;
          border: none;
          color: #4f46e5;
          text-decoration: underline;
          cursor: pointer;
          padding: 0;
          margin-left: 4px;
        }

        .link-button:hover {
          color: #3d35c7;
        }

        .vat-benefits {
          background-color: rgba(76,175,80,0.1);
          padding: 12px;
          border-radius: 4px;
          margin: 12px 0;
        }

        .vat-benefits strong {
          color: #2e7d32;
        }

        .vat-benefits p {
          margin: 6px 0 0 0;
          color: #555;
          font-size: 14px;
        }

        .manual-entry-section {
          padding: 20px;
          background-color: #fffbf0;
          border: 2px solid #ff9800;
          border-radius: 6px;
          margin: 20px 0;
        }

        .manual-entry-section h4 {
          margin-top: 0;
          color: #e65100;
        }

        .secondary-button {
          background-color: #f5f5f5;
          border: 1px solid #ddd;
          color: #333;
          padding: 10px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin-right: 8px;
          margin-top: 8px;
          font-size: 14px;
        }

        .secondary-button:hover {
          background-color: #eee;
        }

        .submit-button {
          width: 100%;
          padding: 12px;
          background-color: #4f46e5;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 20px;
        }

        .submit-button:hover:not(:disabled) {
          background-color: #3d35c7;
        }

        .submit-button:disabled {
          background-color: #ccc;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
```

---

## 🔄 Update VATValidator Component

### Modification for RegisterForm Integration

Add these props to the VATValidator component in `components/VATValidator.jsx`:

```javascript
export default function VATValidator({ onValidation, disabled }) {
  // ... existing code ...

  const validateVAT = async (vatId) => {
    if (!vatId || vatId.length < 4) {
      setValidation(null);
      if (onValidation) onValidation(null);
      return;
    }

    // ... existing validation code ...

    setValidation(data);
    setError(null);
    
    // Call parent callback with validation data
    if (onValidation) {
      onValidation(data);
    }
  };

  return (
    <div className="vat-validator">
      <input
        id="vat-input"
        type="text"
        placeholder="e.g., DE123456789"
        value={vatInput}
        onChange={handleInputChange}
        disabled={loading || disabled}  // Add disabled prop
        // ... rest of props ...
      />
      {/* ... rest of component ... */}
    </div>
  );
}
```

---

## 📊 Customer Profile Update Flow

### Path: `app/api/customers/[id]/update-profile/route.js`

```javascript
/**
 * PUT /api/customers/[id]/update-profile
 * Allows customers to update company information after registration
 * 
 * Use case: Customer originally registered without VAT, now wants to add it
 * Or: Customer wants to update company address from VIES data
 */

import { createClient } from '@supabase/supabase-js';
import { validateVAT, parseVATId } from '@/lib/vies-integration';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function PUT(request, { params }) {
  const customerId = params.id;

  try {
    const body = await request.json();
    const { vatId, companyName, companyAddress, companyCity, companyCountry } = body;

    const updateData = {};

    // If VAT ID provided, validate it
    if (vatId) {
      const { countryCode, vatNumber } = parseVATId(vatId);
      const viesResponse = await validateVAT(countryCode, vatNumber);

      if (viesResponse.valid) {
        updateData.vat_number = vatNumber;
        updateData.vat_country_code = countryCode;
        updateData.vat_validated = true;
        updateData.vat_validation_date = new Date().toISOString();
        updateData.vies_response_json = viesResponse;
        updateData.customer_type = 'b2b';

        // Auto-populate from VIES if not overridden
        if (!companyName && viesResponse.name) {
          updateData.company_name = viesResponse.name;
          updateData.company_data_from_vies = true;
        }
      } else {
        return Response.json(
          { error: 'VAT number validation failed' },
          { status: 400 }
        );
      }
    }

    // Manual company data
    if (companyName) updateData.company_name = companyName;
    if (companyAddress) updateData.company_address = companyAddress;
    if (companyCity) updateData.company_city = companyCity;
    if (companyCountry) updateData.company_country = companyCountry;

    if (companyName && companyAddress && companyCity && companyCountry) {
      updateData.company_data_complete = true;
    }

    const { error } = await supabase
      .from('customers')
      .update(updateData)
      .eq('id', customerId);

    if (error) throw error;

    return Response.json({ success: true, updatedFields: updateData });

  } catch (error) {
    console.error('Profile update error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

---

## 📋 Database Queries Reference

### Get all B2B customers with valid VAT
```sql
SELECT * FROM customers 
WHERE customer_type = 'b2b' 
AND vat_validated = true 
AND company_data_complete = true;
```

### Find customers needing address follow-up
```sql
SELECT * FROM customers 
WHERE customer_type = 'b2b' 
AND company_data_from_vies = true 
AND (company_address IS NULL OR company_address = '');
```

### Check VAT validation history for customer
```sql
SELECT 
  vat_number,
  vat_country_code,
  vat_validation_date,
  vies_response_json
FROM customers 
WHERE id = 'customer_id'
AND vat_validated = true;
```

---

## 🔐 Security Considerations

1. **Email Verification**: Always send confirmation email before activating account
2. **GDPR Compliance**: Store VIES response in `vies_response_json` for audit trail
3. **Rate Limiting**: Implement rate limiting on `/api/register` to prevent abuse
4. **VAT Data Privacy**: 
   - Don't expose request identifiers in frontend responses
   - Log all validations for tax compliance
   - Regularly audit and clean old VIES responses (consider 90-day retention)

---

## 🧪 Testing Instructions for AI

When implementing, AI should:

1. **Test Valid VAT**: Use `IE6388047V` (Irish example) - should populate all fields
2. **Test Invalid VAT**: Use `DE000000000` - should show error, offer manual entry
3. **Test VIES Offline**: Simulate API failure - should fallback to manual entry
4. **Test Manual Entry**: Complete registration with manual company data
5. **Test Consumer Registration**: Skip VAT entirely, register as consumer
6. **Test B2B Features**: Verify `customer_type = 'b2b'` saves correctly
7. **Test Data Persistence**: Check Supabase that all fields save correctly

---

## 📝 Documentation for End Users

Create a help article:
- "What is VAT and why do we ask for it?"
- "How do we use your VAT information?"
- "What if your address isn't showing in our system?"
- "Can you change your company information later?"

---

## ✅ Implementation Checklist for AI

- [ ] Create database schema with all VAT columns
- [ ] Implement `/api/register` endpoint with VIES validation
- [ ] Create `RegisterForm.jsx` component
- [ ] Update `VATValidator.jsx` with callback support
- [ ] Implement `/api/customers/[id]/update-profile` endpoint
- [ ] Test with real VAT numbers
- [ ] Test with VIES API failures
- [ ] Add email verification flow
- [ ] Create customer profile page showing VAT status
- [ ] Add admin dashboard to view customer VAT data
- [ ] Document VAT data retention policy
- [ ] Set up logging for VAT validations

---

## 🎯 AI Instructions Summary

When Claude (or another AI) implements this:

1. Start with database schema migration
2. Build `/api/register` with full VIES integration
3. Create responsive `RegisterForm` component
4. Implement update profile endpoint
5. Add proper error handling and logging
6. Test all flows (valid, invalid, offline, manual)
7. Document any changes or customizations

The flow is: **Register → Validate VAT → Auto-populate → Save → Future access to VAT data**
