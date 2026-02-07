import { getPricingSchemas } from '@/app/actions/pricing'
import PricingManager from '@/components/admin/PricingManager'
import { createClient } from '@/lib/supabase/server'
import type { Product } from '@/types/database'

export default async function AdminPricingPage() {
    const schemas = await getPricingSchemas()
    const supabase = await createClient()

    // Fetch products for the rules editor
    const { data: products } = await supabase
        .from('products')
        .select('id, name_en, sku')
        .order('name_en')

    // Fetch categories and subcategories
    const { data: productData } = await supabase
        .from('products')
        .select('category, subcategory')

    const categories = Array.from(new Set(productData?.map((p: any) => p.category as string).filter(Boolean))) as string[]
    const subcategories = Array.from(new Set(productData?.map((p: any) => p.subcategory as string).filter(Boolean))) as string[]

    return (
        <div className="p-6">
            <PricingManager
                initialSchemas={schemas}
                products={products || []}
                categories={categories}
                subcategories={subcategories}
            />
        </div>
    )
}
