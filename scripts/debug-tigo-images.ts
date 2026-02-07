
import { chromium } from 'playwright';

async function scrapeImages() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const targets = [
        { name: 'TS4-X-O', url: 'https://www.tigoenergy.com/product/ts4-x-o' },
        { name: 'TS4-X-S', url: 'https://www.tigoenergy.com/product/ts4-x-s' },
        { name: 'TS4-X-F', url: 'https://www.tigoenergy.com/product/ts4-x-f' },
        { name: 'TS4-A-O', url: 'https://www.tigoenergy.com/product/ts4-a-o' }
    ];

    for (const t of targets) {
        console.log(`Scraping ${t.name}...`);
        try {
            await page.goto(t.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

            // Try to find the main product image
            // Usually in a slider or main image div
            const images = await page.evaluate(() => {
                const imgs = Array.from(document.querySelectorAll('img'));
                return imgs.map(img => img.src);
            });

            // Log unique large images
            const unique = [...new Set(images)].filter(url => !url.endsWith('.svg'));
            console.log(`Found images for ${t.name}:`);
            unique.forEach(url => console.log(url));

        } catch (e) {
            console.error(`Failed to scrape ${t.name}: ${e}`);
        }
        console.log('---');
    }

    await browser.close();
}

scrapeImages();
