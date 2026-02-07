'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import type { Product } from '@/types/database'
import { PRODUCT_CATEGORIES, type CategoryKey } from '@/lib/constants/categories'

function SubCategoryGroup({ subcategory, products }: { subcategory: string, products: Product[] }) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <div className="border rounded bg-white">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center px-4 py-2 text-left hover:bg-gray-50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-xs">{isOpen ? '▼' : '▶'}</span>
                    <span className="font-semibold text-sm text-gray-600 uppercase tracking-wider">
                        {subcategory}
                    </span>
                </div>
                <span className="text-xs text-gray-400 font-mono">
                    {products.length}
                </span>
            </button>

            {isOpen && (
                <div className="p-2 space-y-2 border-t">
                    {products.map((p) => (
                        <Link
                            key={p.id}
                            href={`/admin/products/${p.id}`}
                            className="p-3 border rounded flex justify-between items-center hover:bg-green-50 hover:border-green-200 ml-2 bg-gray-50/50 transition-all cursor-pointer group"
                        >
                            <div>
                                <div className="font-medium group-hover:text-green-700 transition-colors">
                                    {p.name_en}
                                    {!p.active && <span className="ml-2 text-xs bg-gray-200 text-gray-800 px-1 rounded">Inactive</span>}
                                    {p.active && <span className="ml-2 text-xs bg-green-200 text-green-800 px-1 rounded">Active</span>}
                                </div>
                                <div className="text-sm text-muted-foreground flex gap-3">
                                    <span>SKU: {p.sku}</span>
                                    <span>Price: €{p.price_eur?.toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {/* Compliance badges */}
                                {p.is_electrical_equipment && p.trod_category_code && (
                                    <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-mono" title="TROD/WEEE Category">
                                        TROD-{p.trod_category_code}
                                    </span>
                                )}
                                {p.cn_code && (
                                    <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono" title="CN/HS Code">
                                        {p.cn_code}
                                    </span>
                                )}
                                {p.default_packaging_type && p.default_packaging_type !== 'none' && (
                                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded" title={`Packaging: ${p.packaging_weight_per_unit_kg || 0} kg`}>
                                        📦 {p.default_packaging_type}
                                    </span>
                                )}

                                {p.featured && (
                                    <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full border border-orange-200 font-medium">
                                        Featured
                                    </span>
                                )}

                                {p.stock_quantity != null && p.low_stock_threshold != null && p.stock_quantity < p.low_stock_threshold ? (
                                    <span className="text-red-600 font-semibold text-sm">Low stock: {p.stock_quantity}</span>
                                ) : (
                                    <span className="text-sm text-gray-500">Stock: {p.stock_quantity ?? 0}</span>
                                )}

                                <span className="text-gray-400 group-hover:text-green-600 transition-transform group-hover:translate-x-1">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                    </svg>
                                </span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}

export default function CategorySection({ category, products }: { category: string, products: Product[] }) {
    const [isOpen, setIsOpen] = useState(false)

    const subcategories = Object.entries(
        products.reduce((acc, p) => {
            const sub = p.subcategory || 'General'
            if (!acc[sub]) acc[sub] = []
            acc[sub].push(p)
            return acc
        }, {} as Record<string, Product[]>)
    ).sort((a, b) => {
        // Sort by defined order in PRODUCT_CATEGORIES
        const catConfig = PRODUCT_CATEGORIES[category as CategoryKey]
        if (!catConfig) return a[0].localeCompare(b[0]) // Fallback

        const subA = a[0]
        const subB = b[0]

        // Use type assertion to match string vs literal
        const definedSubs = catConfig.subcategories as readonly string[]
        const indexA = definedSubs.indexOf(subA)
        const indexB = definedSubs.indexOf(subB)

        // If both are found in config, sort by index
        if (indexA !== -1 && indexB !== -1) return indexA - indexB
        // If only one is found, put it first? Or put unknown last?
        if (indexA !== -1) return -1
        if (indexB !== -1) return 1

        return subA.localeCompare(subB)
    })
        .map(([sub, items]) => [
            sub,
            items.sort((a, b) => (a.sku || '').localeCompare(b.sku || '', undefined, { numeric: true }))
        ] as const)

    return (
        <div className="border rounded-lg bg-gray-50 overflow-hidden shadow-sm">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center p-4 text-left font-bold text-gray-800 hover:bg-gray-100 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span className="capitalize text-lg">{category.replace(/-/g, ' ')}</span>
                </div>
                <span className="text-gray-500 text-sm font-normal bg-white px-2 py-0.5 rounded border shadow-sm">
                    {products.length} items {isOpen ? '▼' : '▶'}
                </span>
            </button>

            {isOpen && (
                <div className="p-3 space-y-3 border-t bg-gray-100/50">
                    {subcategories.map(([sub, items]) => (
                        <SubCategoryGroup key={sub} subcategory={sub} products={items} />
                    ))}
                </div>
            )}
        </div>
    )
}
