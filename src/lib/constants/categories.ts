export const PRODUCT_CATEGORIES = {
    'TS4 FLEX MLPE': {
        slug: 'ts4-flex-mlpe',
        subcategories: ['Optimization', 'Safety', 'Fire Safety']
    },
    'TS4-X MLPE': {
        slug: 'ts4-x-mlpe',
        subcategories: ['Optimization', 'Safety', 'Fire Safety']
    },
    'EI RESIDENTIAL SOLUTION': {
        slug: 'ei-residential-solution',
        subcategories: ['EI Inverter', 'EI Battery', 'EI Link', 'GO EV Charger', 'GO Junction']
    },
    'COMMUNICATIONS': {
        slug: 'communications',
        subcategories: ['Data Loggers', 'Access Points', 'Rapid Shutdown']
    }
} as const;

export type CategoryKey = keyof typeof PRODUCT_CATEGORIES;
export type SubcategoryKey = typeof PRODUCT_CATEGORIES[CategoryKey]['subcategories'][number];

// Helper to get slug from display name or vice versa
export function getCategorySlug(displayName: string) {
    const entry = Object.values(PRODUCT_CATEGORIES).find(c => c.slug === displayName || Object.keys(PRODUCT_CATEGORIES).find(k => k === displayName && PRODUCT_CATEGORIES[k as CategoryKey].slug === c.slug));
    return entry?.slug || displayName.toLowerCase().replace(/ /g, '-');
}

// Helper to get Category Name from slug
export function getCategoryFromSlug(slug: string) {
    const entry = Object.entries(PRODUCT_CATEGORIES).find(([_, info]) => info.slug === slug);
    return entry ? entry[0] : slug; // Return original if not found (fallback)
}
