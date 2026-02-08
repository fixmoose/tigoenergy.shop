import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium-min'

export async function generatePdfFromHtml(html: string) {
    let browser = null
    try {
        // Optimized settings for serverless/Next.js
        browser = await puppeteer.launch({
            args: (chromium as any).args,
            defaultViewport: (chromium as any).defaultViewport,
            executablePath: await (chromium as any).executablePath(
                'https://github.com/sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar'
            ),
            headless: (chromium as any).headless,
        })

        const page = await browser.newPage()

        // Add styling for A4 and PDF specifics
        const fullHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { margin: 0; padding: 0; }
                    @page { size: A4; margin: 0; }
                    * { -webkit-print-color-adjust: exact; }
                </style>
            </head>
            <body>
                ${html}
            </body>
            </html>
        `

        await page.setContent(fullHtml, { waitUntil: 'networkidle0' })

        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '0px',
                right: '0px',
                bottom: '0px',
                left: '0px'
            }
        })

        return pdf
    } catch (error) {
        console.error('PDF generation error:', error)
        throw error
    } finally {
        if (browser) {
            await browser.close()
        }
    }
}
