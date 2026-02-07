/**
 * VIES VAT Validation Integration for Next.js
 * Uses the FREE official European Commission VIES SOAP API
 * No payment required - completely free to use
 */

// Install dependencies:
// npm install soap axios

import soap from 'soap';

const VIES_WSDL = 'https://ec.europa.eu/taxation_customs/vies/checkVatService.wsdl';

/**
 * Validates an EU VAT number against the free EC VIES system
 * @param {string} countryCode - 2-letter country code (e.g., 'DE', 'FR', 'IT')
 * @param {string} vatNumber - VAT number without country code
 * @returns {object} Validation result with company details
 */
export async function validateVAT(countryCode, vatNumber) {
  try {
    // Create SOAP client from official EC WSDL
    const client = await soap.createClientAsync(VIES_WSDL);
    
    // Clean input - remove spaces and special characters
    const cleanVAT = vatNumber.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    const cleanCountry = countryCode.toUpperCase();
    
    // Call the checkVat method
    const result = await client.checkVatAsync({
      countryCode: cleanCountry,
      vatNumber: cleanVAT
    });
    
    // Extract response
    const [checkVatResponse] = result;
    
    return {
      valid: checkVatResponse.valid === true,
      countryCode: checkVatResponse.countryCode,
      vatNumber: checkVatResponse.vatNumber,
      requestDate: checkVatResponse.requestDate,
      name: checkVatResponse.name || 'N/A',
      address: checkVatResponse.address || 'N/A',
      requestIdentifier: checkVatResponse.requestIdentifier,
      timestamp: new Date().toISOString(),
      source: 'EC VIES Official API'
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      source: 'EC VIES Official API'
    };
  }
}

/**
 * Extract country code and VAT number from full VAT ID
 * Examples: DE123456789, FR12345678901, IT12345678901
 * @param {string} fullVATId - Complete VAT ID with country code
 * @returns {object} { countryCode, vatNumber }
 */
export function parseVATId(fullVATId) {
  const cleaned = fullVATId.replace(/\s/g, '').toUpperCase();
  const countryCode = cleaned.substring(0, 2);
  const vatNumber = cleaned.substring(2);
  
  return {
    countryCode,
    vatNumber,
    fullVATId: cleaned
  };
}
