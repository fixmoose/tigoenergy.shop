import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
// import slugify from 'slugify'

function slugify(text: string) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with -
        .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
        .replace(/\-\-+/g, '-')         // Replace multiple - with single -
        .replace(/^-+/, '')             // Trim - from start of text
        .replace(/-+$/, '');            // Trim - from end of text
}

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // Use anon key for now
const supabase = createClient(supabaseUrl, supabaseKey)

const product = {
    sku: '484-00252-22',
    name_en: 'Tigo TS4-A-2F Fire Safety (2 Module)',
    description_en: 'The Tigo TS4-A-2F is a reliable, cost effective rapid shutdown solution that meets the latest module level shutdown requirements, including NEC 2017/2020. The TS4-A-2F is both IEC and UL certified for global acceptance. It is UL PVRSS certified for connectivity with the largest network of inverters, many of which have a built in RSS transmitter. By connecting to two modules, the TS4-A-2F reduces labor time and enables 16% fewer connections on a 14 panel string compared to single channel MLPE. Functions: Rapid Shutdown. Features: Up to 725W (UL) 700W (IEC) per channel, 16-80V, 25A max per channel.',
    category: 'TS4 FLEX MLPE',
    subcategory: 'Fire Safety', // Consistent with TS4-A-F
    price_eur: 0.00, // consistently 0 for now as per other TS4-A-F
    cost_eur: 0.00, // Required field
    weight_kg: 0.00, // Required field
    stock_quantity: 100, // Default stock
    active: true,
    images: ['https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/62d1a33c7cf94e2c746f7e12_TS4-A-2F%20outlined%20lowres.avif'],
    datasheet_url: 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/68ff983ffc9358dadc73c3f9_002-00092-00%202.8%20Datasheet%20TS4-A-2F%2020251009%20-%20EN.pdf',
    specifications: {
        voltage: '80V',
        amperage: '25A',
        power: '700W x 2',
        connector: 'MC4/EVO2',
        cable_length: '1.2m/2.4m'
    },
    production_type: 'New'
}

async function seed() {
    console.log(`Seeding ${product.sku}...`)

    const slug = slugify(`${product.name_en}-${product.sku}`)

    const { error } = await supabase.from('products').upsert({
        ...product,
        slug
    }, { onConflict: 'sku' })

    if (error) {
        console.error('Error seeding:', error)
    } else {
        console.log('Success!')
    }
}

seed()
