'use client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'

const CATEGORIES = [
  { slug: 'ts4-flex-mlpe', label: 'TS4 FLEX MLPE' },
  { slug: 'optimizer', label: 'Optimizers' },
  { slug: 'inverter', label: 'Inverters' },
  { slug: 'battery', label: 'Batteries' },
  { slug: 'accessory', label: 'Accessories' },
  { slug: 'monitoring', label: 'Monitoring' },
]

import { PRODUCT_CATEGORIES, CategoryKey } from '@/lib/constants/categories'

function FiltersContent({ currentCategory, currentSubcategory, search }: { currentCategory?: string | null; currentSubcategory?: string | null; search?: string | null }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchValue, setSearchValue] = useState(search || '')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams(searchParams.toString())
    if (searchValue) {
      params.set('search', searchValue)
    } else {
      params.delete('search')
    }
    router.push(`/products?${params.toString()}`)
  }

  const updateFilters = (cat?: string, subcat?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (cat) params.set('category', cat); else params.delete('category');
    if (subcat) params.set('subcategory', subcat); else params.delete('subcategory');
    // If setting a subcategory globally (clicking 'Safety' from a 'Flexible' view),
    // we might want to clear category if the user intends to see ALL Safety.
    // But adhering to standard drill-down:
    // If user clicks a subcategory inside a main category list, we set both.
    // If user clicks a global "Safety" tag (if we had one), we set only subcat.
    // Let's implement the UI as: Main Category Header (clickable) > List of Subcategories (clickable)
    router.push(`/products?${params.toString()}`);
  }

  return (
    <div className="mb-8 space-y-6">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="relative max-w-md">
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Search products..."
          className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[green-600] focus:ring-2 focus:ring-green-100 transition"
        />
        <button type="submit" className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </button>
      </form>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Object.entries(PRODUCT_CATEGORIES).map(([label, info]) => (
          <div key={info.slug} className="space-y-3">
            {/* Main Category Header - Filters by Category only */}
            <button
              onClick={() => updateFilters(info.slug, undefined)}
              className={`font-bold text-lg hover:text-[green-600] transition-colors ${currentCategory === info.slug && !currentSubcategory ? 'text-[green-600]' : 'text-gray-900'}`}
            >
              {label}
            </button>
            {/* Subcategories List */}
            <ul className="space-y-2">
              {info.subcategories.map(sub => (
                <li key={sub}>
                  <button
                    onClick={() => {
                      // Flexible Logic: If user clicks "Safety" under "TS4 FLEX", do we restrict to TS4 FLEX?
                      // The user said: "if someone for example clicks on Safety, we should display both A-F, A-2F and X-F products, eventhough they are different category"
                      // This implies the subcategory button should ideally filter by Subcategory ONLY (Global).
                      // OR we provide a way to do Global.
                      // Let's try: Clicking subcategory sets ONLY subcategory, clearing category.
                      // Use `undefined` for category to clear it.
                      updateFilters(undefined, sub)
                    }}
                    className={`text-sm hover:text-[green-600] transition-colors ${currentSubcategory === sub ? 'text-[green-600] font-medium' : 'text-gray-600'}`}
                  >
                    {sub}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Active Filters / Clear */}
      {(currentCategory || currentSubcategory || search) && (
        <div className="flex items-center gap-2 text-sm pt-4 border-t">
          <span className="text-gray-500">Active filters:</span>
          {currentCategory && (
            <span className="bg-green-50 text-green-700 px-2 py-1 rounded">{Object.entries(PRODUCT_CATEGORIES).find(([_, v]) => v.slug === currentCategory)?.[0] || currentCategory}</span>
          )}
          {currentSubcategory && (
            <span className="bg-green-50 text-green-700 px-2 py-1 rounded">{currentSubcategory}</span>
          )}
          <Link href="/products" className="text-gray-500 hover:text-gray-700 underline ml-auto">
            Clear all
          </Link>
        </div>
      )}
    </div>
  )
}

export default function ProductFilters({ currentCategory, currentSubcategory, search }: { currentCategory?: string | null; currentSubcategory?: string | null; search?: string | null }) {
  return (
    <Suspense fallback={<div className="mb-8 h-24 bg-gray-100 rounded-xl animate-pulse" />}>
      <FiltersContent currentCategory={currentCategory} currentSubcategory={currentSubcategory} search={search} />
    </Suspense>
  )
}
