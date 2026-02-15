"use client"
import React, { useState } from 'react'
import AddToCartButton from './AddToCartButton'
import ReviewsSection from './ReviewsSection'
import type { Product, Review } from '@/types/database'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useMarket } from '@/contexts/MarketContext'
import { getLocalizedDescription, getLocalizedName } from '@/lib/utils/localization'
import { useTranslations } from 'next-intl'
import { EffectivePrice } from '@/lib/db/pricing'

export default function ProductDetail({ product, userId, reviews, pricing }: { product: Product; userId?: string | null; reviews: Review[]; pricing?: EffectivePrice }) {
  const { formatPrice } = useCurrency()
  const { currentLanguage } = useMarket()
  const tc = useTranslations('common')
  const tp = useTranslations('products')
  const productName = getLocalizedName(product, currentLanguage.code) || ''
  const productDescription = getLocalizedDescription(product, currentLanguage.code)
  // Use product images or placeholder
  const images = product.images && product.images.length ? product.images : ['/placeholder.png']

  // State for the currently displayed main image
  const [activeImage, setActiveImage] = useState(images[0])
  // State for lightbox/modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  // State for collapsible sections
  const [isDescExpanded, setIsDescExpanded] = useState(false)
  const [isDownloadsExpanded, setIsDownloadsExpanded] = useState(false)

  // Handle description formatting
  const formatDescription = (text: string | null | undefined) => {
    if (!text) return null

    // Split text into main intro and detailed sections
    const lines = text.split('\n')
    const intro: React.ReactNode[] = []
    const details: React.ReactNode[] = []

    let isDetailedSection = false

    lines.forEach((line, i) => {
      const trimmed = line.trim()
      if (!trimmed) return // Skip empty lines

      // Detect headers to start detailed section
      if (['Functions', 'Features and benefits', 'Configuration', 'Required'].includes(trimmed)) {
        isDetailedSection = true
        details.push(<h3 key={i} className="text-lg font-bold mt-6 mb-3 text-gray-900 border-b pb-1">{trimmed}</h3>)
      } else {
        if (isDetailedSection) {
          // Check if it looks like a list item (starts with bullet or just short text in these sections)
          details.push(
            <div key={i} className="flex items-start mb-2">
              <span className="text-[green-600] mr-2">•</span>
              <span className="text-gray-700">{trimmed}</span>
            </div>
          )
        } else {
          intro.push(<p key={i} className="mb-4 text-gray-700 leading-relaxed">{trimmed}</p>)
        }
      }
    })

    return { intro, details }
  }

  const { intro, details } = formatDescription(productDescription) || { intro: [], details: [] }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Images */}
        <div className="md:col-span-1">
          <div className="bg-white border border-gray-100 rounded-lg p-6 shadow-sm sticky top-4">
            {/* Main Image - Click to Enlarge */}
            <div
              className="h-64 flex items-center justify-center cursor-pointer hover:opacity-95 transition"
              onClick={() => setIsModalOpen(true)}
            >
              <img src={activeImage} alt={productName} className="max-h-full object-contain" />
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="mt-6 flex gap-3 overflow-auto pb-2 justify-center">
                {images.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(src)}
                    className={`relative w-16 h-16 rounded-md overflow-hidden border-2 transition ${activeImage === src ? 'border-[green-600]' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <img
                      src={src}
                      alt={`${productName} ${i}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
          <ReviewsSection productId={product.id} reviews={reviews} />
        </div>

        {/* Right Column: details */}
        <div className="md:col-span-2">
          <h1 className="text-3xl font-bold text-gray-900">{productName}</h1>
          <div className="flex items-center gap-3 mt-2">
            <p className="text-sm text-gray-500 font-mono">{product.sku}</p>

            {/* Stock Status Badges */}
            {product.stock_status === 'out_of_stock' && (
              <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded border border-red-200">{tc('outOfStock')}</span>
            )}
            {product.stock_status === 'coming_soon' && (
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded border border-blue-200">{tc('comingSoon')}</span>
            )}
            {product.stock_status === 'special_order' && (
              <span className="bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded border border-orange-200">{tc('specialOrder')}</span>
            )}
            {product.stock_status === 'available_to_order' && (
              <span className="bg-amber-100 text-amber-800 text-xs font-medium px-2.5 py-0.5 rounded border border-amber-200">{tc('availableToOrder')}</span>
            )}
            {/* Low Stock Badge */}
            {product.stock_status !== 'out_of_stock' && product.stock_status !== 'coming_soon' && product.stock_status !== 'special_order' && product.stock_status !== 'available_to_order' && (product.stock_quantity ?? 0) <= (product.low_stock_threshold ?? 10) && (product.stock_quantity ?? 0) > 0 && (
              <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded border border-yellow-200">{tc('lowStock')}</span>
            )}
            {/* In Stock Badge */}
            {product.stock_status !== 'out_of_stock' && product.stock_status !== 'coming_soon' && product.stock_status !== 'special_order' && product.stock_status !== 'available_to_order' && (product.stock_quantity ?? 0) > (product.low_stock_threshold ?? 10) && (
              <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded border border-green-200">{tc('inStock')}</span>
            )}
          </div>

          {/* Available to Order Note */}
          {product.stock_status === 'available_to_order' && (
            <div className="mt-2 text-sm text-amber-700 bg-amber-50 p-2 rounded border border-amber-100 italic">
              ⚠️ {tc('availableToOrderNote')}
            </div>
          )}

          <div className="mt-6 flex items-baseline gap-4 border-b border-gray-100 pb-6">
            <div className="text-4xl font-bold text-gray-900">
              {pricing?.isDiscounted ? (
                <div className="flex flex-col">
                  <span className="text-sm text-gray-400 line-through font-normal">{formatPrice(pricing.originalPrice)}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-green-600">{formatPrice(pricing.discountedPrice)}</span>
                    {pricing.appliedSchemaName && (
                      <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-green-100">
                        {pricing.appliedSchemaName}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                formatPrice(product.price_eur)
              )}
            </div>
            {product.weight_kg > 0 && (
              <div className="text-sm text-gray-500 bg-gray-50 px-2 py-1 rounded">{tc('weight')}: {product.weight_kg} kg</div>
            )}
          </div>

          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-4">
              <AddToCartButton product={product} userId={userId} pricing={pricing} />
            </div>
            {(product.units_per_box ?? 1) > 1 && (
              <p className="text-xs text-gray-500 italic pl-1">
                {tc('packaging')}: {product.units_per_box} {tc('unitsPerBox')}
              </p>
            )}
          </div>

          {/* Specifications hidden as requested */}
          {/* 
          <section className="mt-8">
            <h2 className="text-lg font-medium">Specifications</h2>
            <pre className="mt-2 p-3 bg-gray-100 rounded text-sm overflow-auto">{JSON.stringify(product.specifications ?? {}, null, 2)}</pre>
          </section>
          */}

          <section className="mt-12 pt-8 border-t border-gray-100">
            <h2 className="text-xl font-semibold mb-4 text-gray-900">{tp('description')}</h2>
            <div className={`relative description-content ${!isDescExpanded ? 'max-h-32 overflow-hidden' : ''}`}>

              {/* Check if HTML content (heuristic: contains <p>, <div>, <br>, <ul>, etc) */}
              {productDescription && /<\/?[a-z][\s\S]*>/i.test(productDescription) ? (
                <div
                  className="prose prose-blue max-w-none text-gray-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: productDescription }}
                />
              ) : (
                <>
                  {intro}
                  {/* Always show intro, optionally show details */}
                  <div className={`transition-all duration-300 ${!isDescExpanded ? 'opacity-50 blur-[2px]' : 'opacity-100'}`}>
                    {details}
                  </div>
                </>
              )}

              {/* Fade out effect when collapsed */}
              {!isDescExpanded && (
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />
              )}
            </div>

            <button
              onClick={() => setIsDescExpanded(!isDescExpanded)}
              className="mt-4 text-[green-600] font-medium hover:text-[green-700] hover:underline flex items-center gap-1 text-sm outline-none"
            >
              {isDescExpanded ? tp('showLess') : tp('readMore')}
              <svg className={`w-4 h-4 transition-transform ${isDescExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </section>

          {/* Downloads Section */}
          {product.downloads && product.downloads.length > 0 && (
            <section className="mt-10 pt-8 border-t border-gray-100">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">{tp('downloads')}</h2>

              <div className="border border-gray-100 rounded-lg overflow-hidden">
                {product.downloads.slice(0, isDownloadsExpanded ? undefined : 3).map((download, i) => (
                  <div
                    key={i}
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-white hover:bg-gray-50 transition border-b border-gray-100 last:border-b-0 group gap-4"
                  >
                    <div className="flex items-center gap-3">
                      {/* PDF Icon */}
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm text-gray-700 font-medium">{download.title}</span>
                    </div>

                    {/* Language Links */}
                    <div className="flex flex-wrap items-center gap-2">
                      {download.languages && download.languages.map((lang, j) => (
                        <a
                          key={j}
                          href={lang.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 text-xs font-semibold text-gray-500 hover:text-[green-600] uppercase hover:underline transition-colors"
                        >
                          {lang.lang}
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {product.downloads.length > 3 && (
                <button
                  onClick={() => setIsDownloadsExpanded(!isDownloadsExpanded)}
                  className="mt-4 text-[green-600] font-medium hover:text-[green-700] hover:underline flex items-center gap-1 text-sm outline-none"
                >
                  {isDownloadsExpanded ? tp('showLess') : tp('showAllDownloads', { count: product.downloads.length })}
                  <svg className={`w-4 h-4 transition-transform ${isDownloadsExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}
            </section>
          )}

          {/* Compatibility Link - Only for MLPE */}
          {product.category?.toUpperCase().includes('MLPE') && (
            <div className="mt-8 pt-6 border-t border-gray-100">
              <a
                href="https://www.tigoenergy.com/inverter-compatibility"
                className="flex items-center gap-2 text-green-600 font-medium hover:text-green-700 hover:underline group w-fit"
              >
                <span>{tp('checkInverterCompatibility')}</span>
                <svg className="w-4 h-4 transform group-hover:translate-x-1 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Image Modal/Lightbox */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-80 p-4" onClick={() => setIsModalOpen(false)}>
          <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <button
              className="absolute top-4 right-4 text-white text-4xl font-bold hover:text-gray-300 z-10"
              onClick={() => setIsModalOpen(false)}
            >
              &times;
            </button>
            <img
              src={activeImage}
              alt={productName}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()} // Prevent close on image click
            />
          </div>
        </div>
      )}
    </>
  )
}
