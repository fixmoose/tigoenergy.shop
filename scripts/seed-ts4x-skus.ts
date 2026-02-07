
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Use user-provided datasheet URLs or defaults if better
const DATASHEETS = [
    {
        type: 'TS4-X-O',
        url: 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/696e775ff35ada21d38eea82_002-00203-90%201.2%20Datasheet%20TS4-X-O%2020251210%20-%20AU%20%26%20NZ.pdf',
        category: 'TS4-X MLPE',
        subcategory: 'Optimization'
    },
    {
        type: 'TS4-X-S',
        url: 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/682f36b7ccb33d030cf3fd3d_002-00204-00%201.1%20Datasheet%20TS4-X-S%2020250429%20-%20EN.pdf',
        category: 'TS4-X MLPE',
        subcategory: 'Safety'
    },
    {
        type: 'TS4-X-F',
        url: 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/682e4529c067c0f8d2da3194_002-00205-00%201.1%20Datasheet%20TS4-X-F%2020250430%20-%20EN.pdf',
        category: 'TS4-X MLPE',
        subcategory: 'Fire Safety'
    }
];

interface ProductSku {
    sku: string;
    cable: string;
    connector: string;
}

// Extract SKUs from PDF text
function extractSkus(text: string): ProductSku[] {
    const items: ProductSku[] = [];

    // Updated Regex with relaxed spacing/hyphens
    // Tries to catch: 501-320612-2501, 501 320612 2501, etc.
    const skuRegex = /(5\d{2}[-\s]?\d{6}[-\s]?\d{4})/g;

    let match;
    while ((match = skuRegex.exec(text)) !== null) {
        // Normalize SKU to Dashed format
        let rawSku = match[1];
        const normalizedSku = rawSku.replace(/\s/g, '-').replace(/--/g, '-');

        let cable = 'N/A';
        let connector = 'N/A';

        // Parse new TS4-X SKU format: AAA-BBCCCC-DDDD
        // AAA: Series (501=X-O, 502=X-S, 503=X-F)
        // BB: Connector (32=EVO2, 34=MC4)
        // CCCC: Cable Config (0612=0.6/1.2m, 1220=1.2/2m)

        const cleanSku = normalizedSku.replace(/-/g, '');
        // 5013206122501 -> Length 13
        if (cleanSku.length === 13) {
            const middle = cleanSku.substring(3, 9); // 320612

            // Connector Logic
            if (middle.startsWith('32')) connector = 'EVO2';
            else if (middle.startsWith('34')) connector = 'MC4';

            // Cable Logic
            if (middle.includes('0612')) cable = '0.6/1.2m';
            else if (middle.includes('1220')) cable = '1.2/2m';
        }

        // Final properly formatted SKU with dashes
        const formattedSku = `${cleanSku.substring(0, 3)}-${cleanSku.substring(3, 9)}-${cleanSku.substring(9)}`;

        items.push({ sku: formattedSku, cable, connector });
    }

    // De-duplicate
    const unique = new Map();
    items.forEach(i => unique.set(i.sku, i));
    return Array.from(unique.values());
}

async function run() {
    const browser = await chromium.launch({ headless: true });

    for (const sheet of DATASHEETS) {
        console.log(`Processing ${sheet.type}...`);

        const { data: generic } = await supabase.from('products')
            .select('*')
            .ilike('name_en', `%${sheet.type}%`)
            .limit(1)
            .single();

        let images = generic?.images || [];
        let description = generic?.description_en ||
            (sheet.type === 'TS4-X-O' ? 'Optimization\nMonitoring\nRapid Shutdown' :
                sheet.type === 'TS4-X-S' ? 'Monitoring\nRapid Shutdown' : 'Rapid Shutdown');

        const page = await browser.newPage();
        try {
            console.log(`Downloading ${sheet.url}...`);
            const downloadPromise = page.waitForEvent('download', { timeout: 15000 });

            try {
                await page.goto(sheet.url, { timeout: 10000, waitUntil: 'domcontentloaded' });
            } catch (e) { }

            const download = await downloadPromise;
            const pdfPath = await download.path();
            const pdfBuffer = fs.readFileSync(pdfPath);

            // 2. Parse PDF
            const pdfData = await pdf(pdfBuffer);
            const text = pdfData.text;

            console.log(`Extracted ${text.length} chars from PDF.`);
            console.log('--- START PDF TEXT SAMPLE ---');
            console.log(text.substring(0, 3000));
            console.log('--- END PDF TEXT SAMPLE ---');

            // 3. Extract SKUs
            const skus = extractSkus(text);
            console.log(`Found ${skus.length} SKUs for ${sheet.type}:`);
            skus.forEach(s => console.log(` - ${s.sku} (${s.cable}, ${s.connector})`));

            // 4. Insert Products
            if (skus.length > 0) {
                // Delete the generic placeholder if it exists
                await supabase.from('products').delete().eq('sku', sheet.type);
                await supabase.from('products').delete().ilike('sku', '002-%'); // remove old

                for (const item of skus) {
                    let finalCable = item.cable === 'N/A' ? '1.2/2m' : item.cable;
                    let finalConnector = item.connector === 'N/A' ? 'MC4' : item.connector;

                    const name = `Tigo ${sheet.type} ${finalCable} ${finalConnector}`;
                    const slug = `${sheet.type.toLowerCase()}-${item.sku}`.toLowerCase();

                    const payload = {
                        name_en: name,
                        description_en: description,
                        sku: item.sku,
                        slug: slug,
                        category: sheet.category,
                        subcategory: sheet.subcategory,
                        images: images,
                        datasheet_url: sheet.url,
                        specifications: {
                            amperage: '25A',
                            voltage: '80V',
                            power: '800W',
                            cable_length: finalCable,
                            connector: finalConnector
                        },
                        weight_kg: 0.52,
                        active: true,
                        stock_quantity: 50,
                        price_eur: 0,
                        cost_eur: 0,
                        production_type: 'New'
                    };

                    const { error } = await supabase.from('products').upsert(payload, { onConflict: 'sku' });
                    if (error) console.error(`Error upserting ${item.sku}:`, error);
                    else console.log(`Upserted ${item.sku}`);
                }
            } else {
                console.warn(`No SKUs extracted for ${sheet.type}. Check regex or manually add.`);
            }

        } catch (e) {
            console.error(`Error processing ${sheet.type}:`, e);
        } finally {
            await page.close();
        }
    }

    await browser.close();
}

run();
