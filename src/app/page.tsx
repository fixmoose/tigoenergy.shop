import Link from 'next/link'
import { getProducts } from '@/lib/db/products'
import ProductCard from '@/components/products/ProductCard'
import BetaNotification from '@/components/BetaNotification'
import { PRODUCT_CATEGORIES } from '@/lib/constants/categories'
import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get featured products
  const { products: featuredProducts } = await getProducts({ limit: 4, featured: true })

  const t = await getTranslations('home')
  const tsub = await getTranslations('subcategories')

  return (
    <>
      {/* Hero Section */}
      <section
        className="relative bg-cover bg-center bg-no-repeat text-white overflow-hidden"
        style={{ backgroundImage: "url('/hero-bg-pattern.png')" }}
      >
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-48 pb-20 lg:pt-72 lg:pb-32">
          <div className="max-w-4xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              {t('heroTitle')}
            </h1>
            <p className="text-xl sm:text-2xl text-green-100 mb-8">
              {t('heroSubtitle')}<br />
              {t('heroServing')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/products" className="bg-orange-500 hover:bg-orange-600 text-white text-md sm:text-lg py-3 px-6 sm:px-8 rounded-lg font-medium transition-colors">
                {t('shopNow')}
              </Link>
              {!user && (
                <>
                  <Link href="/auth/login" className="bg-white text-green-700 hover:bg-green-50 text-md sm:text-lg py-3 px-6 sm:px-8 rounded-lg font-medium transition-colors">
                    {t('signIn')}
                  </Link>
                  <Link href="/auth/register?type=b2c" className="bg-white text-green-700 hover:bg-green-50 text-md sm:text-lg py-3 px-6 sm:px-8 rounded-lg font-medium transition-colors">
                    {t('createAccount')}
                  </Link>
                  <Link href="/auth/register?type=b2b" className="bg-green-800 text-white hover:bg-green-900 text-md sm:text-lg py-3 px-6 sm:px-8 rounded-lg font-medium transition-colors border border-green-700">
                    {t('createB2BAccount')}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="bg-gray-50 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 text-center">
            <div className="flex flex-col items-center">
              <svg className="w-8 h-8 text-green-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium text-gray-700">{t('authorizedDealer')}</span>
            </div>
            <div className="flex flex-col items-center">
              <svg className="w-8 h-8 text-green-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-gray-700">{t('fastShipping')}<sup className="text-[10px]">1</sup></span>
            </div>
            <div className="flex flex-col items-center">
              <svg className="w-8 h-8 text-green-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-sm font-medium text-gray-700">{t('warranty25')}<sup className="text-[10px]">2</sup></span>
            </div>
            <div className="flex flex-col items-center">
              <svg className="w-8 h-8 text-green-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-sm font-medium text-gray-700">{t('worryFreeReturns')}<sup className="text-[10px]">3</sup></span>
            </div>
            <div className="flex flex-col items-center">
              <svg className="w-8 h-8 text-green-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <span className="text-sm font-medium text-gray-700">{t('securePayment')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="bg-gray-50 py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">{t('featuredProducts')}</h2>
            <p className="text-gray-600 mt-2">{t('featuredSubtitle')}</p>
          </div>

          {featuredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}

              {/* View All "Card" */}
              <Link
                href="/products"
                className="group relative bg-white rounded-xl border-2 border-dashed border-gray-200 p-8 flex flex-col items-center justify-center text-center hover:border-green-500 hover:bg-green-50 transition-all duration-300"
              >
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
                <span className="text-lg font-bold text-gray-900 mb-1">{t('viewAllProducts')}</span>
                <span className="text-sm text-gray-500">{t('exploreCatalog')}</span>
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-gray-500">{t('noProductsYet')}</p>
              <Link href="/admin/products" className="inline-block mt-4 text-green-600 font-medium hover:underline">
                {t('goToAdmin')}
              </Link>
            </div>
          )}
          <div className="mt-8 text-center sm:hidden">
            <Link href="/products" className="bg-green-600 hover:bg-green-700 text-white py-3 px-8 rounded-lg font-medium transition-colors inline-block">
              {t('viewAllProducts')}
            </Link>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">{t('shopByCategory')}</h2>
            <p className="text-gray-600 mt-2">{t('shopByCategorySubtitle')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {Object.entries(PRODUCT_CATEGORIES).map(([label, info]) => (
              <Link
                key={info.slug}
                href={`/products?category=${info.slug}`}
                className="group bg-white rounded-xl border border-gray-200 p-6 hover:border-green-600 hover:shadow-lg transition-all duration-300"
              >
                <div className="w-14 h-14 bg-green-50 rounded-lg flex items-center justify-center mb-4 border border-transparent group-hover:border-green-500 group-hover:bg-green-100 transition-all duration-300">
                  <img
                    src="/tigo-leaf.png"
                    alt="Tigo"
                    className="w-8 h-8 object-contain transition-transform group-hover:scale-110"
                  />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{label}</h3>
                <p className="text-sm text-gray-500">
                  {info.subcategories.slice(0, 3).map(s => tsub.has(s) ? tsub(s) : s).join(', ')}{info.subcategories.length > 3 ? '...' : ''}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Logistics Advantage */}
      <section className="py-16 bg-white overflow-hidden border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-2 lg:gap-16 items-center">
            {/* Text Content */}
            <div className="mb-12 lg:mb-0">
              <span className="text-green-600 font-bold tracking-wider uppercase text-sm mb-2 block">{t('globalReach')}</span>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6 leading-tight">
                {t('logisticsTitle')} <br />
                <span className="text-green-600">{t('logisticsHighlight')}</span>
              </h2>
              <div className="space-y-6 text-lg text-gray-600 leading-relaxed">
                <p dangerouslySetInnerHTML={{ __html: t.raw('logisticsP1') }} />
                <p dangerouslySetInnerHTML={{ __html: t.raw('logisticsP2') }} />
              </div>

              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <div className="font-bold text-2xl text-gray-900 mb-1">{t('deliveryDays')}</div>
                  <div className="text-sm text-gray-500">{t('avgDelivery')}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <div className="font-bold text-2xl text-gray-900 mb-1">{t('direct')}</div>
                  <div className="text-sm text-gray-500">{t('fromKoper')}</div>
                </div>
              </div>

              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Link href="/products" className="bg-green-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-700 transition shadow-lg shadow-green-200">
                  {t('orderNow')}
                </Link>
              </div>
            </div>
            {/* Map Image */}
            <div className="relative">
              <div className="absolute inset-0 bg-green-200 rounded-3xl transform rotate-2 scale-95 opacity-30 blur-2xl"></div>
              <img
                src="/images/logistics-map.jpg"
                alt={t('mapAlt')}
                className="relative rounded-2xl shadow-2xl w-full border border-gray-200"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">{t('whyChoose')}</h2>
            <p className="text-gray-600 mt-2">{t('whyChooseSubtitle')}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('moreEnergy')}</h3>
              <p className="text-gray-600">{t('moreEnergyDesc')}</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('enhancedSafety')}</h3>
              <p className="text-gray-600">{t('enhancedSafetyDesc')}</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('smartMonitoring')}</h3>
              <p className="text-gray-600">{t('smartMonitoringDesc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-green-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center text-white">
            <h2 className="text-3xl font-bold mb-4">{t('ctaTitle')}</h2>
            <p className="text-xl text-green-100 mb-8 max-w-2xl mx-auto">
              {t('ctaSubtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/products" className="bg-orange-500 hover:bg-orange-600 text-white text-lg py-3 px-8 rounded-lg font-medium transition-colors">
                {t('browseProducts')}
              </Link>
              <Link href="/contact" className="bg-white text-green-600 font-medium py-3 px-8 rounded-lg hover:bg-gray-100 transition-colors text-lg">
                {t('contactSales')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <BetaNotification />
    </>
  )
}
