import { createClient } from '@/lib/supabase/server'
import type { Product } from '@/types/database'

interface GetProductsOptions {
  limit?: number
  offset?: number
  category?: string
  subcategory?: string
  search?: string
  active?: boolean
  featured?: boolean
}

/**
 * Fetch multiple products with optional filters/pagination
 */
export async function getProducts({
  limit = 100,
  offset = 0,
  category,
  subcategory,
  search,
  active = true,
  featured,
}: GetProductsOptions = {}): Promise<{ products: Product[]; total: number }> {
  const supabase = await createClient()

  let query = supabase.from('products').select('*', { count: 'exact' })

  if (active) query = query.eq('active', true)
  if (category) query = query.eq('category', category)
  if (subcategory) query = query.ilike('subcategory', subcategory)
  if (search) query = query.ilike('name_en', `%${search}%`)
  if (featured !== undefined) query = query.eq('featured', featured)

  // Sort by Available (1) vs Unavailable (0), then by SKU
  const { data, error, count } = await query
    .order('sort_priority', { ascending: false })
    .order('sku', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) throw error
  return { products: data ?? [], total: count ?? 0 }
}

/**
 * Fetch a single product by slug
 */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('products').select('*').eq('slug', slug).limit(1).single()

  if (error) {
    if ((error as any).code === 'PGRST116') return null // not found
    throw error
  }

  return data ?? null
}

/**
 * Fetch products by category
 * NOTE: Name intentionally matches requested "getProductsByCategoryy"
 */
export async function getProductsByCategoryy(category: string): Promise<Product[]> {
  const { products } = await getProducts({ category })
  return products
}

// Get related products from database field, or fallback to category-based logic
export async function getRelatedProducts(currentProduct: Product) {
  const supabase = await createClient()

  // First, try to get products from the related_products field
  if (currentProduct.related_products && currentProduct.related_products.length > 0) {
    const { data } = await supabase
      .from('products')
      .select('*')
      .in('id', currentProduct.related_products)
      .eq('active', true)
      .limit(8)

    if (data && data.length > 0) {
      return data
    }
  }

  // Fallback: Basic "Related" logic based on category
  // If Category is 'ts4-flex-mlpe', return 'communications' products.
  // If Category is 'communications', return 'ts4-flex-mlpe' products.
  let targetCategory = 'ts4-flex-mlpe';
  if (currentProduct.category === 'ts4-flex-mlpe') {
    targetCategory = 'communications';
  } else if (currentProduct.category === 'communications') {
    targetCategory = 'ts4-flex-mlpe';
  }

  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('category', targetCategory)
    .eq('active', true)
    .limit(4);

  return data || [];
}
