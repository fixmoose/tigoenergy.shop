/**
 * Next.js API Route: /api/validate-vat
 * Validates EU VAT numbers using the FREE official EC VIES system
 * 
 * Usage:
 * POST /api/validate-vat
 * Body: { vatId: "DE123456789" } or { countryCode: "DE", vatNumber: "123456789" }
 */

import soap from 'soap';

const VIES_WSDL = 'https://ec.europa.eu/taxation_customs/vies/checkVatService.wsdl';

// Helper to parse full VAT ID
function parseVATId(fullVATId) {
  const cleaned = fullVATId.replace(/\s/g, '').toUpperCase();
  return {
    countryCode: cleaned.substring(0, 2),
    vatNumber: cleaned.substring(2)
  };
}

// Cache to reduce API calls (optional - uses in-memory cache)
const vatCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export async function POST(request) {
  try {
    const body = await request.json();
    
    let countryCode, vatNumber;
    
    // Support both formats: { vatId: "DE123456789" } or { countryCode: "DE", vatNumber: "123456789" }
    if (body.vatId) {
      const parsed = parseVATId(body.vatId);
      countryCode = parsed.countryCode;
      vatNumber = parsed.vatNumber;
    } else if (body.countryCode && body.vatNumber) {
      countryCode = body.countryCode.toUpperCase();
      vatNumber = body.vatNumber.replace(/[^A-Za-z0-9]/g, '');
    } else {
      return Response.json(
        { error: 'Invalid request. Provide either vatId or countryCode + vatNumber' },
        { status: 400 }
      );
    }
    
    // Check cache
    const cacheKey = `${countryCode}${vatNumber}`;
    if (vatCache.has(cacheKey)) {
      const cached = vatCache.get(cacheKey);
      if (Date.now() - cached.cachedAt < CACHE_DURATION) {
        return Response.json({
          ...cached.data,
          cached: true,
          cachedAt: cached.cachedAt
        });
      }
    }
    
    // Validate input
    if (!countryCode || countryCode.length !== 2) {
      return Response.json(
        { error: 'Invalid country code. Use 2-letter code (e.g., DE, FR, IT)' },
        { status: 400 }
      );
    }
    
    if (!vatNumber || vatNumber.length < 2) {
      return Response.json(
        { error: 'Invalid VAT number' },
        { status: 400 }
      );
    }
    
    // Create SOAP client from official EC WSDL
    const client = await soap.createClientAsync(VIES_WSDL);
    
    // Call the checkVat method
    const result = await client.checkVatAsync({
      countryCode: countryCode,
      vatNumber: vatNumber
    });
    
    const [checkVatResponse] = result;
    
    const response = {
      valid: checkVatResponse.valid === true,
      countryCode: checkVatResponse.countryCode,
      vatNumber: checkVatResponse.vatNumber,
      requestDate: checkVatResponse.requestDate,
      name: checkVatResponse.name || 'Not provided',
      address: checkVatResponse.address || 'Not provided',
      requestIdentifier: checkVatResponse.requestIdentifier,
      timestamp: new Date().toISOString(),
      source: 'EC VIES Official API (FREE)',
      cached: false
    };
    
    // Cache the result
    vatCache.set(cacheKey, {
      data: response,
      cachedAt: Date.now()
    });
    
    return Response.json(response);
    
  } catch (error) {
    console.error('VIES validation error:', error.message);
    
    return Response.json(
      {
        valid: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        source: 'EC VIES Official API (FREE)'
      },
      { status: 500 }
    );
  }
}

// Optional: GET endpoint for testing
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const vatId = searchParams.get('vatId');
  
  if (!vatId) {
    return Response.json(
      { 
        error: 'Missing vatId parameter',
        example: '/api/validate-vat?vatId=DE123456789'
      },
      { status: 400 }
    );
  }
  
  // Redirect to POST with vatId
  return POST(
    new Request(request, {
      method: 'POST',
      body: JSON.stringify({ vatId })
    })
  );
}
