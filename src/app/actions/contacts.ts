'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getCustomerContacts(customerId: string) {
    const supabase = await createAdminClient()
    const { data, error } = await supabase
        .from('customer_contacts')
        .select('*')
        .eq('customer_id', customerId)
        .order('is_default', { ascending: false })

    if (error) {
        console.error('Error fetching contacts:', error)
        return []
    }
    return data
}

export async function setDefaultContact(customerId: string, contactId: string, type: 'email' | 'phone') {
    const supabase = await createAdminClient()

    // Unset current default
    await supabase
        .from('customer_contacts')
        .update({ is_default: false })
        .eq('customer_id', customerId)
        .eq('type', type)

    // Set new default
    const { error } = await supabase
        .from('customer_contacts')
        .update({ is_default: true })
        .eq('id', contactId)
        .eq('customer_id', customerId)

    if (!error && type === 'email') {
        // Also update main customer record for compatibility
        const { data: contact } = await supabase.from('customer_contacts').select('value').eq('id', contactId).single()
        if (contact) {
            await supabase.from('customers').update({ email: contact.value }).eq('id', customerId)
        }
    } else if (!error && type === 'phone') {
        const { data: contact } = await supabase.from('customer_contacts').select('value').eq('id', contactId).single()
        if (contact) {
            await supabase.from('customers').update({ phone: contact.value }).eq('id', customerId)
        }
    }

    revalidatePath('/dashboard')
    return { success: !error }
}

export async function removeContact(customerId: string, contactId: string) {
    const supabase = await createAdminClient()

    // Check if it's default
    const { data: contact } = await supabase.from('customer_contacts').select('*').eq('id', contactId).single()
    if (contact?.is_default) {
        return { success: false, error: 'Cannot remove default contact' }
    }

    const { error } = await supabase
        .from('customer_contacts')
        .delete()
        .eq('id', contactId)
        .eq('customer_id', customerId)

    revalidatePath('/dashboard')
    return { success: !error }
}
