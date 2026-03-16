
'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail, renderTemplate, getEmailTranslations, notifyAdmins } from '@/lib/email'
import { headers } from 'next/headers'
import { getMarketFromKey } from '@/lib/constants/markets'

export async function registerUserAction(formData: any) {
    try {
        const supabase = await createAdminClient()
        const { email, password, firstName, lastName, phone, dob, occupation, address, address2, city, postalCode, country, newsletter, marketing, username } = formData

        const { data: userData, error: signUpError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
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

        if (signUpError) throw signUpError

        const user = userData.user
        if (!user) throw new Error('Failed to create user')

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
            const html = await renderTemplate('welcome', { name: firstName }, locale)
            await sendEmail({ to: email, subject, html, emailType: 'welcome' })
        } catch (emailError) {
            console.error('Failed to send welcome email:', emailError)
        }

        // Notify all admins of new registration
        notifyAdmins({
            subject: `[NEW REGISTRATION] ${firstName} ${lastName} (${email})`,
            html: `
                <h3>New Customer Registered</h3>
                <p><strong>Name:</strong> ${firstName} ${lastName}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Country:</strong> ${country || '—'}</p>
                <p><strong>Type:</strong> B2C</p>
                <p><a href="${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL}/admin/customers/${user.id}">View Customer in Admin</a></p>
            `,
        }).catch(err => console.error('Failed to send admin registration notification:', err))

        return { success: true }
    } catch (err: any) {
        console.error('Error in registerUserAction:', err)
        return { success: false, error: err.message || 'An unexpected error occurred' }
    }
}

export async function registerB2BUserAction(formData: any) {
    try {
        const supabase = await createAdminClient()
        const { email, password, firstName, lastName, phone, companyName, vatNumber, address, companyAddress2, city, postalCode, country, website, businessType, employees, commercialAccess, preferredCarrier, jobTitle, newsletter, marketing, extraShippingAddress, extraBillingAddress } = formData

        const { data: userData, error: signUpError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                first_name: firstName,
                last_name: lastName,
                company_name: companyName,
                vat_id: vatNumber,
                company_address: address,
                company_address2: companyAddress2,
                city,
                postal_code: postalCode,
                country,
                customer_type: 'b2b',
                phone,
                commercial_access: commercialAccess,
                business_type: businessType,
                website,
                employees,
                job_title: jobTitle,
                newsletter_subscribed: newsletter,
                marketing_consent: marketing,
            }
        })

        if (signUpError) throw signUpError
        const user = userData.user
        if (!user) throw new Error('Failed to create user')

        // Build addresses array: VIES address is always first (invoice address), extras appended
        const addresses: any[] = []
        if (address || city) {
            addresses.push({
                id: Math.random().toString(36).substr(2, 9),
                label: 'VIES Registered',
                street: address || '',
                street2: companyAddress2 || '',
                city: city || '',
                postalCode: postalCode || '',
                country: country || '',
                isViesAddress: true,
                isDefaultBilling: !extraBillingAddress,
                isDefaultShipping: !extraShippingAddress,
            })
        }
        if (extraShippingAddress?.street) {
            addresses.push({
                id: Math.random().toString(36).substr(2, 9),
                label: 'Shipping',
                street: extraShippingAddress.street,
                city: extraShippingAddress.city || '',
                postalCode: extraShippingAddress.postalCode || '',
                country: extraShippingAddress.country || country || '',
                isDefaultShipping: true,
                isDefaultBilling: false,
            })
        }
        if (extraBillingAddress?.street) {
            addresses.push({
                id: Math.random().toString(36).substr(2, 9),
                label: 'Billing',
                street: extraBillingAddress.street,
                city: extraBillingAddress.city || '',
                postalCode: extraBillingAddress.postalCode || '',
                country: extraBillingAddress.country || country || '',
                isDefaultShipping: false,
                isDefaultBilling: true,
            })
        }

        // Update customers table: core B2B fields + addresses
        // Retry up to 3 times in case the trigger hasn't created the row yet
        for (let attempt = 0; attempt < 3; attempt++) {
            if (attempt > 0) await new Promise(r => setTimeout(r, 500))
            const updatePayload: any = {
                company_name: companyName || null,
                vat_id: vatNumber || null,
                customer_type: 'b2b',
                is_b2b: true,
                first_name: firstName || null,
                last_name: lastName || null,
                phone: phone || null,
            }
            if (addresses.length > 0) updatePayload.addresses = addresses
            const { error: profileErr } = await supabase
                .from('customers')
                .update(updatePayload)
                .eq('id', user.id)
            if (!profileErr) break
        }

        const headersList = await headers()
        const marketKey = headersList.get('x-market-key') || 'SHOP'
        const market = getMarketFromKey(marketKey)
        const preferredLang = headersList.get('x-preferred-language')
        const locale = (preferredLang && market.availableLanguages.includes(preferredLang))
            ? preferredLang
            : market.defaultLanguage

        // Send confirmation to applicant
        try {
            const html = await renderTemplate('b2b-application-received', {
                name: firstName,
                company_name: companyName,
            }, locale)
            const translations = await getEmailTranslations(locale)
            const subject = translations.email?.b2bApplication?.title || 'B2B Application Received — Tigo Energy SHOP'
            await sendEmail({ to: email, subject, html, emailType: 'b2b_application' })
        } catch (emailError) {
            console.error('Failed to send B2B application email:', emailError)
        }

        // Notify all admins of new B2B application
        notifyAdmins({
            subject: `[NEW B2B APPLICATION] ${companyName} — ${firstName} ${lastName} (${email})`,
            html: `
                <h3>New B2B Application</h3>
                <p><strong>Company:</strong> ${companyName}</p>
                <p><strong>VAT:</strong> ${vatNumber}</p>
                <p><strong>Contact:</strong> ${firstName} ${lastName} (${jobTitle || '—'})</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Country:</strong> ${country}</p>
                <p><strong>Business Type:</strong> ${businessType}</p>
                <p><a href="${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL}/admin/customers/${user.id}">View in Admin</a></p>
            `,
        }).catch(err => console.error('Failed to send admin B2B notification:', err))

        return { success: true }
    } catch (err: any) {
        console.error('Error in registerB2BUserAction:', err)
        return { success: false, error: err.message || 'An unexpected error occurred' }
    }
}
