import { createClient } from '@/lib/supabase/server'
import type { Product, PricingSchema, PricingSchemaRule, CustomerCustomPricing } from '@/types/database'

export interface EffectivePrice {
    originalPrice: number
    discountedPrice: number
    isDiscounted: boolean
    appliedSchemaName?: string
}

export type CustomerPricingData = {
    schemas: {
        priority: number
        schema: PricingSchema & { rules: PricingSchemaRule[] }
    }[]
    customOverrides: CustomerCustomPricing[]
}

/**
 * Fetches all pricing schemas, rules, and custom overrides for a specific customer.
 * Useful for batch processing many products.
 */
export async function getCustomerPricingData(userId: string): Promise<CustomerPricingData> {
    const supabase = await createClient()

    // 1. Fetch Schemas
    const { data: customerSchemas } = await supabase
        .from('customer_pricing_schemas')
        .select('priority, schema:pricing_schemas(name, rules:pricing_schema_rules(*))')
        .eq('customer_id', userId)
        .order('priority', { ascending: false })

    // 2. Fetch Direct Custom Pricing (Overrides)
    const { data: customOverrides } = await supabase
        .from('b2b_customer_prices')
        .select('*')
        .eq('customer_id', userId)

    return {
        schemas: (customerSchemas || []) as any,
        customOverrides: (customOverrides || []) as CustomerCustomPricing[]
    }
}

/**
 * Margin Thresholds per Category
 */
export const MARGIN_THRESHOLDS: Record<string, number> = {
    'TS4 FLEX MLPE': 2,
    'TS4-X MLPE': 2,
    'COMMUNICATIONS': 10,
    'EI RESIDENTIAL SOLUTION': 100
}

export interface RuleValidationResult {
    valid: boolean
    message?: string
    maxDiscountPercentage?: number
    maxDiscountEur?: number
    affectedProductCount?: number
}

/**
 * Validates a pricing rule against margin constraints.
 */
export async function validatePricingRule(rule: Partial<PricingSchemaRule>): Promise<RuleValidationResult> {
    const supabase = await createClient()

    // Fetch affected products and their costs
    let query = supabase.from('products').select('id, name_en, category, price_eur, cost_eur').eq('active', true)

    if (rule.type === 'product_fixed_price' && rule.product_id) {
        query = query.eq('id', rule.product_id)
    } else if (rule.type === 'category_discount' && rule.category) {
        query = query.eq('category', rule.category)
    } else if (rule.type === 'subcategory_discount' && rule.subcategory) {
        query = query.eq('subcategory', rule.subcategory)
    }

    const { data: products, error } = await query

    if (error || !products || products.length === 0) {
        return { valid: true, affectedProductCount: 0 }
    }

    let mostRestrictivePercentage = 100
    let mostRestrictiveEur = Infinity
    let invalidProduct: any = null

    for (const product of products) {
        const threshold = MARGIN_THRESHOLDS[product.category] || 0
        const minPrice = (product.cost_eur || 0) + threshold
        const maxPossibleDiscountEur = Math.max(0, product.price_eur - minPrice)
        const maxPossibleDiscountPercentage = product.price_eur > 0 ? (maxPossibleDiscountEur / product.price_eur) * 100 : 0

        if (rule.type === 'product_fixed_price' && rule.fixed_price_eur != null) {
            if (rule.fixed_price_eur < minPrice) {
                return {
                    valid: false,
                    message: `Price too low for "${product.name_en}". Minimum allowed: ${minPrice.toFixed(2)} EUR (Cost + ${threshold} EUR margin).`,
                    maxDiscountEur: maxPossibleDiscountEur
                }
            }
        } else if (rule.discount_percentage != null) {
            const discountEur = product.price_eur * (rule.discount_percentage / 100)
            if (discountEur > maxPossibleDiscountEur) {
                if (maxPossibleDiscountPercentage < mostRestrictivePercentage) {
                    mostRestrictivePercentage = maxPossibleDiscountPercentage
                    mostRestrictiveEur = maxPossibleDiscountEur
                    invalidProduct = product
                }
            }
        }
    }

    if (invalidProduct && rule.discount_percentage != null) {
        return {
            valid: false,
            message: `Discount too high for some products (e.g., "${invalidProduct.name_en}"). Max allowed discount for this group is ${mostRestrictivePercentage.toFixed(1)}%.`,
            maxDiscountPercentage: Math.floor(mostRestrictivePercentage * 10) / 10,
            maxDiscountEur: mostRestrictiveEur
        }
    }

    return { valid: true, affectedProductCount: products.length }
}

