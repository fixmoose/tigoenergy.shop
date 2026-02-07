import type { Metadata } from 'next'
import type { Product } from '@/types/database'
import { getProducts } from '@/lib/db/products'
import ProductGrid from '@/components/products/ProductGrid'
import { headers } from 'next/headers'
import { getMarketFromKey } from '@/lib/constants/markets'
import { buildHreflangAlternates, buildCanonicalUrl } from '@/lib/utils/seo'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCustomerPricingData, calculateEffectivePrice, type EffectivePrice } from '@/lib/db/pricing'

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const marketKey = headersList.get('x-market-key') || 'SHOP'
  const market = getMarketFromKey(marketKey)

  return {
    title: `Products | Tigo Energy ${market.countryName}`,
    description: 'Browse our complete range of Tigo solar optimizers, inverters, batteries, and monitoring solutions.',
    alternates: {
      canonical: buildCanonicalUrl(marketKey, '/products'),
      languages: buildHreflangAlternates('/products'),
    },
  }
}

const CATEGORY_INFO: Record<string, { title: string; description: string }> = {
  'ts4-flex-mlpe': {
    title: 'TS4 FLEX MLPE',
    description: 'Tigo TS4 Flex MLPE (Module Level Power Electronics) increases energy output, enables module-level monitoring, and improves safety.',
  },
  optimizer: {
    title: 'Solar Optimizers',
    description: 'Module-level power electronics for maximum energy harvest and system safety.',
  },
  inverter: {
    title: 'Inverters',
    description: 'High-efficiency DC to AC conversion for residential and commercial installations.',
  },
  battery: {
    title: 'Battery Storage',
    description: 'Store solar energy for use when you need it most with our battery solutions.',
  },
  accessory: {
    title: 'Accessories',
    description: 'Cables, connectors, and mounting accessories for your solar installation.',
  },
  monitoring: {
    title: 'Monitoring Solutions',
    description: 'Real-time performance tracking and analytics for your solar system.',
  },
}

import { getCategoryFromSlug, PRODUCT_CATEGORIES, type CategoryKey } from '@/lib/constants/categories'

