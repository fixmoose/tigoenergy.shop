
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

const PDF_URL = 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/69457f25c230bf01d004ce12_002-00143-90%201.6%20Datasheet%20TS4-A-O%2020251210%20-%20AU%20%26%20NZ_1.pdf';

async function downloadPdf(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            const data = [];
            res.on('data', (chunk) => data.push(chunk));
            res.on('end', () => resolve(Buffer.concat(data)));
            res.on('error', (err) => reject(err));
        }).on('error', (err) => reject(err));
    });
}

function extractSkus(text) {
    console.log('--- Regex Test ---');
    // Pattern: 3 digits - 5 digits - 2 digits
    const regex1 = /\b\d{3}-\d{5}-\d{2}\b/g;
    const matches1 = text.match(regex1) || [];
    console.log('Regex 1 (d3-d5-d2):', matches1);

    // Pattern: Starts with 4, fixed format 3-5-2, ignore trailing match (merged text)
    const regex2 = /4\d{2}-\d{5}-\d{2}/g;
    const matches2 = text.match(regex2) || [];
    console.log('Regex 2 (4XX-XXXXX-XX):', matches2);

    return matches2;
}

async function run() {
    console.log('Downloading PDF...');
    const buffer = await downloadPdf(PDF_URL);
    console.log('Parsing PDF...');
    const data = await pdf(buffer);
    console.log('--- PDF Text Start ---');
    console.log(data.text.substring(0, 500));
    console.log('--- ... ---');

    const orderingIndex = data.text.indexOf('Ordering Information');
    if (orderingIndex !== -1) {
        console.log('--- Ordering Information Section ---');
        console.log(data.text.substring(orderingIndex, orderingIndex + 1000));
    } else {
        console.log('--- Ordering Information NOT FOUND ---');
    }

    console.log('--- PDF Text End ---');
    console.log(data.text.slice(-2000));

    extractSkus(data.text);
}

run();
