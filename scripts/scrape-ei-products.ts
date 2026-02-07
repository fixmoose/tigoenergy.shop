import pdf from 'pdf-parse/lib/pdf-parse.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

console.log('Supabase credentials loaded.');

const pdfUrl = 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/66e4bad420f2237432676751_002-00173-00%201.1%20Datasheet%20EI%20Residential%20Solar%20Solution%20EU%2020240904%20-%20EN.pdf';

interface ProductData {
    sku: string;
    description: string;
}

function extractEIProducts(text: string): ProductData[] {
    const items: ProductData[] = [];

    // Use global regex to find all part numbers
    // Pattern matches: 601-1103K0-0001TSI-3K1DEI Inverter – 3 kW single-phase
    const regex = /(\d{3}-\d{6}-\d{4})(TS[IBMKS]-[A-Z0-9.]+)?([^\n]*)/g;

    let match;
    while ((match = regex.exec(text)) !== null) {
        const sku = match[1];
        const modelNumber = match[2] || '';
        let description = match[3] || '';

        // Clean up description
        description = description
            .replace(/^\d+\s*/, '')  // Remove leading superscript numbers
            .replace(/\s+/g, ' ')     // Normalize whitespace
            .trim();

        // Create full product name
        const fullName = modelNumber && description
            ? `Tigo ${modelNumber} ${description}`
            : modelNumber
                ? `Tigo ${modelNumber}`
                : description || `Tigo EI Product ${sku}`;

        items.push({
            sku,
            description: fullName
        });
    }

    // Remove duplicates
    const uniqueItems = new Map();
    items.forEach(item => {
        if (!uniqueItems.has(item.sku)) {
            uniqueItems.set(item.sku, item);
        }
    });

    return Array.from(uniqueItems.values());
}

async function scrapeEIProducts() {
    try {
        console.log('Downloading PDF...');

        const response = await fetch(pdfUrl);
        if (!response.ok) {
            throw new Error(`Failed to download PDF: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const pdfBuffer = Buffer.from(arrayBuffer);

        console.log('Parsing PDF...');
        const pdfData = await pdf(pdfBuffer);

        console.log('Extracting products...');
        const products = extractEIProducts(pdfData.text);

        console.log(`\nFound ${products.length} unique SKUs:`);
        products.forEach(p => {
            console.log(`  ${p.sku} - ${p.description}`);
        });

        // Save to database
        console.log('\nSaving to database...');

        for (const item of products) {
            const productPayload = {
                name_en: item.description,
                description_en: 'EI Residential Solar Solution',
                sku: item.sku,
                slug: `ei-${item.sku}`.toLowerCase(),
                category: 'Energy Intelligence',
                subcategory: 'Residential',
                images: [],
                datasheet_url: pdfUrl,
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

    } catch (error) {
        console.error('Error:', error);
    }
}

scrapeEIProducts();
