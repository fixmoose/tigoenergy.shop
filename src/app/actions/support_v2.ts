'use client'

import { createClient } from '@/lib/supabase/client'
import { verifyRecaptcha } from '@/lib/recaptcha'

const supabase = createClient()

export async function sendSupportOTP(email: string, recaptchaToken: string) {
    // 1. Verify reCAPTCHA
    const recaptcha = await verifyRecaptcha(recaptchaToken)
    if (!recaptcha.success) {
        throw new Error('reCAPTCHA verification failed: ' + recaptcha.error)
    }

    // 2. Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 mins

    // 3. Save to DB
    const { error } = await supabase
        .from('guest_verifications')
        .upsert({
            email,
            otp_code: otp,
            expires_at: expiresAt,
            verified: false
        })

    if (error) throw error

    // 4. Send Email (Mocked for now)
    console.log(`[MOCK SUPPORT OTP] Sending ${otp} to ${email}`)

    return { success: true, debug_code: otp }
}

export async function verifySupportOTP(email: string, code: string) {
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
    type: 'shipping' | 'return' | 'general'
    subject: string
    message: string
    orderId?: string
    email?: string
    name?: string
    recaptchaToken: string
}) {
    // 1. Verify reCAPTCHA
    const recaptcha = await verifyRecaptcha(formData.recaptchaToken)
    if (!recaptcha.success) {
        throw new Error('reCAPTCHA verification failed')
    }

    const { data: { user } } = await supabase.auth.getUser()

    // 2. If guest, check if email is verified
    if (!user && formData.email) {
        const { data: ver } = await supabase
            .from('guest_verifications')
            .select('verified')
            .eq('email', formData.email)
            .single()

        if (!ver?.verified) {
            throw new Error('Email must be verified first')
        }
    }

    // 3. Create Request
    const { data: request, error: reqError } = await supabase
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
    const { error: msgError } = await supabase
        .from('support_messages')
        .insert({
            request_id: request.id,
            sender_id: user?.id || null,
            sender_type: user ? 'customer' : 'guest',
            message: formData.message
        })

    if (msgError) throw msgError

    return { success: true, requestId: request.id }
}

export async function addMessageToSupportRequest(requestId: string, message: string, recaptchaToken?: string) {
    // reCAPTCHA is optional for subsequent messages if already verified in session, 
    // but recommended if exposed publicly.
    if (recaptchaToken) {
        const recaptcha = await verifyRecaptcha(recaptchaToken)
        if (!recaptcha.success) throw new Error('reCAPTCHA failed')
    }

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
    const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true })

    if (error) throw error
    return data
}
