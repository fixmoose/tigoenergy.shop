
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import https from 'https';
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
} else {
    console.log('Supabase credentials loaded.');
    console.log('URL:', supabaseUrl);
    console.log('Key length:', supabaseServiceKey.length);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const productUrls = [
    'https://www.tigoenergy.com/product/ts4-a-o',
    'https://www.tigoenergy.com/product/cloud-connect-advanced',
    'https://www.tigoenergy.com/product/tigo-access-point',
    'https://www.tigoenergy.com/product/rss-transmitter'
];

// Removed node https usage to use playwright context instead

async function downloadPdfInBrowser(page: any, url: string): Promise<Buffer> {
    try {
        console.log('Waiting for download event...');
        const downloadPromise = page.waitForEvent('download', { timeout: 10000 });

        // Trigger navigation, but don't await it strictly if it throws due to download
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
        } catch (e: any) {
            console.log('Navigation error (expected for downloads):', e.message);
        }

        const download = await downloadPromise;
        const stream = await download.createReadStream();
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    } catch (e: any) {
        console.log('Download failed or not a download, trying response body...', e.message);
        // Fallback: maybe it's a direct display
        const response = await page.goto(url);
        if (!response) throw new Error('Failed to load PDF URL');
        return await response.body();
    }
}

interface ProductData {
    sku: string;
    cable: string;
    connector: string;
}

function extractProductData(text: string): ProductData[] {
    const items: ProductData[] = [];
    // Enhanced Regex to capture Tigo SKUs: 3 digits - 5 digits - 2 digits
    // Examples: 461-00252-20, 344-00000-52
    // Also capture cable/connector if available in the same line or nearby context?
    // For now, let's just extract the SKU primarily.
    const skuRegex = /(\d{3}-\d{5}-\d{2})/g;

    let match;
    while ((match = skuRegex.exec(text)) !== null) {
        const sku = match[1];

        // Parse cable length and connector from SKU pattern
        // SKU format: 46X-00YYY-ZZ where:
        // X = 1 (MC4) or 2 (Amphenol H4)
        // YYY = cable code (252=1.2m, 261=2m, etc.)

        let cable = 'N/A';
        let connector = 'N/A';

        // Extract connector type from first digit after 46
        if (sku.startsWith('461-')) {
            connector = 'MC4';
        } else if (sku.startsWith('462-')) {
            connector = 'EVO2';
        }

        // Extract cable length from middle digits
        // Format should be "1.2/2m" (input/output) not just "2m"
        if (sku.includes('-00252-') || sku.includes('-01252-')) {
            cable = '1.2/2m';
        } else if (sku.includes('-00261-')) {
            cable = '1.2/2m';
        } else if (sku.includes('-00262-')) {
            cable = '1.2/2m';
        }

        // For better accuracy, try to find cable info in surrounding text
        // Look for patterns like "1.2/2m" or "1.2m" near the SKU
        const contextStart = Math.max(0, match.index - 200);
        const contextEnd = Math.min(text.length, match.index + 200);
        const context = text.substring(contextStart, contextEnd);

        // Match patterns like "1.2/2m", "1.2m", "2m", etc.
        const cableMatch = context.match(/(\d+\.?\d*\/?\d*m)/);
        if (cableMatch && cable === 'N/A') {
            cable = cableMatch[1];
        }

        items.push({
            sku,
            cable,
            connector
        });
    }

    // Remove duplicates based on SKU
    const uniqueItems = new Map();
    items.forEach(item => {
        if (!uniqueItems.has(item.sku)) {
            uniqueItems.set(item.sku, item);
        }
    });

    return Array.from(uniqueItems.values());
}

function extractWeight(text: string): number {
    // Regex for Weight: e.g. "Weight 520 g" or "Weight520 g"
    const regex = /Weight\s*(\d+(?:\.\d+)?)\s*g/i;
    const match = text.match(regex);
    if (match && match[1]) {
        return parseFloat(match[1]);
    }
    return 0;
}

