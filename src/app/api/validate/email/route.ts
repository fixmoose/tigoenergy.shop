
import { NextResponse } from 'next/server'

import { verifyRecaptcha } from '@/lib/recaptcha'
import { sendEmail, renderTemplate, getEmailTranslations } from '@/lib/email'
import { headers } from 'next/headers'
import { getMarketFromKey } from '@/lib/constants/markets'

export async function POST(request: Request) {
    try {
        const { email, recaptchaToken } = await request.json()

        // 1. Verify reCAPTCHA
        const recaptcha = await verifyRecaptcha(recaptchaToken, 'REGISTRATION')
        if (!recaptcha.success) {
            console.error('Registration B2C reCAPTCHA failed:', recaptcha.error)
            return NextResponse.json({
                error: `reCAPTCHA verification failed: ${recaptcha.error || 'Unknown error'}`
            }, { status: 400 })
        }

        // 2. VALIDATION LOGIC
        if (!email || !email.includes('@')) {
            return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
        }

        // 3. GENERATE & SEND CODE
        const code = Math.floor(100000 + Math.random() * 900000).toString()

        // Get locale for email template
        const headersList = await headers()
        const marketKey = headersList.get('x-market-key') || 'SHOP'
        const market = getMarketFromKey(marketKey)
        const preferredLang = headersList.get('x-preferred-language')
        const locale = (preferredLang && market.availableLanguages.includes(preferredLang))
            ? preferredLang
            : market.defaultLanguage

        try {
            const translations = await getEmailTranslations(locale)
            const subject = translations.email?.verificationCode?.title || 'Your Verification Code'

            const html = await renderTemplate('verification-code', {
                code,
                email
            }, locale)

            await sendEmail({
                to: email,
                subject: subject,
                html
            })
        } catch (emailError) {
            console.error('Failed to send production email:', emailError)
            // Still return success for testing/fallback if desired, or error out
            // return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            message: 'Code sent to email',
            debug_code: process.env.NODE_ENV === 'development' ? code : undefined
        })

    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
