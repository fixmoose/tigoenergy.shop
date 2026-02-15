import type { Product } from '@/types/database'

/**
 * Get a localized field from a product, falling back to English.
 */
function getLocalizedField(product: Product, field: string, lang: string): string | null {
    if (lang === 'en') return (product as any)[`${field}_en`] || null
    const key = `${field}_${lang}` as keyof Product
    return (product[key] as string | null) || (product as any)[`${field}_en`] || null
}

/**
 * Get the localized product description, falling back to English.
 */
export function getLocalizedDescription(product: Product, lang: string): string | null {
    return getLocalizedField(product, 'description', lang)
}

/**
 * Get the localized product name, falling back to English.
 */
export function getLocalizedName(product: Product, lang: string): string | null {
    return getLocalizedField(product, 'name', lang)
}
