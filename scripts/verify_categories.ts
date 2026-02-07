
import { getCategoryFromSlug, PRODUCT_CATEGORIES, type CategoryKey } from '../src/lib/constants/categories';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const testCases = [
    { slug: 'ts4-flex-mlpe', subslug: 'optimization' },
    { slug: 'ts4-x-mlpe', subslug: 'safety' },
    { slug: 'ei-residential-solution', subslug: 'ei-inverter' },
    { slug: 'ei-residential-solution', subslug: 'go-unction' }, // Intentional typo test or similar? No, let's test GO Junction
    { slug: 'ei-residential-solution', subslug: 'go-junction' }
];

async function verify() {
    console.log('Verifying Category & Subcategory Resolution...\n');

    for (const { slug, subslug } of testCases) {
        const categoryName = getCategoryFromSlug(slug);

        // Emulate page.tsx logic for subcategory
        let subcategoryName = subslug;
        if (categoryName && PRODUCT_CATEGORIES[categoryName as CategoryKey]) {
            const config = PRODUCT_CATEGORIES[categoryName as CategoryKey];
            const match = config.subcategories.find(s => s.toLowerCase().replace(/ /g, '-') === subslug);
            if (match) subcategoryName = match;
        }
        if (subcategoryName === subslug) {
            subcategoryName = subcategoryName.replace(/-/g, ' ');
        }

        console.log(`Slug: '${slug}' / '${subslug}'`);
        console.log(` -> DB: '${categoryName}' / '${subcategoryName}'`);

        const { count, error } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('category', categoryName)
            .ilike('subcategory', subcategoryName)
            .eq('active', true);

        if (error) {
            console.error(`  [ERROR] DB Query failed: ${error.message}`);
        } else {
            console.log(`  [SUCCESS] Found ${count} active products.`);
        }
        console.log('---');
    }
}

verify();
