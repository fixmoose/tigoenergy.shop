import { randomInt } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendEmail, renderTemplate, getEmailTranslations } from '@/lib/email'
import { headers } from 'next/headers'
import { getMarketFromKey } from '@/lib/constants/markets'

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
        const supabase = await createAdminClient()

        if (action === 'send-code') {
            // Generate OTP and store in guest_verifications (reusing existing table)
            const code = randomInt(100000, 999999).toString()
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 min

            await supabase.from('guest_verifications').delete().eq('email', user.email)
            const { error: dbError } = await supabase.from('guest_verifications').insert({
                email: user.email,
                otp_code: code,
                expires_at: expiresAt,
                verified: false,
            })

            if (dbError) {
                return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 })
            }

            // Send the OTP email
            const headersList = await headers()
            const marketKey = headersList.get('x-market-key') || 'SHOP'
            const market = getMarketFromKey(marketKey)
            const preferredLang = headersList.get('x-preferred-language')
            const locale = (preferredLang && market.availableLanguages.includes(preferredLang))
                ? preferredLang
                : market.defaultLanguage

            const translations = await getEmailTranslations(locale)
            const subject = translations.email?.verificationCode?.title || 'Your Verification Code'

            const html = await renderTemplate('verification-code', {
                code,
                email: user.email,
            }, locale)

            await sendEmail({
                to: user.email,
                subject,
                html,
                emailType: 'password_change_otp',
            })

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
            const { data: otpRecord, error: otpError } = await supabase
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

            // Verify current password by attempting sign-in
            if (currentPassword) {
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email: user.email,
                    password: currentPassword,
                })
                if (signInError) {
                    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
                }
            }

            // Update password via admin API
            const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
                password: newPassword,
            })

            if (updateError) {
                return NextResponse.json({ error: 'Failed to update password' }, { status: 500 })
            }

            // Clean up OTP
            await supabase.from('guest_verifications').delete().eq('email', user.email)

            return NextResponse.json({ success: true })
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    } catch (err: any) {
        console.error('Change password error:', err)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
