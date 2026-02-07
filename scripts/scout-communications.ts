import { chromium } from 'playwright';
import { createRequire } from 'module';
import https from 'https';
import { Buffer } from 'node:buffer';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

const urls = [
    'https://www.tigoenergy.com/product/rss-transmitter'
];

async function scout() {
    console.log('Launching browser...');
    const browser = await chromium.launch({ headless: true });

    for (const url of urls) {
        console.log(`\n-----------------------------------`);
        console.log(`Scouting ${url}`);
        const page = await browser.newPage();
        try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

            // Relaxed search: Find ANY pdf link
            const allLinks = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('a')).map(a => ({ txt: a.innerText, href: a.href }));
            });
            const pdfs = allLinks.filter(l => l.href.endsWith('.pdf'));
            console.log(`Found ${pdfs.length} PDFs:`);
            pdfs.forEach(p => console.log(`- ${p.txt} -> ${p.href}`));

            // Refined finding logic
            let targetPdf;
            if (url.includes('rss-transmitter')) {
                // Exclude 'detector'
                targetPdf = pdfs.find(l => l.txt.toLowerCase().includes('datasheet') && !l.txt.toLowerCase().includes('detector'));
            } else {
                targetPdf = pdfs.find(l => l.txt.toLowerCase().includes('datasheet'));
            }

            if (!targetPdf && pdfs.length > 0) targetPdf = pdfs[0];

            if (targetPdf) {
                console.log(`Downloading (Refined): ${targetPdf.href}`);
                // Download
                const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
                    const req = https.get(targetPdf.href, (res) => {
                        if (res.statusCode !== 200) {
                            if ([301, 302].includes(res.statusCode || 0) && res.headers.location) {
                                console.log(`Redirecting to ${res.headers.location}`);
                                https.get(res.headers.location, (res2) => { // naive redirect follow
                                    const chunks: any[] = [];
                                    res2.on('data', c => chunks.push(c));
                                    res2.on('end', () => resolve(Buffer.concat(chunks)));
                                    res2.on('error', reject);
                                });
                                return;
                            }
                            reject(new Error(`Status ${res.statusCode}`));
                            return;
                        }
                        const chunks: any[] = [];
                        res.on('data', c => chunks.push(c));
                        res.on('end', () => resolve(Buffer.concat(chunks)));
                        res.on('error', reject);
                    });
                    req.on('error', reject);
                });

                console.log(`Downloaded ${pdfBuffer.length} bytes.`);
                const data = await pdf(pdfBuffer);
                console.log(`Text Sample: ${data.text.substring(0, 500).replace(/\n/g, ' ')}`);

                // Regex for Tigo SKUs (Relaxed)
                // 3 digits - 5 digits - 2 digits (e.g. 461-00252-20)
                // Or maybe the first group is different for CCA
                const regex = /(\d{3}-\d{5}-\d{2})/g;
                const matches = data.text.match(regex);
                if (matches) {
                    console.log('Found SKUs:', [...new Set(matches)]);
                } else {
                    console.log('No standard SKUs found with pattern 000-00000-00.');
                    // Try finding "Part Number"
                    const pnIdx = data.text.toLowerCase().indexOf('part number');
                    if (pnIdx !== -1) console.log('Context around "Part Number":', data.text.substring(pnIdx, pnIdx + 200).replace(/\n/g, ' '));
                }
            } else {
                console.log('No PDFs found.');
            }
        } catch (e: any) {
            console.error(`Error processing ${url}:`, e.message);
        } finally {
            await page.close();
        }
    }
    await browser.close();
}

scout();
