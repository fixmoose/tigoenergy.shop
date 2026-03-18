import { randomInt } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendEmail, renderTemplate } from '@/lib/email'

/**
 * POST /api/account/change-password
 *
 * Step 1 (action: "send-code"): Sends a 6-digit OTP to the user's email.
 * Step 2 (action: "verify-and-change"): Verifies OTP + current password, sets new password.
 */
export async function POST(req: NextRequest) {
    try {
        const userSupabase = await createClient()
        const { data: { user } } = await userSupabase.auth.getUser()
        if (!user?.email) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const body = await req.json()
        const { action } = body
        const adminSupabase = await createAdminClient()

        if (action === 'send-code') {
            const code = randomInt(100000, 999999).toString()
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

            // Clear old codes and insert new one
            await adminSupabase.from('guest_verifications').delete().eq('email', user.email)
            const { error: dbError } = await adminSupabase.from('guest_verifications').insert({
                email: user.email,
                otp_code: code,
                expires_at: expiresAt,
                verified: false,
            })

            if (dbError) {
                console.error('Failed to store OTP:', dbError)
                return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 })
            }

            // Detect locale from cookie or accept-language
            let locale = 'en'
            const cookieLocale = req.cookies.get('NEXT_LOCALE')?.value
            if (cookieLocale) {
                locale = cookieLocale
            } else {
                const acceptLang = req.headers.get('accept-language')
                if (acceptLang) {
                    const preferred = acceptLang.split(',')[0]?.split('-')[0]?.toLowerCase()
                    if (preferred && ['sl', 'de', 'fr', 'it', 'es', 'nl', 'pl', 'hr', 'cs', 'sk'].includes(preferred)) {
                        locale = preferred
                    }
                }
            }

            // Render and send OTP email
            try {
                const html = await renderTemplate('verification-code', {
                    code,
                    email: user.email,
                }, locale)

                const subjectMap: Record<string, string> = {
                    sl: 'Vaša potrditvena koda',
                    de: 'Ihr Bestätigungscode',
                    fr: 'Votre code de vérification',
                    it: 'Il tuo codice di verifica',
                    es: 'Tu código de verificación',
                    hr: 'Vaš verifikacijski kod',
                }

                await sendEmail({
                    to: user.email,
                    subject: subjectMap[locale] || 'Your Verification Code',
                    html,
                    emailType: 'password_change_otp',
                    skipUnsubscribe: true,
                })
            } catch (emailErr) {
                console.error('Failed to send OTP email:', emailErr)
                // Clean up the code since email failed
                await adminSupabase.from('guest_verifications').delete().eq('email', user.email)
                return NextResponse.json({ error: 'Failed to send verification email' }, { status: 500 })
            }

            return NextResponse.json({ success: true })
        }

        if (action === 'verify-and-change') {
            const { code, currentPassword, newPassword } = body

            if (!code || !newPassword) {
                return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
            }

            if (newPassword.length < 8) {
                return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
            }

            // Verify OTP
            const { data: otpRecord, error: otpError } = await adminSupabase
                .from('guest_verifications')
                .select('*')
                .eq('email', user.email)
                .eq('otp_code', code)
                .single()

            if (otpError || !otpRecord) {
                return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
            }

            if (new Date(otpRecord.expires_at) < new Date()) {
                return NextResponse.json({ error: 'Code has expired' }, { status: 400 })
            }

            // Verify current password using user's own supabase client
            if (currentPassword) {
                const { error: signInError } = await userSupabase.auth.signInWithPassword({
                    email: user.email,
                    password: currentPassword,
                })
                if (signInError) {
                    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
                }
            }

            // Update password via admin API
            const { error: updateError } = await adminSupabase.auth.admin.updateUserById(user.id, {
                password: newPassword,
            })

            if (updateError) {
                console.error('Failed to update password:', updateError)
                return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
            }

            // Clean up OTP
            await adminSupabase.from('guest_verifications').delete().eq('email', user.email)

            return NextResponse.json({ success: true })
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    } catch (err: any) {
        console.error('Change password error:', err)
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 })
    }
}
