// Multi-country market configuration
// Single source of truth: domain → market → language, currency, VAT, locale

export interface MarketConfig {
    key: string              // Market identifier (e.g. 'SI', 'DE', 'CH', 'SHOP')
    country: string          // ISO 3166-1 alpha-2 country code
    countryName: string      // English country name
    defaultLanguage: string  // ISO 639-1 language code
    availableLanguages: string[] // Languages available for this market
    currency: string         // Currency code (EUR, CHF, GBP, etc.)
    vatRate: number          // National VAT rate as decimal (0.22 = 22%)
    isEU: boolean
    locale: string           // Intl locale for number/date formatting
    flag: string             // Flag emoji
    supplierCountry: string  // Fulfillment origin for compliance
    hasLanguagePicker: boolean
    hasCurrencyPicker: boolean
}

export const MARKETS: Record<string, MarketConfig> = {
    SI: {
        key: 'SI',
        country: 'SI',
        countryName: 'Slovenia',
        defaultLanguage: 'sl',
        availableLanguages: ['sl'],
        currency: 'EUR',
        vatRate: 0.22,
        isEU: true,
        locale: 'sl-SI',
        flag: '🇸🇮',
        supplierCountry: 'SI',
        hasLanguagePicker: false,
        hasCurrencyPicker: false,
    },
    DE: {
        key: 'DE',
        country: 'DE',
        countryName: 'Germany',
        defaultLanguage: 'de',
        availableLanguages: ['de'],
        currency: 'EUR',
        vatRate: 0.19,
        isEU: true,
        locale: 'de-DE',
        flag: '🇩🇪',
        supplierCountry: 'SI',
        hasLanguagePicker: false,
        hasCurrencyPicker: false,
    },
    FR: {
        key: 'FR',
        country: 'FR',
        countryName: 'France',
        defaultLanguage: 'fr',
        availableLanguages: ['fr'],
        currency: 'EUR',
        vatRate: 0.20,
        isEU: true,
        locale: 'fr-FR',
        flag: '🇫🇷',
        supplierCountry: 'SI',
        hasLanguagePicker: false,
        hasCurrencyPicker: false,
    },
    IT: {
        key: 'IT',
        country: 'IT',
        countryName: 'Italy',
        defaultLanguage: 'it',
        availableLanguages: ['it'],
        currency: 'EUR',
        vatRate: 0.22,
        isEU: true,
        locale: 'it-IT',
        flag: '🇮🇹',
        supplierCountry: 'SI',
        hasLanguagePicker: false,
        hasCurrencyPicker: false,
    },
    ES: {
        key: 'ES',
        country: 'ES',
        countryName: 'Spain',
        defaultLanguage: 'es',
        availableLanguages: ['es'],
        currency: 'EUR',
        vatRate: 0.21,
        isEU: true,
        locale: 'es-ES',
        flag: '🇪🇸',
        supplierCountry: 'SI',
        hasLanguagePicker: false,
        hasCurrencyPicker: false,
    },
    AT: {
        key: 'AT',
        country: 'AT',
        countryName: 'Austria',
        defaultLanguage: 'de',
        availableLanguages: ['de'],
        currency: 'EUR',
        vatRate: 0.20,
        isEU: true,
        locale: 'de-AT',
        flag: '🇦🇹',
        supplierCountry: 'SI',
        hasLanguagePicker: false,
        hasCurrencyPicker: false,
    },
    CH: {
        key: 'CH',
        country: 'CH',
        countryName: 'Switzerland',
        defaultLanguage: 'de',
        availableLanguages: ['de', 'fr', 'it'],
        currency: 'CHF',
        vatRate: 0.081,
        isEU: false,
        locale: 'de-CH',
        flag: '🇨🇭',
        supplierCountry: 'SI',
        hasLanguagePicker: true,
        hasCurrencyPicker: false,
    },
    BE: {
        key: 'BE',
        country: 'BE',
        countryName: 'Belgium',
        defaultLanguage: 'nl',
        availableLanguages: ['nl'],
        currency: 'EUR',
        vatRate: 0.21,
        isEU: true,
        locale: 'nl-BE',
        flag: '🇧🇪',
        supplierCountry: 'SI',
        hasLanguagePicker: false,
        hasCurrencyPicker: false,
    },
    PL: {
        key: 'PL',
        country: 'PL',
        countryName: 'Poland',
        defaultLanguage: 'pl',
        availableLanguages: ['pl'],
        currency: 'PLN',
        vatRate: 0.23,
        isEU: true,
        locale: 'pl-PL',
        flag: '🇵🇱',
        supplierCountry: 'SI',
        hasLanguagePicker: false,
        hasCurrencyPicker: false,
    },
    CZ: {
        key: 'CZ',
        country: 'CZ',
        countryName: 'Czech Republic',
        defaultLanguage: 'cs',
        availableLanguages: ['cs'],
        currency: 'CZK',
        vatRate: 0.21,
        isEU: true,
        locale: 'cs-CZ',
        flag: '🇨🇿',
        supplierCountry: 'SI',
        hasLanguagePicker: false,
        hasCurrencyPicker: false,
    },
    SK: {
        key: 'SK',
        country: 'SK',
        countryName: 'Slovakia',
        defaultLanguage: 'sk',
        availableLanguages: ['sk'],
        currency: 'EUR',
        vatRate: 0.23,
        isEU: true,
        locale: 'sk-SK',
        flag: '🇸🇰',
        supplierCountry: 'SI',
        hasLanguagePicker: false,
        hasCurrencyPicker: false,
    },
    HR: {
        key: 'HR',
        country: 'HR',
        countryName: 'Croatia',
        defaultLanguage: 'hr',
        availableLanguages: ['hr'],
        currency: 'EUR',
        vatRate: 0.25,
        isEU: true,
        locale: 'hr-HR',
        flag: '🇭🇷',
        supplierCountry: 'SI',
        hasLanguagePicker: false,
        hasCurrencyPicker: false,
    },
    SE: {
        key: 'SE',
        country: 'SE',
        countryName: 'Sweden',
        defaultLanguage: 'sv',
        availableLanguages: ['sv'],
        currency: 'SEK',
        vatRate: 0.25,
        isEU: true,
        locale: 'sv-SE',
        flag: '🇸🇪',
        supplierCountry: 'SI',
        hasLanguagePicker: false,
        hasCurrencyPicker: false,
    },
    DK: {
        key: 'DK',
        country: 'DK',
        countryName: 'Denmark',
        defaultLanguage: 'da',
        availableLanguages: ['da'],
        currency: 'DKK',
        vatRate: 0.25,
        isEU: true,
        locale: 'da-DK',
        flag: '🇩🇰',
        supplierCountry: 'SI',
        hasLanguagePicker: false,
        hasCurrencyPicker: false,
    },
    RO: {
        key: 'RO',
        country: 'RO',
        countryName: 'Romania',
        defaultLanguage: 'ro',
        availableLanguages: ['ro'],
        currency: 'RON',
        vatRate: 0.19,
        isEU: true,
        locale: 'ro-RO',
        flag: '🇷🇴',
        supplierCountry: 'SI',
        hasLanguagePicker: false,
        hasCurrencyPicker: false,
    },
    RS: {
        key: 'RS',
        country: 'RS',
        countryName: 'Serbia',
        defaultLanguage: 'sr',
        availableLanguages: ['sr', 'sr-Cyrl'],
        currency: 'RSD',
        vatRate: 0.20,
        isEU: false,
        locale: 'sr-RS',
        flag: '🇷🇸',
        supplierCountry: 'SI',
        hasLanguagePicker: true,
        hasCurrencyPicker: false,
    },
    MK: {
        key: 'MK',
        country: 'MK',
        countryName: 'North Macedonia',
        defaultLanguage: 'mk',
        availableLanguages: ['mk'],
        currency: 'MKD',
        vatRate: 0.18,
        isEU: false,
        locale: 'mk-MK',
        flag: '🇲🇰',
        supplierCountry: 'SI',
        hasLanguagePicker: false,
        hasCurrencyPicker: false,
    },
    ME: {
        key: 'ME',
        country: 'ME',
        countryName: 'Montenegro',
        defaultLanguage: 'sr',
        availableLanguages: ['sr', 'sr-Cyrl'],
        currency: 'EUR',
        vatRate: 0.21,
        isEU: false,
        locale: 'sr-ME',
        flag: '🇲🇪',
        supplierCountry: 'SI',
        hasLanguagePicker: true,
        hasCurrencyPicker: false,
    },
    BG: {
        key: 'BG',
        country: 'BG',
        countryName: 'Bulgaria',
        defaultLanguage: 'bg',
        availableLanguages: ['bg'],
        currency: 'BGN',
        vatRate: 0.20,
        isEU: true,
        locale: 'bg-BG',
        flag: '🇧🇬',
        supplierCountry: 'SI',
        hasLanguagePicker: false,
        hasCurrencyPicker: false,
    },
    NO: {
        key: 'NO',
        country: 'NO',
        countryName: 'Norway',
        defaultLanguage: 'no',
        availableLanguages: ['no'],
        currency: 'NOK',
        vatRate: 0.25,
        isEU: false,
        locale: 'nb-NO',
        flag: '🇳🇴',
        supplierCountry: 'SI',
        hasLanguagePicker: false,
        hasCurrencyPicker: false,
    },
    HU: {
        key: 'HU',
        country: 'HU',
        countryName: 'Hungary',
        defaultLanguage: 'hu',
        availableLanguages: ['hu'],
        currency: 'HUF',
        vatRate: 0.27,
        isEU: true,
        locale: 'hu-HU',
        flag: '🇭🇺',
        supplierCountry: 'SI',
        hasLanguagePicker: false,
        hasCurrencyPicker: false,
    },
    PT: {
        key: 'PT',
        country: 'PT',
        countryName: 'Portugal',
        defaultLanguage: 'pt',
        availableLanguages: ['pt'],
        currency: 'EUR',
        vatRate: 0.23,
        isEU: true,
        locale: 'pt-PT',
        flag: '🇵🇹',
        supplierCountry: 'SI',
        hasLanguagePicker: false,
        hasCurrencyPicker: false,
    },
    LV: {
        key: 'LV',
        country: 'LV',
        countryName: 'Latvia',
        defaultLanguage: 'lv',
        availableLanguages: ['lv'],
        currency: 'EUR',
        vatRate: 0.21,
        isEU: true,
        locale: 'lv-LV',
        flag: '🇱🇻',
        supplierCountry: 'SI',
        hasLanguagePicker: false,
        hasCurrencyPicker: false,
    },
    LT: {
        key: 'LT',
        country: 'LT',
        countryName: 'Lithuania',
        defaultLanguage: 'lt',
        availableLanguages: ['lt'],
        currency: 'EUR',
        vatRate: 0.21,
        isEU: true,
        locale: 'lt-LT',
        flag: '🇱🇹',
        supplierCountry: 'SI',
        hasLanguagePicker: false,
        hasCurrencyPicker: false,
    },
    EE: {
        key: 'EE',
        country: 'EE',
        countryName: 'Estonia',
        defaultLanguage: 'et',
        availableLanguages: ['et'],
        currency: 'EUR',
        vatRate: 0.22,
        isEU: true,
        locale: 'et-EE',
        flag: '🇪🇪',
        supplierCountry: 'SI',
        hasLanguagePicker: false,
        hasCurrencyPicker: false,
    },
    GB: {
        key: 'GB',
        country: 'GB',
        countryName: 'United Kingdom',
        defaultLanguage: 'en',
        availableLanguages: ['en'],
        currency: 'GBP',
        vatRate: 0.20,
        isEU: false,
        locale: 'en-GB',
        flag: '🇬🇧',
        supplierCountry: 'SI',
        hasLanguagePicker: false,
        hasCurrencyPicker: false,
    },
    EU: {
        key: 'EU',
        country: 'EU',
        countryName: 'European Union',
        defaultLanguage: 'en',
        availableLanguages: ['en', 'de', 'fr', 'it', 'es', 'nl', 'pl', 'cs', 'sl', 'hr', 'sk', 'sv', 'da', 'ro', 'sr', 'sr-Cyrl', 'mk', 'bg', 'no', 'hu', 'pt', 'lv', 'lt', 'et'],
        currency: 'EUR',
        vatRate: 0.22,
        isEU: true,
        locale: 'en-IE',
        flag: '🇪🇺',
        supplierCountry: 'SI',
        hasLanguagePicker: true,
        hasCurrencyPicker: true,
    },
    SHOP: {
        key: 'SHOP',
        country: 'EU',
        countryName: 'Tigo Energy Shop',
        defaultLanguage: 'en',
        availableLanguages: ['en', 'de', 'fr', 'it', 'es', 'nl', 'pl', 'cs', 'sl', 'hr', 'sk', 'sv', 'da', 'ro', 'sr', 'sr-Cyrl', 'mk', 'bg', 'no', 'hu', 'pt', 'lv', 'lt', 'et'],
        currency: 'EUR',
        vatRate: 0.22,
        isEU: true,
        locale: 'en-IE',
        flag: '🛒',
        supplierCountry: 'SI',
        hasLanguagePicker: true,
        hasCurrencyPicker: true,
    },
}

