'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { verifyRecaptcha } from '@/lib/recaptcha'
import { sendEmail, renderTemplate, getEmailTranslations } from '@/lib/email'
import { headers } from 'next/headers'
import { getMarketFromKey } from '@/lib/constants/markets'

export async function sendSupportOTP(email: string, recaptchaToken: string) {
    // 1. Verify reCAPTCHA
    const recaptcha = await verifyRecaptcha(recaptchaToken, 'SUPPORT')
    if (!recaptcha.success) {
        throw new Error('reCAPTCHA verification failed: ' + recaptcha.error)
    }

    const supabase = await createClient()
    const adminSupabase = await createAdminClient()

    // 2. Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 mins

    // 3. Save to DB (Use admin client to bypass RLS for guests)
    const { error } = await adminSupabase
        .from('guest_verifications')
        .upsert({
            email,
            otp_code: otp,
            expires_at: expiresAt,
            verified: false
        })

    if (error) throw error

    // 4. Send Production Email
    const headersList = await headers()
    const marketKey = headersList.get('x-market-key') || 'SHOP'
    const market = getMarketFromKey(marketKey)
    const preferredLang = headersList.get('x-preferred-language')
    const locale = (preferredLang && market.availableLanguages.includes(preferredLang))
        ? preferredLang
        : market.defaultLanguage

    try {
        const translations = await getEmailTranslations(locale)
        const subject = translations.email?.verificationCode?.title || (locale === 'sl' ? 'Podpora: Vaša potrditvena koda' : 'Support: Your Verification Code')

        const html = await renderTemplate('verification-code', {
            code: otp,
            email
        }, locale)

        await sendEmail({
            to: email,
            subject: subject,
            html
        })
    } catch (emailError) {
        console.error('Failed to send support OTP email:', emailError)
    }

    return { success: true, debug_code: process.env.NODE_ENV === 'development' ? otp : undefined }
}

export async function verifySupportOTP(email: string, code: string) {
    const supabase = await createAdminClient()
    const { data, error } = await supabase
        .from('guest_verifications')
        .select('*')
        .eq('email', email)
        .eq('otp_code', code)
        .single()

    if (error || !data) {
        throw new Error('Invalid or expired verification code')
    }

    if (new Date(data.expires_at) < new Date()) {
        throw new Error('Verification code expired')
    }

    // Mark as verified
    await supabase
        .from('guest_verifications')
        .update({ verified: true })
        .eq('email', email)

    return { success: true }
}

export async function submitSupportRequestV2(formData: {
    type: 'shipping' | 'return' | 'general' | 'sales'
    subject: string
    message: string
    orderId?: string
    email?: string
    name?: string
    recaptchaToken: string
}) {
    // 1. Verify reCAPTCHA
    const recaptcha = await verifyRecaptcha(formData.recaptchaToken, 'SUPPORT')
    if (!recaptcha.success) {
        throw new Error('reCAPTCHA verification failed')
    }

    const supabase = await createClient()
    const adminSupabase = await createAdminClient()
    const { data: { user } } = await supabase.auth.getUser()

    // 2. If guest, check if email is verified
    if (!user && formData.email) {
        const { data: ver } = await adminSupabase
            .from('guest_verifications')
            .select('verified')
            .eq('email', formData.email)
            .single()

        if (!ver?.verified) {
            throw new Error('Email must be verified first')
        }
    }

    // 3. Create Request
    const { data: request, error: reqError } = await adminSupabase
        .from('support_requests')
        .insert({
            customer_id: user?.id || null,
            guest_email: user ? null : formData.email,
            guest_name: user ? null : formData.name,
            order_id: formData.orderId || null,
            type: formData.type,
            subject: formData.subject,
            message: formData.message,
            status: 'new'
        })
        .select()
        .single()

    if (reqError) throw reqError

    // 4. Create first message
    const { error: msgError } = await adminSupabase
        .from('support_messages')
        .insert({
            request_id: request.id,
            sender_id: user?.id || null,
            sender_type: user ? 'customer' : 'guest',
            message: formData.message
        })

    if (msgError) throw msgError

    // 5. Notify Admins
    try {
        const adminUsers = await adminSupabase.auth.admin.listUsers()
        const admins = (adminUsers.data.users || [])
            .filter((u: any) => u.user_metadata?.role === 'admin' || u.email === 'dejan@haywilson.com')
            .map((u: any) => u.email)
            .filter((email: string | undefined): email is string => !!email)

        if (admins.length > 0) {
            // Determine Subject based on type
            // shipping/return => Online Shop Support => Shopping help
            // general => Tigo Product Support => Tigo Support
            // sales => Contact Sales
            let subjectPrefix = 'Tigo Energy SHOP> Tigo Support'
            if (formData.type === 'shipping' || formData.type === 'return') {
                subjectPrefix = 'Tigo Energy SHOP> Shopping help'
            } else if (formData.type === 'sales') {
                subjectPrefix = 'Tigo Energy SHOP> Contact Sales'
            }

            const userEmail = user?.email || formData.email
            const userName = user?.user_metadata?.first_name ? `${user.user_metadata.first_name} ${user.user_metadata.last_name}` : formData.name

            const adminHtml = `
                <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
                    <h2 style="color: #16a34a;">New Support Message</h2>
                    <p><strong>From:</strong> ${userName} (${userEmail})</p>
                    <p><strong>Type:</strong> ${formData.type === 'sales' ? 'Sales Inquiry' : (formData.type === 'general' ? 'Tigo Product Support' : 'Online Shop Support')}</p>
                    <div style="background: #f4f4f4; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
                        ${formData.message}
                    </div>
                    <p><a href="${process.env.NEXT_PUBLIC_SITE_URL}/admin/support/${request.id}" 
                          style="background: #16a34a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                        View in Admin Dashboard
                    </a></p>
                </div>
            `

            // Send to all admins
            await Promise.all(admins.map((adminEmail: string) =>
                sendEmail({
                    to: adminEmail,
                    subject: `${subjectPrefix} - Request #${request.id.slice(0, 8)}`,
                    html: adminHtml
                })
            ))
        }
    } catch (notifyError) {
        console.error('Failed to notify admins of support request:', notifyError)
    }

    return { success: true, requestId: request.id }
}

export async function addMessageToSupportRequest(requestId: string, message: string, recaptchaToken?: string) {
    if (recaptchaToken) {
        const recaptcha = await verifyRecaptcha(recaptchaToken, 'SUPPORT')
        if (!recaptcha.success) throw new Error('reCAPTCHA failed')
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
        .from('support_messages')
        .insert({
            request_id: requestId,
            sender_id: user?.id || null,
            sender_type: user ? 'customer' : 'guest',
            message: message
        })

    if (error) throw error
    return { success: true }
}

export async function getSupportMessages(requestId: string) {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true })

    if (error) throw error
    return data
}
