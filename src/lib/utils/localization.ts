import type { Product } from '@/types/database'

/**
 * Get the localized product description, falling back to English.
 */
export function getLocalizedDescription(product: Product, lang: string): string | null {
    if (lang === 'en') return product.description_en || null
    const key = `description_${lang}` as keyof Product
    return (product[key] as string | null) || product.description_en || null
}
