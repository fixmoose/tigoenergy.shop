
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function syncImages() {
    console.log('Syncing category images from products...');

    // 1. Fetch all subcategories (items with a parent)
    const { data: allCats } = await supabase.from('categories').select('id, name, parent_id');
    const subCategories = allCats.filter(c => c.parent_id);
    const rootCategories = allCats.filter(c => !c.parent_id);

    console.log(`Found ${subCategories.length} subcategories to check.`);

    for (const sub of subCategories) {
        // Find parent to match 'category' column in products
        const parent = rootCategories.find(r => r.id === sub.parent_id);
        const parentName = parent ? parent.name : null;

        if (!parentName) continue;

        // 2. Find ONE product for this subcategory
        // We match products.subcategory = sub.name AND products.category = parent.name
        // (Assuming exact string match used in legacy data)
        const { data: products } = await supabase
            .from('products')
            .select('images')
            .eq('subcategory', sub.name)
            .eq('category', parentName)
            .limit(1);

        if (products && products.length > 0 && products[0].images && products[0].images.length > 0) {
            const imageUrl = products[0].images[0];
            console.log(`[${sub.name}] Found image: ${imageUrl.substring(0, 50)}...`);

            // 3. Update Category
            await supabase
                .from('categories')
                .update({ image_url: imageUrl })
                .eq('id', sub.id);
        } else {
            console.log(`[${sub.name}] No product image found.`);
        }
    }
    console.log('Done.');
}

syncImages();
