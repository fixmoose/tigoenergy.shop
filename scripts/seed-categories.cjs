
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const PRODUCT_CATEGORIES = {
    'TS4 FLEX MLPE': {
        slug: 'ts4-flex-mlpe',
        subcategories: ['Optimization', 'Safety', 'Fire Safety']
    },
    'TS4-X MLPE': {
        slug: 'ts4-x-mlpe',
        subcategories: ['Optimization', 'Safety', 'Fire Safety']
    },
    'EI RESIDENTIAL SOLUTION': {
        slug: 'ei-residential-solution',
        subcategories: ['EI Inverter', 'EI Battery', 'EI Link', 'GO EV Charger', 'GO Junction']
    },
    'COMMUNICATIONS': {
        slug: 'communications',
        subcategories: ['Data Loggers', 'Access Points', 'Rapid Shutdown']
    }
};

async function seed() {
    console.log('Seeding categories...');

    for (const [catName, info] of Object.entries(PRODUCT_CATEGORIES)) {
        // 1. Check or Create Parent
        let { data: parent, error } = await supabase.from('categories').select('id').eq('slug', info.slug).single();

        if (!parent) {
            console.log(`Creating Parent: ${catName}`);
            const { data, error: insertError } = await supabase.from('categories').insert({
                name: catName,
                slug: info.slug,
                description: 'Imported from constants',
                parent_id: null
            }).select().single();

            if (insertError) {
                console.error(`Error creating ${catName}:`, insertError);
                continue;
            }
            parent = data;
        } else {
            console.log(`Parent exists: ${catName}`);
        }

        // 2. Create Subcategories
        for (const subName of info.subcategories) {
            let subSlug = subName.toLowerCase().replace(/ /g, '-');

            // Generate distinct slug for TS4-X vs TS4-Flex to avoid collision
            // If the parent is TS4-X, append -x or similar if generic
            if (info.slug.includes('ts4-x') && ['optimization', 'safety', 'fire-safety'].includes(subSlug)) {
                subSlug = `${subSlug}-x`;
            }

            // Check if this SPECIFIC subcategory (name + parent) exists
            const { data: existingSub } = await supabase
                .from('categories')
                .select('id')
                .eq('name', subName)
                .eq('parent_id', parent.id)
                .single();

            if (!existingSub) {
                console.log(`  Creating Sub: ${subName} (slug: ${subSlug}) for parent ${parent.id}`);

                // Check if slug taken by someone else (just in case)
                const { data: slugCheck } = await supabase.from('categories').select('id').eq('slug', subSlug).single();
                if (slugCheck) {
                    console.log(`  Slug ${subSlug} taken, appending parent prefix...`);
                    subSlug = `${info.slug}-${subSlug}`;
                }

                await supabase.from('categories').insert({
                    name: subName,
                    slug: subSlug,
                    parent_id: parent.id
                });
            } else {
                console.log(`  Sub exists: ${subName} (linked correctly)`);
            }
        }
    }
    console.log('Done.');
}

seed();
