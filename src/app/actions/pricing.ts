'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { PricingSchema, PricingSchemaRule } from '@/types/database'

export async function getPricingSchemas() {
    try {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from('pricing_schemas')
            .select('*, rules:pricing_schema_rules(*)')
            .order('created_at', { ascending: false })

        if (error) throw error
        return { success: true, data: data || [] }
    } catch (err: any) {
        console.error('Error in getPricingSchemas:', err)
        return { success: false, error: err.message || 'Failed to fetch pricing schemas' }
    }
}

export async function createPricingSchema(name: string, description?: string) {
    try {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from('pricing_schemas')
            .insert({ name, description })
            .select()
            .single()

        if (error) throw error
        revalidatePath('/admin/pricing')
        return { success: true, data }
    } catch (err: any) {
        console.error('Error in createPricingSchema:', err)
        return { success: false, error: err.message || 'Failed to create pricing schema' }
    }
}

export async function deletePricingSchema(id: string) {
    try {
        const supabase = await createClient()
        const { error } = await supabase
            .from('pricing_schemas')
            .delete()
            .eq('id', id)

        if (error) throw error
        revalidatePath('/admin/pricing')
        return { success: true }
    } catch (err: any) {
        console.error('Error in deletePricingSchema:', err)
        return { success: false, error: err.message || 'Failed to delete pricing schema' }
    }
}

import { validatePricingRule } from '@/lib/db/pricing'

export async function addPricingRule(rule: Partial<PricingSchemaRule>) {
    try {
        const validation = await validatePricingRule(rule)
        if (!validation.valid) throw new Error(validation.message)

        const supabase = await createClient()
        const { data, error } = await supabase
            .from('pricing_schema_rules')
            .insert(rule)
            .select()
            .single()

        if (error) throw error
        revalidatePath('/admin/pricing')
        return { success: true, data }
    } catch (err: any) {
        console.error('Error in addPricingRule:', err)
        return { success: false, error: err.message || 'Failed to add pricing rule' }
    }
}

export async function deletePricingRule(id: string) {
    try {
        const supabase = await createClient()
        const { error } = await supabase
            .from('pricing_schema_rules')
            .delete()
            .eq('id', id)

        if (error) throw error
        revalidatePath('/admin/pricing')
        return { success: true }
    } catch (err: any) {
        console.error('Error in deletePricingRule:', err)
        return { success: false, error: err.message || 'Failed to delete pricing rule' }
    }
}

export async function getCustomerSchemas(customerId: string) {
    try {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from('customer_pricing_schemas')
            .select('*, schema:pricing_schemas(*)')
            .eq('customer_id', customerId)
            .order('priority', { ascending: false })

        if (error) throw error
        return { success: true, data: data || [] }
    } catch (err: any) {
        console.error('Error in getCustomerSchemas:', err)
        return { success: false, error: err.message || 'Failed to fetch customer schemas' }
    }
}

export async function assignSchemaToCustomer(customerId: string, schemaId: string, priority: number = 0) {
    try {
        const supabase = await createClient()
        const { error } = await supabase
            .from('customer_pricing_schemas')
            .upsert({ customer_id: customerId, schema_id: schemaId, priority })

        if (error) throw error
        revalidatePath(`/admin/customers/${customerId}`)
        return { success: true }
    } catch (err: any) {
        console.error('Error in assignSchemaToCustomer:', err)
        return { success: false, error: err.message || 'Failed to assign schema' }
    }
}

export async function unassignSchemaFromCustomer(customerId: string, schemaId: string) {
    try {
        const supabase = await createClient()
        const { error } = await supabase
            .from('customer_pricing_schemas')
            .delete()
            .eq('customer_id', customerId)
            .eq('schema_id', schemaId)

        if (error) throw error
        revalidatePath(`/admin/customers/${customerId}`)
        return { success: true }
    } catch (err: any) {
        console.error('Error in unassignSchemaFromCustomer:', err)
        return { success: false, error: err.message || 'Failed to unassign schema' }
    }
}

export async function getB2BCustomerPrices(productId: string) {
    try {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from('b2b_customer_prices')
            .select('*, customer:customers(company_name, email)')
            .eq('product_id', productId)

        if (error) throw error
        return { success: true, data: data || [] }
    } catch (err: any) {
        console.error('Error in getB2BCustomerPrices:', err)
        return { success: false, error: err.message || 'Failed to fetch B2B prices' }
    }
}

export async function setB2BCustomerPrice(customerId: string, productId: string, price: number) {
    try {
        const supabase = await createClient()
        const { data: product } = await supabase.from('products').select('sku').eq('id', productId).single()
        const { data: customer } = await supabase.from('customers').select('internal_notes').eq('id', customerId).single()

        const { error: priceError } = await supabase
            .from('b2b_customer_prices')
            .upsert({ customer_id: customerId, product_id: productId, price_eur: price })

        if (priceError) throw priceError

        const note = `[SYSTEM] Custom B2B price set for SKU: ${product?.sku || productId} (€${price.toFixed(2)}) on ${new Date().toLocaleDateString()}`
        const updatedNotes = customer?.internal_notes ? `${customer.internal_notes}\n${note}` : note
        await supabase.from('customers').update({ internal_notes: updatedNotes }).eq('id', customerId)

        revalidatePath(`/admin/products/${productId}`)
        revalidatePath(`/admin/customers/${customerId}`)
        return { success: true }
    } catch (err: any) {
        console.error('Error in setB2BCustomerPrice:', err)
        return { success: false, error: err.message || 'Failed to set B2B customer price' }
    }
}

export async function deleteB2BCustomerPrice(id: string, productId: string) {
    try {
        const supabase = await createClient()
        const { error } = await supabase
            .from('b2b_customer_prices')
            .delete()
            .eq('id', id)

        if (error) throw error
        revalidatePath(`/admin/products/${productId}`)
        return { success: true }
    } catch (err: any) {
        console.error('Error in deleteB2BCustomerPrice:', err)
        return { success: false, error: err.message || 'Failed to delete B2B price' }
    }
}

export async function saveCustomerCustomPrice(payload: {
    customer_id: string
    product_id: string
    pricing_type: string
    fixed_price_eur?: number | null
    tier_prices?: any[] | null
}) {
    try {
        const supabase = await createClient()
        const { error } = await supabase
            .from('b2b_customer_prices')
            .upsert({
                customer_id: payload.customer_id,
                product_id: payload.product_id,
                pricing_type: payload.pricing_type,
                price_eur: payload.fixed_price_eur ?? null,
                tier_prices: payload.tier_prices ?? null,
            })

        if (error) throw error
        revalidatePath(`/admin/customers/${payload.customer_id}`)
        return { success: true }
    } catch (err: any) {
        console.error('Error in saveCustomerCustomPrice:', err)
        return { success: false, error: err.message || 'Failed to save custom price' }
    }
}

export async function deleteCustomerCustomPrice(id: string, customerId: string) {
    try {
        const supabase = await createClient()
        const { error } = await supabase
            .from('b2b_customer_prices')
            .delete()
            .eq('id', id)

        if (error) throw error
        revalidatePath(`/admin/customers/${customerId}`)
        return { success: true }
    } catch (err: any) {
        console.error('Error in deleteCustomerCustomPrice:', err)
        return { success: false, error: err.message || 'Failed to delete custom price' }
    }
}