export const EU_COUNTRY_CODES = [
    'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU',
    'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'
]

// Domain → market key mapping
// Includes all registered tigoenergy.* and tigo-energy.* domains
const DOMAIN_TO_MARKET: Record<string, string> = {
    // tigoenergy.* primary domains
    'tigoenergy.si': 'SI',
    'tigoenergy.de': 'DE',
    'tigoenergy.fr': 'FR',
    'tigoenergy.it': 'IT',
    'tigoenergy.es': 'ES',
    'tigoenergy.at': 'AT',
    'tigoenergy.ch': 'CH',
    'tigoenergy.be': 'BE',
    'tigoenergy.pl': 'PL',
    'tigoenergy.cz': 'CZ',
    'tigoenergy.sk': 'SK',
    'tigoenergy.hr': 'HR',
    'tigoenergy.se': 'SE',
    'tigoenergy.dk': 'DK',
    'tigoenergy.ro': 'RO',
    'tigoenergy.rs': 'RS',
    'tigoenergy.mk': 'MK',
    'tigoenergy.me': 'ME',
    'tigoenergy.bg': 'BG',
    'tigoenergy.no': 'NO',
    'tigoenergy.hu': 'HU',
    'tigoenergy.pt': 'PT',
    'tigoenergy.lv': 'LV',
    'tigoenergy.lt': 'LT',
    'tigoenergy.ee': 'EE',
    'tigoenergy.co.uk': 'GB',
    'tigoenergy.uk': 'GB',
    'tigoenergy.shop': 'SHOP',
    'tigoenergy.net': 'SHOP',

    // tigoenergy.com.* variants
    'tigoenergy.com.de': 'DE',
    'tigoenergy.com.hr': 'HR',
    'tigoenergy.com.se': 'SE',

    // tigo-energy.* aliases
    'tigo-energy.si': 'SI',
    'tigo-energy.de': 'DE',
    'tigo-energy.at': 'AT',
    'tigo-energy.ch': 'CH',
    'tigo-energy.it': 'IT',
    'tigo-energy.pl': 'PL',
    'tigo-energy.se': 'SE',
    'tigo-energy.eu': 'EU',
    'tigo-energy.com': 'SHOP',
    'tigo-energy.com.de': 'DE',
}

