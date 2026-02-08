
'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail, renderTemplate, getEmailTranslations } from '@/lib/email'
import { headers } from 'next/headers'
import { getMarketFromKey } from '@/lib/constants/markets'

export async function registerUserAction(formData: any) {
    const supabase = await createAdminClient()
    const { email, password, firstName, lastName, phone, dob, occupation, address, address2, city, postalCode, country, newsletter, marketing, username } = formData

    try {
        // 1. Create user in Supabase (Marked as confirmed because they verified via code in form)
        const { data: userData, error: signUpError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // User already verified in font-end step
            user_metadata: {
                first_name: firstName,
                last_name: lastName,
                phone: phone,
                dob,
                occupation,
                address,
                address_line2: address2,
                city,
                postal_code: postalCode,
                country,
                newsletter_subscribed: newsletter,
                marketing_consent: marketing,
                username,
                customer_type: 'b2c'
            }
        })

        if (signUpError) {
            return { error: signUpError.message }
        }

        const user = userData.user
        if (!user) return { error: 'Failed to create user' }

        // 2. Send Welcome email via UniOne
        const headersList = await headers()
        const marketKey = headersList.get('x-market-key') || 'SHOP'
        const market = getMarketFromKey(marketKey)
        const preferredLang = headersList.get('x-preferred-language')
        const locale = (preferredLang && market.availableLanguages.includes(preferredLang))
            ? preferredLang
            : market.defaultLanguage

        try {
            const translations = await getEmailTranslations(locale)
            const subject = translations.email?.welcome?.title || 'Welcome to Tigo Energy SHOP'

            const html = await renderTemplate('welcome', {
                name: firstName,
            }, locale)

            await sendEmail({
                to: email,
                subject: subject,
                html
            })
        } catch (emailError) {
            console.error('Failed to send welcome email:', emailError)
            // Still return success since user is created
        }

        return { success: true }

    } catch (err: any) {
        console.error('Registration error:', err)
        return { error: err.message || 'An unexpected error occurred' }
    }
}
