export interface CurrencyMetadata {
    code: string
    name: string
    symbol: string
    flag: string
    locale: string
    isEU: boolean
}

export const CURRENCIES: Record<string, CurrencyMetadata> = {
    EUR: { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺', locale: 'de-DE', isEU: true },
    GBP: { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧', locale: 'en-GB', isEU: false },
    CHF: { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', flag: '🇨🇭', locale: 'de-CH', isEU: false },
    NOK: { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', flag: '🇳🇴', locale: 'nb-NO', isEU: false },
    SEK: { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', flag: '🇸🇪', locale: 'sv-SE', isEU: true },
    DKK: { code: 'DKK', name: 'Danish Krone', symbol: 'kr', flag: '🇩🇰', locale: 'da-DK', isEU: true },
    PLN: { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', flag: '🇵🇱', locale: 'pl-PL', isEU: true },
    CZK: { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', flag: '🇨🇿', locale: 'cs-CZ', isEU: true },
    HUF: { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', flag: '🇭🇺', locale: 'hu-HU', isEU: true },
    RON: { code: 'RON', name: 'Romanian Leu', symbol: 'lei', flag: '🇷🇴', locale: 'ro-RO', isEU: true },
    BAM: { code: 'BAM', name: 'Bosnian Mark', symbol: 'KM', flag: '🇧🇦', locale: 'bs-BA', isEU: false },
    RSD: { code: 'RSD', name: 'Serbian Dinar', symbol: 'din', flag: '🇷🇸', locale: 'sr-RS', isEU: false },
    MKD: { code: 'MKD', name: 'Macedonian Denar', symbol: 'den', flag: '🇲🇰', locale: 'mk-MK', isEU: false },
}

export const SORTED_CURRENCIES = [
    CURRENCIES.EUR,
    ...Object.values(CURRENCIES)
        .filter(c => c.code !== 'EUR' && c.isEU)
        .sort((a, b) => a.code.localeCompare(b.code)),
    ...Object.values(CURRENCIES)
        .filter(c => !c.isEU)
        .sort((a, b) => a.code.localeCompare(b.code))
]
