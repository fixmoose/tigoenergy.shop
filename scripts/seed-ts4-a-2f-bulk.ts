import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

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
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

const baseDescription = 'The Tigo TS4-A-2F is a reliable, cost effective rapid shutdown solution that meets the latest module level shutdown requirements, including NEC 2017/2020. The TS4-A-2F is both IEC and UL certified for global acceptance. It is UL PVRSS certified for connectivity with the largest network of inverters, many of which have a built in RSS transmitter. By connecting to two modules, the TS4-A-2F reduces labor time and enables 16% fewer connections on a 14 panel string compared to single channel MLPE. Functions: Rapid Shutdown. Features: Up to 725W (UL) 700W (IEC) per channel, 16-80V.';

const productsData = [
    // 20A Isc
    { sku: '484-00252-22', amps: '20A', cables: '0.13/0.2/2.2m', conn: 'MC4', voltage: '1500V/1000V' },
    { sku: '484-00252-24', amps: '20A', cables: '1.2/1.3/2.4m', conn: 'MC4', voltage: '1500V/1000V' },
    { sku: '484-00261-24', amps: '20A', cables: '1.2/1.3/2.4m', conn: 'EVO2', voltage: '1500V/1500V' },
    { sku: '484-00261-22', amps: '20A', cables: '0.13/0.2/2.2m', conn: 'EVO2', voltage: '1500V/1500V' },
    { sku: '484-01252-22', amps: '20A', cables: '0.13/0.2/2.2m', conn: 'MC4', voltage: '1500V/1000V' },
    { sku: '484-01252-24', amps: '20A', cables: '1.2/1.3/2.4m', conn: 'MC4', voltage: '1500V/1000V' },
    { sku: '484-01261-22', amps: '20A', cables: '0.13/0.2/2.2m', conn: 'EVO2', voltage: '1500V/1500V' },
    { sku: '484-01261-24', amps: '20A', cables: '1.2/1.3/2.4m', conn: 'EVO2', voltage: '1500V/1500V' },

    // 25A Isc
    { sku: '485-00252-22', amps: '25A', cables: '0.13/0.2/2.2m', conn: 'MC4', voltage: '1500V/1000V' },
    { sku: '485-00252-24', amps: '25A', cables: '1.2/1.3/2.4m', conn: 'MC4', voltage: '1500V/1000V' },
    { sku: '485-00261-22', amps: '25A', cables: '0.13/0.2/2.2m', conn: 'EVO2', voltage: '1500V/1500V' },
    { sku: '485-00261-24', amps: '25A', cables: '1.2/1.3/2.4m', conn: 'EVO2', voltage: '1500V/1500V' },
    { sku: '487-00252-22', amps: '25A', cables: '0.13/0.2/2.2m', conn: 'MC4', voltage: '1000V' }, // IEC only
    { sku: '487-00252-24', amps: '25A', cables: '1.2/1.3/2.4m', conn: 'MC4', voltage: '1000V' }, // IEC only
    { sku: '487-00261-22', amps: '25A', cables: '0.13/0.2/2.2m', conn: 'EVO2', voltage: '1500V' }, // IEC only
    { sku: '487-00261-24', amps: '25A', cables: '1.2/1.3/2.4m', conn: 'EVO2', voltage: '1500V' }, // IEC only
];

async function seed() {
    console.log(`Starting bulk seed of ${productsData.length} products...`)

    for (const p of productsData) {
        const name = `Tigo TS4-A-2F ${p.amps} ${p.cables} ${p.conn}`
        const slug = slugify(`${name}-${p.sku}`)

        console.log(`Seeding ${p.sku}: ${name}`)

        const product = {
            sku: p.sku,
            name_en: name,
            description_en: baseDescription,
            category: 'TS4 FLEX MLPE',
            subcategory: 'Fire Safety',
            price_eur: 0.00,
            cost_eur: 0.00,
            weight_kg: 0.00,
            stock_quantity: 100,
            active: true,
            images: ['https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/62d1a33c7cf94e2c746f7e12_TS4-A-2F%20outlined%20lowres.avif'],
            datasheet_url: 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/68ff983ffc9358dadc73c3f9_002-00092-00%202.8%20Datasheet%20TS4-A-2F%2020251009%20-%20EN.pdf',
            specifications: {
                voltage: p.voltage,
                amperage: p.amps,
                power: '700W x 2',
                connector: p.conn,
                cable_length: p.cables
            },
            production_type: 'New',
            slug
        }

        const { error } = await supabase.from('products').upsert(product, { onConflict: 'sku' })

        if (error) {
            console.error(`Error seeding ${p.sku}:`, error.message)
        }
    }

    console.log('Bulk seed complete!')
}

seed()
