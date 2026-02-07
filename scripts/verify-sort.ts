import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifySort() {
    console.log('Verifying product sort order...');

    // Simulating the query in getProducts
    const { data, error } = await supabase
        .from('products')
        .select('sku, name_en')
        .eq('active', true)
        .order('sku', { ascending: true })
        .limit(5);

    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    console.log('First 5 products sorted by SKU:');
    data.forEach(p => console.log(`${p.sku}: ${p.name_en}`));
}

verifySort();
