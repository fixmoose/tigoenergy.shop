// Supported languages for the store
// Maps country codes to their primary language

export interface LanguageMetadata {
    code: string        // ISO 639-1 language code
    name: string        // English name
    nativeName: string  // Native name
    flag: string        // Flag emoji for display
}

export const LANGUAGES: Record<string, LanguageMetadata> = {
    en: { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
    de: { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
    fr: { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
    it: { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
    es: { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
    nl: { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
    pl: { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
    cs: { code: 'cs', name: 'Czech', nativeName: 'Čeština', flag: '🇨🇿' },
    sk: { code: 'sk', name: 'Slovak', nativeName: 'Slovenčina', flag: '🇸🇰' },
    sl: { code: 'sl', name: 'Slovenian', nativeName: 'Slovenščina', flag: '🇸🇮' },
    hr: { code: 'hr', name: 'Croatian', nativeName: 'Hrvatski', flag: '🇭🇷' },
    sv: { code: 'sv', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪' },
    da: { code: 'da', name: 'Danish', nativeName: 'Dansk', flag: '🇩🇰' },
    ro: { code: 'ro', name: 'Romanian', nativeName: 'Română', flag: '🇷🇴' },
    sr: { code: 'sr', name: 'Serbian', nativeName: 'Srpski', flag: '🇷🇸' },
    'sr-Cyrl': { code: 'sr-Cyrl', name: 'Serbian (Cyrillic)', nativeName: 'Српски', flag: '🇷🇸' },
    mk: { code: 'mk', name: 'Macedonian', nativeName: 'Македонски', flag: '🇲🇰' },
    bg: { code: 'bg', name: 'Bulgarian', nativeName: 'Български', flag: '🇧🇬' },
    no: { code: 'no', name: 'Norwegian', nativeName: 'Norsk', flag: '🇳🇴' },
    hu: { code: 'hu', name: 'Hungarian', nativeName: 'Magyar', flag: '🇭🇺' },
    pt: { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
    lv: { code: 'lv', name: 'Latvian', nativeName: 'Latviešu', flag: '🇱🇻' },
    lt: { code: 'lt', name: 'Lithuanian', nativeName: 'Lietuvių', flag: '🇱🇹' },
    et: { code: 'et', name: 'Estonian', nativeName: 'Eesti', flag: '🇪🇪' },
}

// Sorted array for dropdowns (English first, then alphabetically by name)
export const SORTED_LANGUAGES = [
    LANGUAGES.en,
    ...Object.values(LANGUAGES)
        .filter(l => l.code !== 'en')
        .sort((a, b) => a.name.localeCompare(b.name))
]

// Map country codes to their default language
export const COUNTRY_TO_LANGUAGE: Record<string, string> = {
    DE: 'de',
    AT: 'de',
    CH: 'de',
    FR: 'fr',
    IT: 'it',
    ES: 'es',
    NL: 'nl',
    BE: 'nl',
    PL: 'pl',
    CZ: 'cs',
    SK: 'sk',
    SI: 'sl',
    HR: 'hr',
    SE: 'sv',
    DK: 'da',
    RO: 'ro',
    RS: 'sr',
    MK: 'mk',
    ME: 'sr',
    GB: 'en',
    BG: 'bg',
    NO: 'no',
    HU: 'hu',
    PT: 'pt',
    LV: 'lv',
    LT: 'lt',
    EE: 'et',
    // Default fallback for unlisted countries is English
}

export function getLanguageForCountry(countryCode: string): string {
    return COUNTRY_TO_LANGUAGE[countryCode?.toUpperCase()] || 'en'
}
