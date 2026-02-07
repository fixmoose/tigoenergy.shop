
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Original MENU_IMAGES map
const MENU_IMAGES = {
    'TS4 FLEX MLPE': {
        'Optimization': 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/68516440552d37e4f0c88f06_TS4-A-O%20outlined%20Hi%20Res.avif',
        'Safety': 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/68516458f4462a52b4bca14e_TS4-A-S%20Outlined%20Hi%20Res.avif',
        'Fire Safety': 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/6851646a782a4d3393950668_TS4-A-F%20Outlined%20Hi%20Res.avif'
    },
    'TS4-X MLPE': {
        'Optimization': 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/68516440552d37e4f0c88f06_TS4-A-O%20outlined%20Hi%20Res.avif', // Reusing placeholder/similar
        'Safety': 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/68516458f4462a52b4bca14e_TS4-A-S%20Outlined%20Hi%20Res.avif',
        'Fire Safety': 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/6851646a782a4d3393950668_TS4-A-F%20Outlined%20Hi%20Res.avif'
    },
    'EI RESIDENTIAL SOLUTION': {
        'EI Inverter': 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/655b8823f663162799321746_EI%20Inverter%203.png',
        'EI Battery': 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/655b8824f66316279932176b_EI%20Battery%203.png',
        'EI Link': 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/655b8824b27255157929497e_EI%20Link%203.png',
        'GO EV Charger': 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/655c06b72d2508770258079a_GO%20EV%20Charger%201.png',
        'GO Junction': 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/62294f92d4586d795b583271_tigo-150-00000-50_front-p-500.png' // Approximate
    },
    'COMMUNICATIONS': {
        'Data Loggers': 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/60b9435a22d43105788ef394_cca-kit-tap-p-500.png',
        'Access Points': 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/65e8d64188b329432098d123_TAP.png',
        'Rapid Shutdown': 'https://cdn.prod.website-files.com/5fad551d7419c7a0e9e4aba4/60b97561f00882e3814d4838_rss-transmitter-p-500.png'
    }
};

async function seedImages() {
    console.log('Seeding images...');

    // Get all categories to map names/parents
    const { data: categories } = await supabase.from('categories').select('*');

    for (const cat of categories) {
        // Find parent name if this is a child
        let parentName = null;
        if (cat.parent_id) {
            const parent = categories.find(p => p.id === cat.parent_id);
            if (parent) parentName = parent.name;
        }

        if (parentName && MENU_IMAGES[parentName] && MENU_IMAGES[parentName][cat.name]) {
            const url = MENU_IMAGES[parentName][cat.name];
            console.log(`Updating ${cat.name} with ${url}`);
            await supabase.from('categories').update({ image_url: url }).eq('id', cat.id);
        }
    }
}

seedImages();
