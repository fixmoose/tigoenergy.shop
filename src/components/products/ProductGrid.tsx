import ProductCard from './ProductCard'
import type { Product } from '@/types/database'
import type { EffectivePrice } from '@/lib/db/pricing'

export default function ProductGrid({ products, pricingMap }: { products: Product[]; pricingMap?: Record<string, EffectivePrice> }) {
  if (!products || products.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} pricing={pricingMap?.[p.id]} />
      ))}
    </div>
  )
}
