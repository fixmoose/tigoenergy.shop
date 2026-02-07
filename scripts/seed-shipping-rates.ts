
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const shippingRates = [
    // Slovenia (Domestic)
    { country_code: 'SI', zone: 'domestic', min_weight_kg: 0, max_weight_kg: 2, rate_eur: 4.50, carrier: 'GLS', service_type: 'standard' },
    { country_code: 'SI', zone: 'domestic', min_weight_kg: 2, max_weight_kg: 5, rate_eur: 5.50, carrier: 'GLS', service_type: 'standard' },
    { country_code: 'SI', zone: 'domestic', min_weight_kg: 5, max_weight_kg: 10, rate_eur: 6.50, carrier: 'GLS', service_type: 'standard' },
    { country_code: 'SI', zone: 'domestic', min_weight_kg: 10, max_weight_kg: 20, rate_eur: 8.50, carrier: 'GLS', service_type: 'standard' },
    { country_code: 'SI', zone: 'domestic', min_weight_kg: 20, max_weight_kg: 40, rate_eur: 12.50, carrier: 'GLS', service_type: 'standard' },
    { country_code: 'SI', zone: 'domestic', min_weight_kg: 0, max_weight_kg: 999, rate_eur: 0.00, carrier: 'Local Pickup', service_type: 'pickup' },

    // Germany (Zone 1)
    { country_code: 'DE', zone: 'eu', min_weight_kg: 0, max_weight_kg: 2, rate_eur: 12.50, carrier: 'GLS', service_type: 'standard' },
    { country_code: 'DE', zone: 'eu', min_weight_kg: 2, max_weight_kg: 5, rate_eur: 14.50, carrier: 'GLS', service_type: 'standard' },
    { country_code: 'DE', zone: 'eu', min_weight_kg: 5, max_weight_kg: 10, rate_eur: 17.50, carrier: 'GLS', service_type: 'standard' },
    { country_code: 'DE', zone: 'eu', min_weight_kg: 10, max_weight_kg: 20, rate_eur: 22.50, carrier: 'GLS', service_type: 'standard' },
    { country_code: 'DE', zone: 'eu', min_weight_kg: 20, max_weight_kg: 40, rate_eur: 35.00, carrier: 'GLS', service_type: 'standard' },

    // Austria (Zone 1)
    { country_code: 'AT', zone: 'eu', min_weight_kg: 0, max_weight_kg: 2, rate_eur: 11.50, carrier: 'GLS', service_type: 'standard' },
    { country_code: 'AT', zone: 'eu', min_weight_kg: 2, max_weight_kg: 5, rate_eur: 13.50, carrier: 'GLS', service_type: 'standard' },
    { country_code: 'AT', zone: 'eu', min_weight_kg: 5, max_weight_kg: 10, rate_eur: 16.50, carrier: 'GLS', service_type: 'standard' },
    { country_code: 'AT', zone: 'eu', min_weight_kg: 10, max_weight_kg: 20, rate_eur: 21.50, carrier: 'GLS', service_type: 'standard' },

    // Italy (Zone 1)
    { country_code: 'IT', zone: 'eu', min_weight_kg: 0, max_weight_kg: 2, rate_eur: 13.50, carrier: 'GLS', service_type: 'standard' },
    { country_code: 'IT', zone: 'eu', min_weight_kg: 2, max_weight_kg: 5, rate_eur: 15.50, carrier: 'GLS', service_type: 'standard' },
    { country_code: 'IT', zone: 'eu', min_weight_kg: 5, max_weight_kg: 10, rate_eur: 19.50, carrier: 'GLS', service_type: 'standard' },

    // Croatia (Domestic-ish)
    { country_code: 'HR', zone: 'eu', min_weight_kg: 0, max_weight_kg: 2, rate_eur: 9.50, carrier: 'GLS', service_type: 'standard' },
    { country_code: 'HR', zone: 'eu', min_weight_kg: 2, max_weight_kg: 5, rate_eur: 11.50, carrier: 'GLS', service_type: 'standard' },
    { country_code: 'HR', zone: 'eu', min_weight_kg: 5, max_weight_kg: 10, rate_eur: 14.50, carrier: 'GLS', service_type: 'standard' },
]

async function seed() {
    console.log('Cleaning existing shipping rates...')
    const { error: deleteError } = await supabase.from('shipping_rates').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (deleteError) {
        console.error('Error cleaning table:', deleteError)
        return
    }

    console.log(`Inserting ${shippingRates.length} shipping rates...`)
    const { error: insertError } = await supabase.from('shipping_rates').insert(shippingRates)

    if (insertError) {
        console.error('Error seeding shipping rates:', insertError)
    } else {
        console.log('Successfully seeded shipping rates!')
    }
}

seed()
