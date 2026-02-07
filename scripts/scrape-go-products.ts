import pdf from 'pdf-parse/lib/pdf-parse.js';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('Supabase credentials loaded.');

// GO EV Charger PDF
const evChargerPdfUrl = 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/65afe07113585b9fb4900f82_GO%20EV%20Charger%20datasheet%20002-00148-00%201.2%2020240119.pdf';

// GO Junction page
const goJunctionUrl = 'https://www.tigoenergy.com/product/go-junction-eu';

interface ProductData {
    sku: string;
    description: string;
}

async function scrapeGOProducts() {
    try {
        // 1. Scrape GO EV Charger from PDF
        console.log('\n=== Scraping GO EV Charger ===');
        console.log('Downloading PDF...');

        const response = await fetch(evChargerPdfUrl);
        if (!response.ok) {
            throw new Error(`Failed to download PDF: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const pdfBuffer = Buffer.from(arrayBuffer);

        console.log('Parsing PDF...');
        const pdfData = await pdf(pdfBuffer);

        console.log('Extracting products...');

        // Extract all part numbers from the PDF
        const regex = /(\d{3}-\d{6}-\d{4})(TG[A-Z0-9-]+)?([^\n]*)/g;
        const evProducts: ProductData[] = [];

        let match;
        while ((match = regex.exec(pdfData.text)) !== null) {
            const sku = match[1];
            const modelNumber = match[2] || '';
            let description = match[3] || '';

            description = description
                .replace(/^\d+\s*/, '')
                .replace(/\s+/g, ' ')
                .trim();

            const fullName = modelNumber && description
                ? `Tigo ${modelNumber} ${description}`
                : modelNumber
                    ? `Tigo ${modelNumber}`
                    : description || `Tigo GO EV Charger ${sku}`;

            evProducts.push({
                sku,
                description: fullName
            });
        }

        // Remove duplicates
        const uniqueEV = new Map();
        evProducts.forEach(item => {
            if (!uniqueEV.has(item.sku)) {
                uniqueEV.set(item.sku, item);
            }
        });

        const evProductsList = Array.from(uniqueEV.values());

        console.log(`Found ${evProductsList.length} GO EV Charger SKUs:`);
        evProductsList.forEach(p => {
            console.log(`  ${p.sku} - ${p.description}`);
        });

        // Save GO EV Charger products
        for (const item of evProductsList) {
            const productPayload = {
                name_en: item.description,
                description_en: 'GO EV Charger',
                sku: item.sku,
                slug: `go-ev-charger-${item.sku}`.toLowerCase(),
                category: 'Energy Intelligence',
                subcategory: 'EV Charging',
                images: [],
                datasheet_url: evChargerPdfUrl,
                specifications: {},
                price_eur: 0,
                cost_eur: 0,
                stock_quantity: 0,
                weight_kg: 0,
                active: true
            };

            const { error } = await supabase.from('products').upsert(productPayload, {
                onConflict: 'sku',
                ignoreDuplicates: false
            });

            if (error) {
                console.error(`Error saving ${item.sku}:`, error.message);
            } else {
                console.log(`Saved ${item.sku}`);
            }
        }

        // 2. Scrape GO Junction from webpage
        console.log('\n=== Scraping GO Junction ===');
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        await page.goto(goJunctionUrl, { waitUntil: 'networkidle', timeout: 60000 });

        // Look for SKU 002-00171-00 on the page
        const pageContent = await page.content();

        // Try to find product name
        const productName = await page.locator('h1').first().textContent() || 'Tigo GO Junction EU';

        console.log(`Found product: ${productName}`);
        console.log(`SKU: 002-00171-00`);

        // Find datasheet URL
        const datasheetLinks = await page.locator('a[href*=".pdf"]').all();
        let datasheetUrl = '';

        for (const link of datasheetLinks) {
            const href = await link.getAttribute('href');
            if (href && href.includes('002-00171')) {
                datasheetUrl = href.startsWith('http') ? href : `https://www.tigoenergy.com${href}`;
                break;
            }
        }

        // If no specific datasheet found, look for any PDF link
        if (!datasheetUrl && datasheetLinks.length > 0) {
            const href = await datasheetLinks[0].getAttribute('href');
            if (href) {
                datasheetUrl = href.startsWith('http') ? href : `https://cdn.prod.website-files.com${href}`;
            }
        }

        console.log(`Datasheet URL: ${datasheetUrl || 'Not found'}`);

        await browser.close();

        // Save GO Junction product
        const junctionPayload = {
            name_en: productName,
            description_en: 'GO Junction EU',
            sku: '002-00171-00',
            slug: 'go-junction-eu-002-00171-00',
            category: 'Energy Intelligence',
            subcategory: 'Accessories',
            images: [],
            datasheet_url: datasheetUrl || goJunctionUrl,
            specifications: {},
            price_eur: 0,
            cost_eur: 0,
            stock_quantity: 0,
            weight_kg: 0,
            active: true
        };

        const { error: junctionError } = await supabase.from('products').upsert(junctionPayload, {
            onConflict: 'sku',
            ignoreDuplicates: false
        });

        if (junctionError) {
            console.error(`Error saving GO Junction:`, junctionError.message);
        } else {
            console.log(`Saved 002-00171-00`);
        }

        console.log('\n=== Done! ===');

    } catch (error) {
        console.error('Error:', error);
    }
}

scrapeGOProducts();
