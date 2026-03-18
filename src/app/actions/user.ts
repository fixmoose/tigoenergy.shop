'use server'

import { createClient as createServerClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function deleteAccount() {
    try {
        const supabase = await createServerClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        const adminClient = await createAdminClient()

        // Mark customer as deleted before removing auth (so admin still sees them)
        await adminClient.from('customers').update({
            account_status: 'deleted',
            updated_at: new Date().toISOString(),
        }).eq('id', user.id)

        const { error } = await adminClient.auth.admin.deleteUser(user.id)
        if (error) throw error

        return { success: true }
    } catch (err: any) {
        console.error('Error in deleteAccount:', err)
        return { success: false, error: err.message || 'Failed to delete account' }
    }
}
