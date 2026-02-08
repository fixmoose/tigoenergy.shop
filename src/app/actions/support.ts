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

    // 3. Notify Admins
    try {
        const adminUsers = await supabase.auth.admin.listUsers()
        const admins = (adminUsers.data.users || [])
            .filter((u: any) => u.user_metadata?.role === 'admin' || u.email === 'dejan@haywilson.com')
            .map((u: any) => u.email)
            .filter((email: string | undefined): email is string => !!email)

        if (admins.length > 0) {
            const isShopHelp = formData.type === 'shipping' || formData.type === 'return'
            const subjectPrefix = isShopHelp ? 'Tigo Energy SHOP> Shopping help' : 'Tigo Energy SHOP> Tigo Support'
            const userEmail = user.email
            const userName = `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim() || userEmail

            const adminHtml = `
                <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
                    <h2 style="color: #16a34a;">New Support Inquiry (Order Related)</h2>
                    <p><strong>From:</strong> ${userName} (${userEmail})</p>
                    <p><strong>Type:</strong> ${formData.type === 'general' ? 'Tigo Product Support' : 'Online Shop Support'}</p>
                    <p><strong>Order ID:</strong> ${formData.orderId || 'N/A'}</p>
                    <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
                        ${formData.message}
                    </div>
                </div>
            `

            const { sendEmail } = await import('@/lib/email')
            await Promise.all(admins.map((adminEmail: string) =>
                sendEmail({
                    to: adminEmail,
                    subject: `${subjectPrefix} - Order Inquiry #${data.id.slice(0, 8)}`,
                    html: adminHtml
                })
            ))
        }
    } catch (notifyError) {
        console.error('Failed to notify admins of support request:', notifyError)
    }

    // 4. Revalidate paths if necessary
    revalidatePath(`/orders/${formData.orderId}`)
    revalidatePath('/dashboard')

    return { success: true, data }
}
