'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { verifyRecaptcha } from '@/lib/recaptcha'

export async function submitSupportRequest(formData: {
    type: 'shipping' | 'return' | 'general'
    subject: string
    message: string
    orderId?: string
    metadata?: any
    recaptchaToken?: string
}) {
    // Verify reCAPTCHA
    const recaptcha = await verifyRecaptcha(formData.recaptchaToken || null)
    if (!recaptcha.success) {
        return { error: 'reCAPTCHA verification failed. Please try again.' }
    }

    const supabase = await createClient()

    // 1. Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return { error: 'You must be logged in to submit a support request.' }
    }

    // 2. Insert support request
    const { data, error } = await supabase
        .from('support_requests')
        .insert({
            customer_id: user.id,
            order_id: formData.orderId || null,
            type: formData.type,
            subject: formData.subject,
            message: formData.message,
            metadata: formData.metadata || {},
            status: 'new'
        })
        .select()
        .single()

    if (error) {
        console.error('Error submitting support request:', error)
        return { error: 'Failed to submit support request. Please try again later.' }
    }

    // 3. Revalidate paths if necessary
    revalidatePath(`/orders/${formData.orderId}`)
    revalidatePath('/dashboard')

    return { success: true, data }
}
