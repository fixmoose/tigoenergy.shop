import type { Metadata } from 'next'
import Link from 'next/link'
import { getCategorySlug } from '@/lib/constants/categories'
import type { Product } from '@/types/database'
import { getProductBySlug, getRelatedProducts } from '@/lib/db/products'
import ProductDetail from '@/components/products/ProductDetail'
import RelatedProducts from '@/components/products/RelatedProducts'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { getMarketFromKey } from '@/lib/constants/markets'
import { getLocalizedDescription, getLocalizedName } from '@/lib/utils/localization'
import { buildHreflangAlternates, buildCanonicalUrl } from '@/lib/utils/seo'
import { getTranslations } from 'next-intl/server'
import { getEffectivePrice } from '@/lib/db/pricing'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) return { title: 'Product Not Found' }

  const headersList = await headers()
  const marketKey = headersList.get('x-market-key') || 'SHOP'
  const market = getMarketFromKey(marketKey)
  const productName = getLocalizedName(product, market.defaultLanguage) || product.name_en
  const productDescription = getLocalizedDescription(product, market.defaultLanguage)
  const path = `/products/${slug}`

  return {
    title: `${productName} | Tigo Energy ${market.countryName}`,
    description: productDescription?.slice(0, 160) || `${productName} — professional solar solution by Tigo Energy.`,
    alternates: {
      canonical: buildCanonicalUrl(marketKey, path),
      languages: buildHreflangAlternates(path),
    },
    openGraph: {
      title: productName,
      description: productDescription?.slice(0, 160) || `${productName} — professional solar solution by Tigo Energy.`,
      images: product.images?.[0] ? [{ url: product.images[0] }] : undefined,
      type: 'website',
      locale: market.locale,
    },
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const product = await getProductBySlug(slug)

  if (!product) {
    notFound()
  }

  // Get current user (if logged in) to pass userId to client AddToCartButton
  const supabase = await createClient()
  const { data: { user } = {} } = await supabase.auth.getUser()
  const userId = user?.id ?? null

  const { getReviews } = await import('@/app/actions/reviews')
  const reviews = await getReviews(product.id)

  const effectivePrice = await getEffectivePrice(product, userId)

  const relatedProducts = await getRelatedProducts(product);

  // Resolve language from market for server-side localization
  const headersList = await headers()
  const marketKey = headersList.get('x-market-key') || 'SHOP'
  const market = getMarketFromKey(marketKey)
  const productName = getLocalizedName(product, market.defaultLanguage) || product.name_en

  const tsub = await getTranslations('subcategories')

  // Breadcrumb Logic
  const categoryName = product.category
  const categorySlug = categoryName ? getCategorySlug(categoryName) : null
  const subcategoryName = product.subcategory
  const subcategorySlug = subcategoryName ? subcategoryName.toLowerCase().replace(/ /g, '-') : null

  return (
    <main className="container mx-auto py-12 px-6">
      {/* Breadcrumbs */}
      <nav className="flex items-center flex-wrap gap-2 text-sm text-gray-500 mb-8 animate-in fade-in duration-500">
        <Link href="/" className="hover:text-green-600 transition-colors">Home</Link>
        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>

        <Link href="/products" className="hover:text-green-600 transition-colors">Products</Link>

        {categorySlug && categoryName && (
          <>
            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <Link href={`/products?category=${categorySlug}`} className="hover:text-green-600 transition-colors uppercase tracking-wide font-semibold text-xs text-gray-600 hover:text-green-700">
              {categoryName}
            </Link>
          </>
        )}

        {subcategorySlug && subcategoryName && (
          <>
            <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            <Link href={`/products?category=${categorySlug}&subcategory=${subcategorySlug}`} className="hover:text-green-600 transition-colors font-medium text-gray-700 hover:text-green-700">
              {tsub.has(subcategoryName) ? tsub(subcategoryName) : subcategoryName}
            </Link>
          </>
        )}

        <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
        <span className="text-gray-900 font-semibold truncate max-w-[200px] sm:max-w-md">{productName}</span>
      </nav>

      <ProductDetail product={product} userId={userId} reviews={reviews} pricing={effectivePrice} />
      <RelatedProducts products={relatedProducts} />
    </main>
  )
}