async function scrapeAndSeed() {
    const browser = await chromium.launch({ headless: true });

    for (const url of productUrls) {
        console.log(`Starting scraper for ${url}...`);
        const page = await browser.newPage();

        try {
            await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

            // Scroll down
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(2000);

            // 1. Scrape Basic Info
            const title = await page.evaluate(() => document.querySelector('h1')?.innerText.trim() || 'Tigo Product');

            // Determine Categories based on URL/Title
            let category = 'ts4-flex-mlpe';
            let subcategory = 'Optimization';

            if (url.includes('ts4-a-o')) {
                category = 'ts4-flex-mlpe';
                subcategory = 'Optimization';
            } else if (url.includes('cloud-connect-advanced')) {
                category = 'communications';
                subcategory = 'Data Loggers';
            } else if (url.includes('tigo-access-point')) {
                category = 'communications';
                subcategory = 'Access Points';
            } else if (url.includes('rss-transmitter')) {
                category = 'communications';
                subcategory = 'Rapid Shutdown';
            }

            // Description extraction
            let description = '';
            // ... (Keep existing simple logic or improve)
            description = await page.evaluate(() => document.querySelector('.rich-text-block')?.textContent?.trim() || '');
            if (!description && url.includes('ts4-a-o')) {
                // Fallback to hardcoded for TS4-A-O as before
                description = `Optimization is a Flex MLPE function available as an integrated modular junction box base (TS4-O) or as an add-on unit (TS4-A-O). Design using unequal string lengths, mixed orientations, or areas of mismatch. Install in shaded areas with a reduced setback ratio. In addition to optimization, the TS4-A-O enables module level monitoring, and rapid shutdown in compliance with NEC 2014, 2017, 2020.

Functions
Optimization
Monitoring
Rapid Shutdown

Features and benefits
Suitable for up to 725W (UL), 700W (IEC) solar modules
The higher performance optimizer with Predictive IV Technology (PIV)
The ONLY optimizer with selective deployment
Includes the benefits of Safety & Monitoring
Meets US NEC rapid shutdown requirements
Optimizes right out of the box
Shade and age tolerance to maximize lifetime yield
Works wirelessly with the TAP & CCA
25-year warranty

Configuration
1 module per TS4

Required
CCA + TAP`;
            }

            // Images
            const images = await page.evaluate(() => {
                const mainImg = document.querySelector('img.product-left');
                return mainImg ? [(mainImg as HTMLImageElement).src] : [];
            });
            if (images.length === 0) {
                // Fallback for comms pages which might differ
                const fallbackImgs = await page.evaluate(() => Array.from(document.querySelectorAll('img')).filter(img => img.src.includes('prod.website-files.com')).map(img => img.src).slice(0, 1));
                if (fallbackImgs.length > 0) images.push(...fallbackImgs);
            }

            // Metadata
            const slug = url.split('/').pop() || 'product';

            // 2. Find Downloads
            // Uses the same logic as before (verified to work generally)
            const downloads = await page.evaluate(() => {
                const items = Array.from(document.querySelectorAll('.collection-text-downloads'));
                return items.map(item => {
                    const clone = item.cloneNode(true) as HTMLElement;
                    Array.from(clone.querySelectorAll('a')).forEach((a: any) => a.remove());
                    let title = clone.textContent?.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim() || '';
                    const languages = Array.from(item.querySelectorAll('a'))
                        .filter(a => (a as HTMLAnchorElement).href.endsWith('.pdf'))
                        .map(link => {
                            const a = link as HTMLAnchorElement;
                            let lang = a.textContent?.trim() || 'DL';
                            if (lang === 'Download') lang = 'EN';
                            return { lang, url: a.href };
                        });
                    if (!title && languages.length > 0) title = 'Document';
                    return { title, languages };
                }).filter(d => d.languages.length > 0);
            });

            console.log(`Found ${downloads.length} potential downloads for ${slug}.`);

            // PDF Parsing Logic
            const findDocUrl = (keyword: string) => {
                if (slug === 'rss-transmitter') {
                    // User requested specific datasheet:
                    // https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/680fae5df8b93aad651a7e39_002-00146-00%201.4%20Datasheet%20RSS%20w%20PCBA%2020250411%20-%20EN.pdf
                    return 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/680fae5df8b93aad651a7e39_002-00146-00%201.4%20Datasheet%20RSS%20w%20PCBA%2020250411%20-%20EN.pdf';
                }

                const doc = downloads.find(d => d.title.toLowerCase().includes(keyword.toLowerCase()));
                return doc?.languages?.[0]?.url;
            }
            const datasheetUrl = findDocUrl('Datasheet') || downloads[0]?.languages?.[0]?.url || '';
            const manualUrl = findDocUrl('Manual');

            let productsData: any[] = [];
            let weightGrams = 0;

            if (datasheetUrl) {
                console.log(`Downloading PDF for ${slug}...`);
                // ... (PDF download logic) ...
                try {
                    const pdfPage = await browser.newPage();
                    const downloadPromise = pdfPage.waitForEvent('download', { timeout: 15000 });
                    try {
                        await pdfPage.goto(datasheetUrl, { timeout: 10000, waitUntil: 'domcontentloaded' });
                    } catch (e) { }
                    const download = await downloadPromise;
                    const path = await download.path();
                    const fs = await import('fs/promises');
                    const pdfBuffer = await fs.readFile(path);
                    await pdfPage.close();

                    if (pdfBuffer.length > 0) {
                        console.log('Parsing PDF...');
                        try {
                            const pdfData = await pdf(pdfBuffer);
                            productsData = extractProductData(pdfData.text);
                            weightGrams = extractWeight(pdfData.text);
                        } catch (e) { console.error("PDF parse error", e); }
                    }
                } catch (e) {
                    console.warn(`PDF download failed/timed out for ${slug}: ${e}`);
                }
            }

            const weightKg = weightGrams / 1000;
            const finalWeightKg = weightKg > 0 ? Number((weightKg * 1.10).toFixed(3)) : 0;

            if (productsData.length === 0) {
                console.log(`No specific SKUs found for ${slug}, creating default entry.`);
                productsData.push({
                    sku: slug.toUpperCase(),
                    cable: 'N/A',
                    connector: 'N/A'
                });
            }

            console.log(`Found ${productsData.length} SKUs for ${slug}.`);

            for (const item of productsData) {
                // Format name as: "Tigo TS4-A-O 1.2/2m MC4" instead of "Tigo TS4-A-O 461-00252-20"
                const cableInfo = item.cable !== 'N/A' ? item.cable : '';
                const connectorInfo = item.connector !== 'N/A' ? item.connector : '';
                const nameParts = [title, cableInfo, connectorInfo].filter(p => p).join(' ');
                const name = nameParts || `${title} ${item.sku}`;

                const productPayload = {
                    name_en: name,
                    description_en: description,
                    sku: item.sku,
                    slug: `${slug}-${item.sku}`.toLowerCase(),
                    category: category,
                    subcategory: subcategory,
                    images: images,
                    datasheet_url: datasheetUrl,
                    manual_url: manualUrl,
                    downloads: downloads,
                    specifications: {
                        cable_length: item.cable,
                        connector: item.connector
                    },
                    weight_kg: finalWeightKg,
                    production_type: 'New',
                    active: true,
                    // Required by DB constraint?
                    cost_eur: 0,
                    price_eur: 0
                };

                const { data, error } = await supabase
                    .from('products')
                    .upsert(productPayload, { onConflict: 'sku' });

                if (error) {
                    console.error(`Error saving ${item.sku}:`, error.message);
                } else {
                    console.log(`Saved ${item.sku}`);
                }
            }
        } catch (e: any) {
            console.error(`Error processing ${url}:`, e.message);
        } finally {
            await page.close();
        }
    }
    await browser.close();
}

scrapeAndSeed();
