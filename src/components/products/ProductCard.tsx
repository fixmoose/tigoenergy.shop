'use client'
import Link from 'next/link'
import type { Product } from '@/types/database'
import { useCart } from '@/contexts/CartContext'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useTranslations } from 'next-intl'
import { useMarket } from '@/contexts/MarketContext'
import { getLocalizedName } from '@/lib/utils/localization'
import type { EffectivePrice } from '@/lib/db/pricing'

export default function ProductCard({ product, pricing }: { product: Product; pricing?: EffectivePrice }) {
  const { addItem } = useCart()
  const { formatPrice } = useCurrency()
  const { currentLanguage } = useMarket()
  const tc = useTranslations('common')
  const productName = getLocalizedName(product, currentLanguage.code) || ''
  const image = product.images && product.images.length ? product.images[0] : null
  const displayPrice = pricing?.isDiscounted ? pricing.discountedPrice : product.price_eur

  // Logic for Stock Status
  const isOutOfStock = product.stock_status === 'out_of_stock' || (product.stock_quantity ?? 0) <= 0
  const isComingSoon = product.stock_status === 'coming_soon'
  const isSpecialOrder = product.stock_status === 'special_order'

  // Can add to cart? (In Stock or Special Order, but NOT Out of Stock or Coming Soon)
  const canAddToCart = !isOutOfStock && !isComingSoon

  // Low Stock Logic
  const isLowStock = !isOutOfStock && !isComingSoon && !isSpecialOrder && (product.stock_quantity ?? 0) <= (product.low_stock_threshold ?? 10)

  // Normal In Stock Logic (High Stock)
  const isNormalStock = !isOutOfStock && !isComingSoon && !isSpecialOrder && !isLowStock

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (canAddToCart) {
      addItem({
        product_id: product.id,
        sku: product.sku,
        name: productName,
        quantity: 1,
        unit_price: displayPrice,
        weight_kg: product.weight_kg,
        image_url: image ?? undefined,
      })
    }
  }

  return (
    <article className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-green-600 hover:shadow-xl transition-all duration-300">
      <Link href={`/products/${product.slug ?? product.id}`} className="block">
        {/* Image */}
        <div className="relative h-52 bg-gray-50 flex items-center justify-center overflow-hidden">
          {image ? (
            <img
              src={image}
              alt={productName}
              className="max-h-full max-w-full object-contain px-4 pb-4 pt-12 group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-gray-300">
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          {/* Category Badge */}
          {product.category && (
            <span className="absolute top-3 left-3 bg-green-600 text-white text-xs font-medium px-2 py-1 rounded">
              {product.category.charAt(0).toUpperCase() + product.category.slice(1)}
            </span>
          )}
          {/* Stock Badges */}
          {isOutOfStock && (
            <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-medium px-2 py-1 rounded">
              {tc('outOfStock')}
            </span>
          )}
          {!isOutOfStock && isComingSoon && (
            <span className="absolute top-3 right-3 bg-blue-500 text-white text-xs font-medium px-2 py-1 rounded">
              {tc('comingSoon')}
            </span>
          )}
          {!isOutOfStock && isSpecialOrder && (
            <span className="absolute top-3 right-3 bg-orange-500 text-white text-xs font-medium px-2 py-1 rounded">
              {tc('specialOrder')}
            </span>
          )}
          {isLowStock && (
            <span className="absolute top-3 right-3 bg-yellow-500 text-white text-xs font-medium px-2 py-1 rounded">
              {tc('lowStock')}
            </span>
          )}
          {isNormalStock && (
            <span className="absolute top-3 right-3 bg-green-500 text-white text-xs font-medium px-2 py-1 rounded">
              {tc('inStock')}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {/* SKU */}
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{product.sku}</p>

          {/* Title */}
          <h3 className="font-medium text-gray-900 line-clamp-2 min-h-[2.5rem] group-hover:text-green-600 transition-colors">
            {productName}
          </h3>

          {/* Price & Add to Cart */}
          <div className="mt-4 flex items-center justify-between">
            <div>
              {pricing?.isDiscounted ? (
                <div className="flex flex-col">
                  <span className="text-xs text-gray-400 line-through font-normal">{formatPrice(pricing.originalPrice)}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xl font-bold text-green-600">{formatPrice(pricing.discountedPrice)}</span>
                    {pricing.appliedSchemaName && (
                      <span className="text-[8px] bg-green-50 text-green-700 px-1 py-0.5 rounded font-black uppercase border border-green-100">
                        {pricing.appliedSchemaName.split(' ')[0]}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <span className="text-xl font-bold text-gray-900">
                  {formatPrice(product.price_eur)}
                </span>
              )}
            </div>
            <button
              onClick={handleAddToCart}
              disabled={!canAddToCart}
              className={`p-2 rounded-lg transition-colors ${canAddToCart
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              title={canAddToCart ? 'Add to cart' : 'Not available'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
          </div>
        </div>
      </Link>
    </article>
  )
}
