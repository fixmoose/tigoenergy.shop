
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function verify() {
    const { data: all } = await supabase.from('categories').select('*');

    console.log(`Total Categories: ${all.length}`);

    const roots = all.filter(c => !c.parent_id);
    console.log(`Roots (${roots.length}):`, roots.map(c => c.name).join(', '));

    const children = all.filter(c => c.parent_id);
    console.log(`Children (${children.length})`);

    for (const child of children) {
        const parent = all.find(c => c.id === child.parent_id);
        if (!parent) {
            console.error(`ORPHAN FOUND: ${child.name} (parent_id: ${child.parent_id})`);
        } else {
            // console.log(`  ${child.name} -> ${parent.name}`);
        }
    }
}

verify();
