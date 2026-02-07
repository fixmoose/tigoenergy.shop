import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Product, Review } from '@/types/database'
import { getAllReviews } from '@/app/actions/reviews'
import AdminReviewsList from '@/components/admin/AdminReviewsList'
import ProductInventoryList from '@/components/admin/ProductInventoryList'
import CategoryManager from '@/components/admin/CategoryManager'
import CatalogGenerator from '@/components/admin/CatalogGenerator'

export default async function AdminProductsPage({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
  const supabase = await createClient()
  const params = await searchParams
  const q = params?.q

  // 1. Fetch Products
  let query = supabase.from('products').select('*').order('updated_at', { ascending: false }).limit(200)
  if (q) query = query.ilike('name_en', `%${q}%`)
  const { data: productsData, error: productsError } = await query

  // 2. Fetch Reviews
  const reviewsData = await getAllReviews() as (Review & { products: { name_en: string } | null })[]

  // 3. Fetch Categories (For Catalog)
  const { data: categories } = await supabase.from('categories').select('*').order('sort_order')

  const products = productsData as Product[] || []
  const reviews = reviewsData || []

  return (
    <div className="p-6 h-screen flex flex-col">
      <div className="flex items-center justify-between mb-6 shrink-0">


      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 flex-1 min-h-0 items-start">

        {/* COLUMN 1: PRODUCTS (Scrollable) */}
        <div className="bg-white border border-gray-200 rounded-xl flex flex-col h-fit max-h-full overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <h2 className="font-bold text-gray-700 flex items-center gap-2">
                <span>📦</span> Products
              </h2>
              <Link href="/admin/products/new" className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 font-medium transition-colors">
                + Add a New Product
              </Link>
            </div>
            <span className="text-xs bg-gray-200 px-2 py-1 rounded-full text-gray-600">{products.length}</span>
          </div>
          <div className="p-4 overflow-y-auto flex-1 bg-gray-50/30">
            <ProductInventoryList products={products} />
          </div>
        </div>

        {/* COLUMN 2: CATEGORIZATION */}
        <div className="h-fit max-h-full">
          <CategoryManager />
        </div>

        {/* COLUMN 3: CATALOGS (Fixed Content) */}
        <div className="h-fit">
          <CatalogGenerator products={products} categories={categories || []} />
        </div>

        {/* COLUMN 4: REVIEWS (Scrollable) */}
        <div className="bg-white border border-gray-200 rounded-xl flex flex-col h-fit max-h-full overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center sticky top-0 z-10">
            <h2 className="font-bold text-gray-700 flex items-center gap-2">
              <span>⭐</span> Reviews
            </h2>
            <span className="text-xs bg-gray-200 px-2 py-1 rounded-full text-gray-600">{reviews.length}</span>
          </div>
          <div className="p-0 overflow-y-auto flex-1 bg-gray-50/50">
            <AdminReviewsList reviews={reviews} />
          </div>
        </div>

      </div>
    </div>
  )
}
