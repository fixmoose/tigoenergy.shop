import { PDFDocument } from 'pdf-lib'

/**
 * Merges multiple PDF files into one.
 * Takes an array of buffers or URLs.
 */
export async function mergeInvoices(pdfUrls: string[]): Promise<Uint8Array | null> {
    if (pdfUrls.length === 0) return null

    try {
        const mergedPdf = await PDFDocument.create()

        for (const url of pdfUrls) {
            try {
                const response = await fetch(url)
                if (!response.ok) continue

                const pdfBytes = await response.arrayBuffer()
                const pdf = await PDFDocument.load(pdfBytes)

                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
                copiedPages.forEach((page) => mergedPdf.addPage(page))
            } catch (err) {
                console.error(`Error loading PDF from ${url}:`, err)
                // Continue merging other PDFs even if one fails
            }
        }

        return await mergedPdf.save()
    } catch (error) {
        console.error('PDF Merging Error:', error)
        return null
    }
}