/**
 * Resolve a hostname to a market key.
 * Strips port and www prefix, then matches against known domains.
 * Falls back to 'SHOP' for localhost, Vercel previews, and unknown hosts.
 */
export function getMarketKeyFromHostname(hostname: string): string {
    // Strip port number
    const host = hostname.split(':')[0].toLowerCase()

    // Strip www prefix
    const bare = host.startsWith('www.') ? host.slice(4) : host

    // Direct match
    if (DOMAIN_TO_MARKET[bare]) {
        return DOMAIN_TO_MARKET[bare]
    }

    // Handle .co.uk specifically (check before generic TLD stripping)
    if (bare.endsWith('.co.uk') || bare.endsWith('.uk')) {
        const coUkMatch = DOMAIN_TO_MARKET[bare]
        if (coUkMatch) return coUkMatch
    }

    // Fallback for localhost, Vercel previews, unknown
    return 'SHOP'
}

/**
 * Get a MarketConfig by its key. Falls back to SHOP.
 */
export function getMarketFromKey(key: string): MarketConfig {
    return MARKETS[key] || MARKETS.SHOP
}

/**
 * Get a MarketConfig directly from a hostname.
 */
export function getMarketFromHostname(hostname: string): MarketConfig {
    return getMarketFromKey(getMarketKeyFromHostname(hostname))
}

/**
 * Validate that a VAT rate matches a known market.
 * Used server-side to prevent client tampering.
 */
export function isValidVatRateForMarket(marketKey: string, vatRate: number): boolean {
    const market = MARKETS[marketKey]
    if (!market) return false
    return Math.abs(market.vatRate - vatRate) < 0.001
}
