'use server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function deleteAccount() {
    const supabase = await createServerClient()

    // 1. Get Current User
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // 2. Initialize Admin Client
    // Note: This requires SUPABASE_SERVICE_ROLE_KEY to be set in .env
    const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )

    // 3. Delete from Auth (Cascade should handle DB if set up, or we manually delete customers row)
    const { error } = await adminClient.auth.admin.deleteUser(user.id)

    if (error) {
        console.error('Delete Account Error:', error)
        throw new Error('Failed to delete account')
    }

    // 4. Return Success
    return { success: true }
}