/**
 * Calculates the effective price for a product using pre-fetched customer pricing data.
 */
export function calculateEffectivePrice(product: Product, pricingData: CustomerPricingData, quantity: number = 1): EffectivePrice {
    const originalPrice = product.price_eur || 0

    if (!pricingData) {
        return { originalPrice, discountedPrice: originalPrice, isDiscounted: false }
    }

    // 1. Check for Direct Custom Pricing Overrides FIRST (Highest priority)
    const override = pricingData.customOverrides?.find(o => o.product_id === product.id)
    if (override) {
        if (override.pricing_type === 'simple' && override.price_eur != null) {
            return {
                originalPrice,
                discountedPrice: Number(override.price_eur),
                isDiscounted: Number(override.price_eur) < originalPrice,
                appliedSchemaName: 'Custom Quote'
            }
        } else if (override.pricing_type === 'tiered' && override.tier_prices) {
            // Find the applicable tier based on quantity
            const applicableTier = [...override.tier_prices]
                .sort((a, b) => (b.min_qty || 0) - (a.min_qty || 0)) // Highest min_qty first
                .find(t => quantity >= (t.min_qty || 0))

            if (applicableTier) {
                return {
                    originalPrice,
                    discountedPrice: Number(applicableTier.price),
                    isDiscounted: Number(applicableTier.price) < originalPrice,
                    appliedSchemaName: 'Tiered Override'
                }
            }
        }
    }

    let currentPrice = originalPrice
    let bestAppliedSchemaName: string | undefined

    // 2. Iterate through schemas (highest priority first)
    if (pricingData.schemas) {
        for (const cs of pricingData.schemas) {
            const schema = cs.schema
            if (!schema || !schema.rules) continue

            // Within a schema, look for the most specific rule:
            // 1. Product fixed price (most specific)
            // 2. Subcategory discount
            // 3. Category discount
            // 4. Global discount (least specific)

            const productRule = schema.rules.find(r => r.type === 'product_fixed_price' && r.product_id === product.id)
            if (productRule && productRule.fixed_price_eur != null) {
                currentPrice = productRule.fixed_price_eur
                bestAppliedSchemaName = schema.name
                break
            }

            const subcategoryRule = schema.rules.find(r => r.type === 'subcategory_discount' && r.subcategory === product.subcategory)
            if (subcategoryRule && subcategoryRule.discount_percentage != null) {
                currentPrice = originalPrice * (1 - subcategoryRule.discount_percentage / 100)
                bestAppliedSchemaName = schema.name
                break
            }

            const categoryRule = schema.rules.find(r => r.type === 'category_discount' && r.category === product.category)
            if (categoryRule && categoryRule.discount_percentage != null) {
                currentPrice = originalPrice * (1 - categoryRule.discount_percentage / 100)
                bestAppliedSchemaName = schema.name
                break
            }

            const globalRule = schema.rules.find(r => r.type === 'global_discount')
            if (globalRule && globalRule.discount_percentage != null) {
                currentPrice = originalPrice * (1 - globalRule.discount_percentage / 100)
                bestAppliedSchemaName = schema.name
                break
            }
        }
    }

    return {
        originalPrice,
        discountedPrice: Number(currentPrice.toFixed(2)),
        isDiscounted: currentPrice < originalPrice,
        appliedSchemaName: currentPrice < originalPrice ? bestAppliedSchemaName : undefined
    }
}

/**
 * Calculates the effective price for a product for a specific user.
 * Convenience wrapper for single products.
 */
export async function getEffectivePrice(product: Product, userId?: string | null, quantity: number = 1): Promise<EffectivePrice> {
    if (!userId) {
        return { originalPrice: product.price_eur || 0, discountedPrice: product.price_eur || 0, isDiscounted: false }
    }
    const pricingData = await getCustomerPricingData(userId)
    return calculateEffectivePrice(product, pricingData, quantity)
}
