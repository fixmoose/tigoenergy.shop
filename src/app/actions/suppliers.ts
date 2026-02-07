'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Supplier } from '@/types/database'

export async function getSuppliers() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Error fetching suppliers:', error)
        return []
    }

    return data || []
}

export async function createSupplier(formData: FormData) {
    const supabase = await createClient()

    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const phone = formData.get('phone') as string
    const contact_person = formData.get('contact_person') as string
    const vat_id = formData.get('vat_id') as string
    const website = formData.get('website') as string
    const notes = formData.get('notes') as string

    const address_line1 = formData.get('address_line1') as string
    const city = formData.get('city') as string
    const postal_code = formData.get('postal_code') as string
    const country = formData.get('country') as string

    if (!name) {
        throw new Error('Name is required')
    }

    const { error } = await supabase
        .from('suppliers')
        .insert({
            name,
            email: email || null,
            phone: phone || null,
            contact_person: contact_person || null,
            vat_id: vat_id || null,
            website: website || null,
            notes: notes || null,

            address_line1: address_line1 || null,
            city: city || null,
            postal_code: postal_code || null,
            country: country || null,

            created_at: new Date().toISOString()
        })

    if (error) {
        throw new Error(error.message)
    }

    revalidatePath('/admin/suppliers')
}

export async function deleteSupplier(id: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id)

    if (error) {
        throw new Error(error.message)
    }

    revalidatePath('/admin/suppliers')
}
