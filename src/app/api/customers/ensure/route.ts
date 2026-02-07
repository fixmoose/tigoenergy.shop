import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST() {
    // Get the current user from the regular client
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check if customer already exists
    const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('id', user.id)
        .single()

    if (existingCustomer) {
        return NextResponse.json({ success: true, customer: existingCustomer })
    }

    // Create customer using service role (bypasses RLS)
    const serviceClient = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
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
        customer_type: user.user_metadata?.customer_type || 'b2c',
        is_b2b: user.user_metadata?.customer_type === 'b2b',
        newsletter_subscribed: user.user_metadata?.newsletter_subscribed || false,
        marketing_consent: user.user_metadata?.marketing_consent || false,
        updated_at: new Date().toISOString(),
        addresses: addressFromMeta
    }

    const { data: customer, error } = await serviceClient
        .from('customers')
        .insert(newCustomer)
        .select()
        .single()

    if (error) {
        console.error('Failed to create customer:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, customer })
}
