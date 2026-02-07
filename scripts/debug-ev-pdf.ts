import pdf from 'pdf-parse/lib/pdf-parse.js';

const evChargerPdfUrl = 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/65afe07113585b9fb4900f82_GO%20EV%20Charger%20datasheet%20002-00148-00%201.2%2020240119.pdf';

async function debugPDF() {
    const response = await fetch(evChargerPdfUrl);
    const arrayBuffer = await response.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    const pdfData = await pdf(pdfBuffer);

    console.log('Total pages:', pdfData.numpages);
    console.log('\n=== PDF TEXT ===');
    console.log(pdfData.text);
    console.log('\n=== END ===');
}

debugPDF();
