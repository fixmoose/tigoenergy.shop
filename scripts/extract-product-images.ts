import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const productPages = [
    { url: 'https://www.tigoenergy.com/product/ts4-a-o', skuPattern: '461-%,462-%', name: 'TS4-A-O' },
    { url: 'https://www.tigoenergy.com/product/ts4-a-s', skuPattern: '466-%', name: 'TS4-A-S' },
    { url: 'https://www.tigoenergy.com/product/ts4-a-f', skuPattern: '481-%,486-%,488-%', name: 'TS4-A-F' }
];

async function extractProductImages() {
    const browser = await chromium.launch({ headless: true });

    for (const productPage of productPages) {
        console.log(`\n=== Extracting images for ${productPage.name} ===`);
        const page = await browser.newPage();

        try {
            await page.goto(productPage.url, { waitUntil: 'networkidle', timeout: 60000 });
            await page.waitForTimeout(2000);

            // Find product images - try multiple selectors
            const imageSelectors = [
                'img[src*="product"]',
                'img[src*="TS4"]',
                '.product-image img',
                '.gallery img',
                'img[alt*="TS4"]'
            ];

            const imageUrls: string[] = [];

            for (const selector of imageSelectors) {
                try {
                    const images = await page.locator(selector).all();
                    for (const img of images) {
                        const src = await img.getAttribute('src');
                        if (src && !src.includes('logo') && !src.includes('icon') && !imageUrls.includes(src)) {
                            // Convert to full URL if needed
                            const fullUrl = src.startsWith('http') ? src :
                                src.startsWith('//') ? `https:${src}` :
                                    `https://www.tigoenergy.com${src}`;
                            imageUrls.push(fullUrl);
                            console.log(`Found image: ${fullUrl}`);
                        }
                    }
                } catch (e) {
                    // Continue to next selector
                }
            }

            // Update products with image URLs
            if (imageUrls.length > 0) {
                const patterns = productPage.skuPattern.split(',');
                for (const pattern of patterns) {
                    const { data: products } = await supabase
                        .from('products')
                        .select('id, sku')
                        .like('sku', pattern);

                    if (products) {
                        for (const product of products) {
                            const { error } = await supabase
                                .from('products')
                                .update({ images: imageUrls })
                                .eq('id', product.id);

                            if (error) {
                                console.error(`Error updating ${product.sku}:`, error.message);
                            } else {
                                console.log(`✓ Updated ${product.sku} with ${imageUrls.length} images`);
                            }
                        }
                    }
                }
            } else {
                console.log(`⚠ No images found for ${productPage.name}`);
            }

        } catch (error) {
            console.error(`Error extracting images for ${productPage.url}:`, error);
        } finally {
            await page.close();
        }
    }

    await browser.close();
    console.log('\n=== Done! ===');
}

extractProductImages();
