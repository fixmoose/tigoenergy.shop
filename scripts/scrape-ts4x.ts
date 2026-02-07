import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const PRODUCTS = [
    {
        slug: 'ts4-x-o',
        name: 'Tigo TS4-X-O',
        category: 'TS4-X MLPE',
        subcategory: 'Optimization',
        url: 'https://www.tigoenergy.com/product/ts4-x-o'
    },
    {
        slug: 'ts4-x-s',
        name: 'Tigo TS4-X-S',
        category: 'TS4-X MLPE',
        subcategory: 'Safety',
        url: 'https://www.tigoenergy.com/product/ts4-x-s'
    },
    {
        slug: 'ts4-x-f',
        name: 'Tigo TS4-X-F',
        category: 'TS4-X MLPE',
        subcategory: 'Fire Safety',
        url: 'https://www.tigoenergy.com/product/ts4-x-f'
    }
];

async function scrapeTS4X() {
    console.log('Starting TS4-X Scraper...');
    const browser = await chromium.launch({ headless: true });

    try {
        for (const product of PRODUCTS) {
            console.log(`\n=== Scraping ${product.name} ===`);
            const page = await browser.newPage();

            try {
                await page.goto(product.url, { waitUntil: 'networkidle', timeout: 60000 });

                let description = '';
                const descHeader = page.locator('div, h2, h3').filter({ hasText: /^Description$/i }).first();
                if (await descHeader.count() > 0) {
                    description = await descHeader.locator('xpath=following-sibling::div').first().innerText();
                }
                if (!description || description.length < 10) {
                    const heroDesc = page.locator('.product-details-hero_description, .w-richtext').first();
                    if (await heroDesc.count() > 0) {
                        description = await heroDesc.innerText();
                    }
                }

                let datasheetUrl = '';
                const links = await page.locator('a[href$=".pdf"]').all();
                for (const link of links) {
                    const text = (await link.innerText()).toLowerCase();
                    const href = await link.getAttribute('href');
                    if (href && (text.includes('datasheet') || href.toLowerCase().includes('datasheet'))) {
                        if (text.includes(' en') || href.includes('-EN') || href.includes('%20EN')) {
                            datasheetUrl = href.startsWith('http') ? href : `https://cdn.prod.website-files.com${href}`;
                            break;
                        }
                        if (!datasheetUrl) {
                            datasheetUrl = href.startsWith('http') ? href : `https://cdn.prod.website-files.com${href}`;
                        }
                    }
                }

                const images: string[] = [];
                const imgs = await page.locator('img').all();
                for (const img of imgs) {
                    const src = await img.getAttribute('src');
                    const alt = (await img.getAttribute('alt')) || '';
                    if (src && (alt.toLowerCase().includes('front') || alt.toLowerCase().includes('angle') || src.includes('TS4-X'))) {
                        if (src.includes('logo') || src.includes('.svg')) continue;
                        const fullUrl = src.startsWith('http') ? src : `https://www.tigoenergy.com${src}`;
                        if (!images.includes(fullUrl)) images.push(fullUrl);
                    }
                }

                const specs = {
                    amperage: '25A',
                    voltage: '80V',
                    power: '800W',
                    weight: '0.52kg'
                };

                const dbSku = product.slug.toUpperCase();

                const payload = {
                    sku: dbSku,
                    name_en: product.name,
                    description_en: description,
                    slug: product.slug,
                    category: product.category,
                    subcategory: product.subcategory,
                    specifications: specs,
                    images: images.slice(0, 5),
                    datasheet_url: datasheetUrl,
                    price_eur: 0,
                    cost_eur: 0,
                    stock_quantity: 50,
                    active: true,
                    weight_kg: 0.52 // Added mandatory field
                };

                const { data: existing } = await supabase.from('products').select('id').eq('slug', product.slug).single();
                if (existing) {
                    const { error } = await supabase.from('products').update(payload).eq('id', existing.id);
                    if (error) console.error(`UPDATE ERROR for ${product.name}:`, error);
                    else console.log(`SUCCESS: Updated ${product.name}`);
                } else {
                    const { error } = await supabase.from('products').insert(payload);
                    if (error) console.error(`INSERT ERROR for ${product.name}:`, error);
                    else console.log(`SUCCESS: Inserted ${product.name}`);
                }

            } catch (pErr) {
                console.error(`SCRAPE ERROR for ${product.name}:`, pErr);
            } finally {
                await page.close();
            }
        }

    } catch (err) {
        console.error('Fatal error:', err);
    } finally {
        await browser.close();
    }
}

scrapeTS4X();
