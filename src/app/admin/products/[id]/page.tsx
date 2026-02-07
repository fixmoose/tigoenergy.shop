'use client'
import React, { useEffect, useState } from 'react'
import ProductForm from '@/components/admin/ProductForm'
import { createClient } from '@/lib/supabase/client'
import type { Product } from '@/types/database'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { PRODUCT_CATEGORIES } from '@/lib/constants/categories'

export default function EditProductPage() {
  const params = useParams()
  const router = useRouter()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [navigation, setNavigation] = useState<{ prev: string | null; next: string | null }>({ prev: null, next: null })

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      // Fetch current product
      const { data, error } = await supabase.from('products').select('*').eq('id', params.id).limit(1).single()
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }
      setProduct(data)

      // Fetch ALL products for global navigation
      const { data: allProducts } = await supabase
        .from('products')
        .select('id, name_en, category, subcategory, sku')

      if (allProducts) {
        const catKeys = Object.keys(PRODUCT_CATEGORIES)

        const sorted = [...allProducts].sort((a, b) => {
          // 1. Sort by Category Order
          const catA = a.category || ''
          const catB = b.category || ''
          if (catA !== catB) {
            const idxA = catKeys.indexOf(catA)
            const idxB = catKeys.indexOf(catB)
            // If known categories, sort by definition order
            if (idxA !== -1 && idxB !== -1) return idxA - idxB
            // If one is unknown (e.g. legacy), push to end
            if (idxA !== -1) return -1
            if (idxB !== -1) return 1
            return catA.localeCompare(catB)
          }

          // 2. Sort by Subcategory Order
          const subA = a.subcategory || 'General'
          const subB = b.subcategory || 'General'
          if (subA !== subB) {
            const catConfig = PRODUCT_CATEGORIES[catA as keyof typeof PRODUCT_CATEGORIES]
            const definedSubs = (catConfig?.subcategories || []) as readonly string[]

            const idxA = definedSubs.indexOf(subA)
            const idxB = definedSubs.indexOf(subB)

            if (idxA !== -1 && idxB !== -1) return idxA - idxB
            if (idxA !== -1) return -1
            if (idxB !== -1) return 1
            return subA.localeCompare(subB)
          }

          // 3. Sort by SKU
          return (a.sku || '').localeCompare(b.sku || '', undefined, { numeric: true })
        })

        const currentIndex = sorted.findIndex(p => p.id === params.id)
        const len = sorted.length

        if (len > 0 && currentIndex !== -1) {
          const prevIndex = (currentIndex - 1 + len) % len
          const nextIndex = (currentIndex + 1) % len
          setNavigation({
            prev: sorted[prevIndex].id,
            next: sorted[nextIndex].id
          })
        }
      }

      setLoading(false)
    }
    load()
  }, [params.id])

  if (loading) return <div className="p-6">Loading...</div>
  if (error) return <div className="p-6">Error loading product: {error}</div>

  return (
    <div className="p-6">
      <div className="mb-6 grid grid-cols-3 items-center bg-white border border-gray-200 rounded-xl p-3 shadow-sm">

        {/* Left: Navigation (Prev | Next) */}
        <div className="flex items-center justify-start gap-6 pl-2">
          <Link
            href={navigation.prev ? `/admin/products/${navigation.prev}` : '#'}
            className="btn btn-sm btn-ghost gap-3 px-3 whitespace-nowrap flex items-center text-gray-600 hover:bg-gray-100"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
            <span className="hidden sm:inline font-medium">Prev</span>
          </Link>

          <div className="h-5 w-px bg-gray-300 self-center"></div>

          <Link
            href={navigation.next ? `/admin/products/${navigation.next}` : '#'}
            className="btn btn-sm btn-ghost gap-3 px-3 whitespace-nowrap flex items-center text-gray-600 hover:bg-gray-100"
          >
            <span className="hidden sm:inline font-medium">Next</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
          </Link>
        </div>

        {/* Center: Title & SKU */}
        <div className="text-center px-4 overflow-hidden">
          <h1 className="text-lg font-bold text-gray-900 truncate" title={product?.name_en}>{product?.name_en}</h1>
          <div className="flex items-center justify-center gap-2">
            <p className="text-xs font-mono text-gray-500">{product?.sku}</p>
            {product?.slug && (
              <a
                href={`/products/${product.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[green-600] hover:underline flex items-center gap-1"
                title="Open in Public Store"
              >
                <span>Store Link</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </a>
            )}
          </div>
        </div>

        {/* Right: Actions Portal */}
        <div id="product-header-actions" className="flex justify-end gap-2"></div>
      </div>

      <ProductForm initial={product ?? undefined} onSaved={(p: any) => { window.location.href = `/admin/products/${p.id}` }} />
    </div>
  )
}
