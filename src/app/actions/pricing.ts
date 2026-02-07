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
