import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import WelcomeClientActions from './WelcomeClientActions'

export default async function WelcomePage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login')
    }

    // Ensure customer record exists using service role (bypasses RLS)
    const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('id', user.id)
        .single()

    if (!existingCustomer) {
        // Create using service role key
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

        if (!serviceRoleKey || serviceRoleKey === 'your_service_role_key_here') {
            console.error('SUPABASE_SERVICE_ROLE_KEY is not configured!')
            // Fallback: try with regular client (may fail due to RLS)
            const addressFromMeta = user.user_metadata?.address ? [{
                id: 'init_' + Math.floor(Math.random() * 10000),
                street: user.user_metadata.address,
                city: user.user_metadata.city,
                postalCode: user.user_metadata.postal_code,
                country: user.user_metadata.country,
                isDefaultShipping: true,
                isDefaultBilling: true
            }] : []

            const newCustomer = {
                id: user.id,
                email: user.email!,
                first_name: user.user_metadata?.first_name || '',
                last_name: user.user_metadata?.last_name || '',
                phone: user.user_metadata?.phone || '',
                customer_type: user.user_metadata?.customer_type || 'b2c',
                is_b2b: user.user_metadata?.customer_type === 'b2b',
                newsletter_subscribed: user.user_metadata?.newsletter_subscribed || false,
                marketing_consent: user.user_metadata?.marketing_consent || false,
                updated_at: new Date().toISOString(),
                addresses: addressFromMeta
            }

            const { error } = await supabase.from('customers').insert(newCustomer)
            if (error) {
                console.error('Failed to create customer (no service key):', error)
            }
        } else {
            const serviceClient = createServiceClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                serviceRoleKey
            )

            const addressFromMeta = user.user_metadata?.address ? [{
                id: 'init_' + Math.floor(Math.random() * 10000),
                street: user.user_metadata.address,
                city: user.user_metadata.city,
                postalCode: user.user_metadata.postal_code,
                country: user.user_metadata.country,
                isDefaultShipping: true,
                isDefaultBilling: true
            }] : []

            const newCustomer = {
                id: user.id,
                email: user.email!,
                first_name: user.user_metadata?.first_name || '',
                last_name: user.user_metadata?.last_name || '',
                phone: user.user_metadata?.phone || '',
                customer_type: user.user_metadata?.customer_type || 'b2c',
                is_b2b: user.user_metadata?.customer_type === 'b2b',
                newsletter_subscribed: user.user_metadata?.newsletter_subscribed || false,
                marketing_consent: user.user_metadata?.marketing_consent || false,
                updated_at: new Date().toISOString(),
                addresses: addressFromMeta
            }

            const { error } = await serviceClient.from('customers').insert(newCustomer)
            if (error) {
                console.error('Failed to create customer:', error)
            }
        }
    }

    const firstName = user.user_metadata?.first_name || 'there'

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 px-4 pt-24 pb-12">
            <div className="max-w-lg w-full text-center mx-auto">
                {/* Client component to clear cart for new users */}
                <WelcomeClientActions />

                {/* Success Icon */}
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg animate-in zoom-in duration-500">
                    <svg
                        className="w-12 h-12 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M5 13l4 4L19 7"
                        />
                    </svg>
                </div>

                {/* Welcome Message */}
                <h1 className="text-4xl font-bold text-gray-900 mb-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                    Welcome, {firstName}!
                </h1>

                <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
                    <div className="flex items-center justify-center gap-2 text-green-600 mb-4">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="font-semibold">Account Verified</span>
                    </div>

                    <p className="text-lg text-gray-600 leading-relaxed">
                        Your email has been verified and your account is now active.
                        You can now shop for Tigo products at the <span className="font-semibold text-green-700">best prices available in Europe</span>.
                    </p>
                </div>

                {/* CTA Button */}
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 bg-green-600 text-white px-10 py-4 rounded-xl font-bold text-lg hover:bg-green-700 transition-all shadow-lg hover:shadow-xl hover:scale-105 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300"
                >
                    <span>Shop Now</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                </Link>

                <p className="mt-6 text-sm text-gray-500 animate-in fade-in duration-500 delay-500">
                    Or go to your{' '}
                    <Link href="/dashboard" className="text-green-600 hover:underline font-medium">
                        Dashboard
                    </Link>
                </p>
            </div>
        </div>
    )
}
