
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Exact Images from Tigo Website (Confirmed "Next to Description" / Cabled)
const VALID_IMAGES = {
    // TS4-A Series
    TS4_A_O: 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/68516440552d37e4f0c88f06_TS4-A-O%20outlined%20Hi%20Res.avif',
    TS4_A_S: 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/68516458f4462a52b4bca14e_TS4-A-S%20Outlined%20Hi%20Res.avif',
    TS4_A_F: 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/6851646d552d37e4f0c8be7d_TS4-A-F%20Outlined%20Hi%20Res.avif',
    // Fallback for 2F - using F as base or keeping previously known 2F if exists. Using F for now as 2F specific "outlined" was not found, but F is closest.
    TS4_A_2F: 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/6851646d552d37e4f0c8be7d_TS4-A-F%20Outlined%20Hi%20Res.avif',

    // TS4-X Series
    TS4_X_O: 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/672bc1acf24f693f6f85d428_MLPE_Device_TS4-X-O-102024_5%20(1).avif',
    TS4_X_S: 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/672bc18e46200615f0479262_MLPE_Device_102024_5.avif',
    TS4_X_F: 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/672bc11e055730ba9ea8d367_MLPE_Device_TS4-X-F_102024_5%20(1).avif'
};

async function fixImages() {
    console.log('Fixing MLPE Images with Confirmed "Next to Description" URLs...');

    // 1. Fix TS4-X Series
    const { data: xProducts } = await supabase.from('products').select('*').eq('category', 'TS4-X MLPE');
    if (xProducts) {
        for (const p of xProducts) {
            let newImages: string[] = [];
            if (p.name_en.includes('TS4-X-O')) newImages = [VALID_IMAGES.TS4_X_O];
            else if (p.name_en.includes('TS4-X-S')) newImages = [VALID_IMAGES.TS4_X_S];
            else if (p.name_en.includes('TS4-X-F')) newImages = [VALID_IMAGES.TS4_X_F];

            if (newImages.length > 0) {
                await supabase.from('products').update({ images: newImages }).eq('id', p.id);
                console.log(`Updated images for ${p.sku} (${p.name_en})`);
            }
        }
    }

    // 2. Fix TS4-A Series
    const { data: aProducts } = await supabase.from('products').select('*').eq('category', 'TS4 FLEX MLPE');
    if (aProducts) {
        for (const p of aProducts) {
            let finalImages: string[] = [];
            if (p.name_en.includes('TS4-A-O')) finalImages = [VALID_IMAGES.TS4_A_O];
            else if (p.name_en.includes('TS4-A-S')) finalImages = [VALID_IMAGES.TS4_A_S];
            else if (p.name_en.includes('TS4-A-F')) finalImages = [VALID_IMAGES.TS4_A_F];
            else if (p.name_en.includes('TS4-A-2F')) finalImages = [VALID_IMAGES.TS4_A_2F];
            else finalImages = [VALID_IMAGES.TS4_A_O]; // Default

            await supabase.from('products').update({ images: finalImages }).eq('id', p.id);
            console.log(`Reset images for ${p.sku} to confirmed outlined URL`);
        }
    }
}

fixImages();
