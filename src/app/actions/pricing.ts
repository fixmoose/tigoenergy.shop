'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { PricingSchema, PricingSchemaRule } from '@/types/database'

export async function getPricingSchemas() {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('pricing_schemas')
        .select('*, rules:pricing_schema_rules(*)')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching pricing schemas:', error)
        return []
    }
    return data || []
}

export async function createPricingSchema(name: string, description?: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('pricing_schemas')
        .insert({ name, description })
        .select()
        .single()

    if (error) throw new Error(error.message)
    revalidatePath('/admin/pricing')
    return data
}

export async function deletePricingSchema(id: string) {
    const supabase = await createClient()
    const { error } = await supabase
        .from('pricing_schemas')
        .delete()
        .eq('id', id)

    if (error) throw new Error(error.message)
    revalidatePath('/admin/pricing')
}

import { validatePricingRule } from '@/lib/db/pricing'

export async function addPricingRule(rule: Partial<PricingSchemaRule>) {
    const validation = await validatePricingRule(rule)
    if (!validation.valid) {
        throw new Error(validation.message)
    }

    const supabase = await createClient()
    const { data, error } = await supabase
        .from('pricing_schema_rules')
        .insert(rule)
        .select()
        .single()

    if (error) throw new Error(error.message)
    revalidatePath('/admin/pricing')
    return data
}

export async function deletePricingRule(id: string) {
    const supabase = await createClient()
    const { error } = await supabase
        .from('pricing_schema_rules')
        .delete()
        .eq('id', id)

    if (error) throw new Error(error.message)
    revalidatePath('/admin/pricing')
}

export async function getCustomerSchemas(customerId: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('customer_pricing_schemas')
        .select('*, schema:pricing_schemas(*)')
        .eq('customer_id', customerId)
        .order('priority', { ascending: false })

    if (error) {
        console.error('Error fetching customer schemas:', error)
        return []
    }
    return data || []
}

export async function assignSchemaToCustomer(customerId: string, schemaId: string, priority: number = 0) {
    const supabase = await createClient()
    const { error } = await supabase
        .from('customer_pricing_schemas')
        .upsert({ customer_id: customerId, schema_id: schemaId, priority })

    if (error) throw new Error(error.message)
    revalidatePath(`/admin/customers/${customerId}`)
}

export async function unassignSchemaFromCustomer(customerId: string, schemaId: string) {
    const supabase = await createClient()
    const { error } = await supabase
        .from('customer_pricing_schemas')
        .delete()
        .eq('customer_id', customerId)
        .eq('schema_id', schemaId)

    if (error) throw new Error(error.message)
    revalidatePath(`/admin/customers/${customerId}`)
}

export async function getB2BCustomerPrices(productId: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('b2b_customer_prices')
        .select('*, customer:customers(company_name, email)')
        .eq('product_id', productId)

    if (error) {
        console.error('Error fetching B2B customer prices:', error)
        return []
    }
    return data || []
}

export async function setB2BCustomerPrice(customerId: string, productId: string, price: number) {
    const supabase = await createClient()

    // 1. Fetch SKU and current notes
    const { data: product } = await supabase.from('products').select('sku').eq('id', productId).single()
    const { data: customer } = await supabase.from('customers').select('internal_notes').eq('id', customerId).single()

    // 2. Upsert the price
    const { error: priceError } = await supabase
        .from('b2b_customer_prices')
        .upsert({ customer_id: customerId, product_id: productId, price_eur: price })

    if (priceError) throw new Error(priceError.message)

    // 3. Append internal note
    const note = `[SYSTEM] Custom B2B price set for SKU: ${product?.sku || productId} (€${price.toFixed(2)}) on ${new Date().toLocaleDateString()}`
    const updatedNotes = customer?.internal_notes ? `${customer.internal_notes}\n${note}` : note

    await supabase.from('customers').update({ internal_notes: updatedNotes }).eq('id', customerId)

    revalidatePath(`/admin/products/${productId}`)
    revalidatePath(`/admin/customers/${customerId}`)
}

export async function deleteB2BCustomerPrice(id: string, productId: string) {
    const supabase = await createClient()
    const { error } = await supabase
        .from('b2b_customer_prices')
        .delete()
        .eq('id', id)

    if (error) throw new Error(error.message)
    revalidatePath(`/admin/products/${productId}`)
}
