import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const productPages = [
    { url: 'https://www.tigoenergy.com/product/ts4-a-o', skuPattern: '461-%,462-%', name: 'TS4-A-O' },
    { url: 'https://www.tigoenergy.com/product/ts4-a-s', skuPattern: '466-%', name: 'TS4-A-S' },
    { url: 'https://www.tigoenergy.com/product/ts4-a-f', skuPattern: '481-%,486-%,488-%', name: 'TS4-A-F' }
];

async function scrapeProductInfo() {
    const browser = await chromium.launch({ headless: true });

    for (const productPage of productPages) {
        console.log(`\n=== Scraping ${productPage.url} ===`);
        const page = await browser.newPage();

        try {
            await page.goto(productPage.url, { waitUntil: 'networkidle', timeout: 60000 });

            // Wait for content to load
            await page.waitForTimeout(2000);

            // Try multiple selectors to find the product description
            let description = '';

            // Try to find description in common locations
            const selectors = [
                '.product-intro__text',
                '.product-description',
                '.description',
                '[class*="description"]',
                'h1 + p',
                'h2 + p'
            ];

            for (const selector of selectors) {
                try {
                    const element = page.locator(selector).first();
                    const text = await element.textContent({ timeout: 2000 });
                    if (text && text.length > 50 && !text.includes('cookie') && !text.includes('personalization')) {
                        description = text;
                        console.log(`Found description with selector: ${selector}`);
                        break;
                    }
                } catch (e) {
                    // Continue to next selector
                }
            }

            // If still no description, use product name
            if (!description || description.length < 20) {
                description = `Tigo ${productPage.name} - Advanced solar optimization and monitoring solution`;
            }

            console.log('Description:', description.substring(0, 200) + '...');

            // Find all datasheet download links
            const datasheetLinks = await page.locator('a[href*=".pdf"]').all();
            const datasheets: string[] = [];

            for (const link of datasheetLinks) {
                const href = await link.getAttribute('href');
                if (href) {
                    const fullUrl = href.startsWith('http') ? href :
                        href.startsWith('/') ? `https://cdn.prod.website-files.com${href}` :
                            `https://cdn.prod.website-files.com/${href}`;

                    // Only add if it looks like a datasheet
                    if (fullUrl.includes('datasheet') || fullUrl.includes('Datasheet') || fullUrl.includes(productPage.name)) {
                        datasheets.push(fullUrl);
                        console.log('Found datasheet:', fullUrl);
                    }
                }
            }

            // Update products in database
            const patterns = productPage.skuPattern.split(',');
            for (const pattern of patterns) {
                const { data: products } = await supabase
                    .from('products')
                    .select('id, sku')
                    .like('sku', pattern);

                if (products) {
                    for (const product of products) {
                        const updateData: any = {
                            description_en: description.trim().substring(0, 500)
                        };

                        // Add datasheet URL if found
                        if (datasheets.length > 0) {
                            updateData.datasheet_url = datasheets[0];
                        }

                        const { error } = await supabase
                            .from('products')
                            .update(updateData)
                            .eq('id', product.id);

                        if (error) {
                            console.error(`Error updating ${product.sku}:`, error.message);
                        } else {
                            console.log(`✓ Updated ${product.sku}`);
                        }
                    }
                }
            }

        } catch (error) {
            console.error(`Error scraping ${productPage.url}:`, error);
        } finally {
            await page.close();
        }
    }

    await browser.close();
    console.log('\n=== Done! ===');
}

scrapeProductInfo();