export default async function Page({ searchParams }: { searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const params = await searchParams
  const search = Array.isArray(params?.search) ? params?.search[0] : params?.search
  const categorySlug = Array.isArray(params?.category) ? params?.category[0] : params?.category
  const subcategorySlug = Array.isArray(params?.subcategory) ? params?.subcategory[0] : params?.subcategory

  // Translate slug to category name for DB query
  const category = categorySlug ? getCategoryFromSlug(categorySlug) : undefined

  // Translate subcategory slug to proper name
  let subcategory = subcategorySlug;
  if (subcategorySlug && category && PRODUCT_CATEGORIES[category as CategoryKey]) {
    // Try to find matching subcategory in the config
    const config = PRODUCT_CATEGORIES[category as CategoryKey];
    const match = config.subcategories.find(s => s.toLowerCase().replace(/ /g, '-') === subcategorySlug);
    if (match) subcategory = match;
  }
  // Fallback: just replace hyphens with spaces if not found (or if no category context)
  if (subcategory && subcategory === subcategorySlug) {
    subcategory = subcategory.replace(/-/g, ' ');
  }

  const page = Number(params?.page) || 1
  const limit = Number(params?.limit) || 48
  const offset = (page - 1) * limit

  // Allow filtering by subcategory (globally or within category)
  const { products, total } = await getProducts({
    search: search ?? undefined,
    category: category ?? undefined,
    subcategory: subcategory ?? undefined,
    limit: limit === -1 ? 1000 : limit, // -1 means "All" (max 1000 safeguard)
    offset
  })

  // Batch calculate effective prices for logged-in users
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const pricingMap: Record<string, EffectivePrice> = {}

  if (user) {
    const customerPricingData = await getCustomerPricingData(user.id)
    products.forEach((p: Product) => {
      pricingMap[p.id] = calculateEffectivePrice(p, customerPricingData)
    })
  }

  // Basic info lookup - might need update for dynamic categories
  // For now, if category is present, show its title. If only subcategory, show it.
  const categoryInfo = categorySlug ? CATEGORY_INFO[categorySlug] : null
  const tsub = await getTranslations('subcategories')


  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Page Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <Link href="/" className="hover:text-[var(--color-primary)]">Home</Link>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-gray-900">Products</span>
            {category && (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-gray-900">{categoryInfo?.title || category}</span>
              </>
            )}
            {subcategory && (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-gray-900 capitalize">{tsub.has(subcategory) ? tsub(subcategory) : subcategory.replace(/-/g, ' ')}</span>
              </>
            )}
          </nav>
        </div>
      </div>

      {/* Products Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Controls: Count & Items Per Page */}
        <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
          <p className="text-gray-600">
            {total === 0 ? 'No products found' : (
              <>showing <span className="font-bold">{products.length > 0 ? offset + 1 : 0}</span> - <span className="font-bold">{Math.min(offset + limit, total)}</span> of <span className="font-bold">{total}</span> products</>
            )}
          </p>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Show:</span>
            <div className="flex gap-1">
              {[25, 50, 100, -1].map((val) => (
                <Link
                  key={val}
                  href={{
                    pathname: '/products',
                    query: { ...params, limit: val, page: 1 } // Reset to page 1 on limit change
                  }}
                  className={`px-3 py-1 text-sm border rounded hover:bg-gray-50 ${limit === val || (val === -1 && limit === 1000) ? 'bg-gray-100 font-bold border-gray-300' : 'bg-white border-gray-200'}`}
                >
                  {val === -1 ? 'All' : val}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <ProductGrid products={products} pricingMap={pricingMap} />

        {/* Empty State */}
        {products.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-500 mb-6">
              {search
                ? `No products match "${search}". Try a different search term.`
                : 'No products available in this category yet.'}
            </p>
            <Link href="/products" className="btn-primary">
              View All Products
            </Link>
          </div>
        )}

        {/* Pagination Controls */}
        {total > 0 && limit !== -1 && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 flex justify-center mt-8">
            <nav className="flex items-center gap-2">
              {/* Previous */}
              <Link
                href={{ pathname: '/products', query: { ...params, page: page > 1 ? page - 1 : 1 } }}
                className={`p-2 rounded-lg border ${page > 1 ? 'hover:bg-gray-50 text-gray-700 bg-white border-gray-300' : 'text-gray-300 border-gray-100 pointer-events-none'}`}
                aria-disabled={page <= 1}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </Link>

              {/* Page Numbers */}
              {Array.from({ length: Math.ceil(total / limit) }).map((_, i) => {
                const p = i + 1;
                if (p === 1 || p === Math.ceil(total / limit) || (p >= page - 2 && p <= page + 2)) {
                  return (
                    <Link
                      key={p}
                      href={{ pathname: '/products', query: { ...params, page: p } }}
                      className={`w-10 h-10 flex items-center justify-center rounded-lg border text-sm font-medium transition-colors ${page === p
                        ? 'bg-green-600 border-green-600 text-white'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                      {p}
                    </Link>
                  )
                } else if (p === page - 3 || p === page + 3) {
                  return <span key={p} className="px-1 text-gray-400 self-end mb-2">...</span>
                }
                return null;
              })}

              {/* Next */}
              <Link
                href={{ pathname: '/products', query: { ...params, page: page < Math.ceil(total / limit) ? page + 1 : page } }}
                className={`p-2 rounded-lg border ${page < Math.ceil(total / limit) ? 'hover:bg-gray-50 text-gray-700 bg-white border-gray-300' : 'text-gray-300 border-gray-100 pointer-events-none'}`}
                aria-disabled={page >= Math.ceil(total / limit)}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </nav>
          </div>
        )}
      </div>
    </div>
  )
}
