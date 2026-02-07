'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Product } from '@/types/database'
import { PRODUCT_CATEGORIES } from '@/lib/constants/categories'
import { updateProductStatus, updateProductFeatured } from '@/app/actions/products'

export default function ProductInventoryList({ products }: { products: Product[] }) {
    // Group products by Category
    const categoryOrder = Object.keys(PRODUCT_CATEGORIES)
    const productsByCategory = products.reduce((acc, p) => {
        const cat = p.category || 'Uncategorized'
        if (!acc[cat]) acc[cat] = []
        acc[cat].push(p)
        return acc
    }, {} as Record<string, Product[]>)

    const sortedCategories = Object.entries(productsByCategory).sort((a, b) => {
        const indexA = categoryOrder.indexOf(a[0])
        const indexB = categoryOrder.indexOf(b[0])
        if (indexA !== -1 && indexB !== -1) return indexA - indexB
        if (indexA !== -1) return -1
        if (indexB !== -1) return 1
        return a[0].localeCompare(b[0])
    })

    return (
        <div className="space-y-4">
            {sortedCategories.map(([category, items]) => (
                <CollapsibleCategory key={category} category={category} items={items} />
            ))}
            {products.length === 0 && (
                <p className="text-gray-400 text-center text-sm py-4">No products found.</p>
            )}
        </div>
    )
}

function CollapsibleCategory({ category, items }: { category: string, items: Product[] }) {
    const [isOpen, setIsOpen] = useState(false)

    // Subgroup Function
    const subCategories = items.reduce((acc, p) => {
        const sub = p.subcategory || 'General'
        if (!acc[sub]) acc[sub] = []
        acc[sub].push(p)
        return acc
    }, {} as Record<string, Product[]>)

    const sortedSubCategories = Object.entries(subCategories).sort((a, b) => {
        // General always top if mixed, or just alphabetical
        if (a[0] === 'General') return -1
        if (b[0] === 'General') return 1
        return a[0].localeCompare(b[0])
    })

    return (
        <div className="border border-gray-100 rounded-lg overflow-hidden bg-white">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                    <span className="font-bold text-sm text-gray-800 uppercase tracking-wide">{category.replace(/-/g, ' ')}</span>
                </div>
                <span className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded-full text-gray-500">
                    {items.length}
                </span>
            </button>

            {isOpen && (
                <div className="p-2 space-y-2">
                    {sortedSubCategories.map(([sub, subItems]) => (
                        <CollapsibleSubCategory key={sub} subcategory={sub} items={subItems} />
                    ))}
                </div>
            )}
        </div>
    )
}

function CollapsibleSubCategory({ subcategory, items }: { subcategory: string, items: Product[] }) {
    // Default open for convenience? Or closed?
    // User asked for "subcategories collapse", implying they exist.
    // Let's make them collapsible but maybe default open to see content easily.
    const [isOpen, setIsOpen] = useState(false)

    return (
        <div className="ml-1 border-l-2 border-gray-100 pl-2">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between py-1.5 px-2 text-left hover:bg-gray-50 rounded transition-colors mb-1"
            >
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 transition-transform duration-200" style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                    <span className="font-medium text-xs text-gray-600 uppercase">{subcategory}</span>
                </div>
                <span className="text-[10px] text-gray-400">
                    {items.length}
                </span>
            </button>

            {isOpen && (
                <div className="space-y-1">
                    {items.map(p => (
                        <Link
                            key={p.id}
                            href={`/admin/products/${p.id}`}
                            className="flex items-center gap-3 p-2 rounded hover:bg-blue-50 border border-transparent hover:border-blue-100 group transition-all bg-white shadow-sm"
                        >
                            {/* Thumbnail */}
                            <div className="w-8 h-8 bg-gray-100 rounded border border-gray-200 shrink-0 overflow-hidden flex items-center justify-center">
                                {p.images && p.images[0] ? (
                                    <img src={p.images[0]} alt={p.name_en} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-[8px] text-gray-400">Img</span>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-gray-800 truncate group-hover:text-blue-700">{p.name_en}</div>
                                <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                                    <span className="font-mono bg-gray-100 px-1 rounded">{p.sku}</span>
                                    {p.stock_quantity !== null && p.stock_quantity !== undefined && p.stock_quantity < (p.low_stock_threshold || 5) && (
                                        <span className="text-red-500 font-bold">Low Stock ({p.stock_quantity})</span>
                                    )}
                                </div>
                            </div>

                            <div className="text-right flex flex-col items-end gap-1">
                                <div className="font-mono text-sm font-medium text-gray-900">€{p.price_eur}</div>
                                <div className="flex items-center gap-1.5" onClick={(e) => e.preventDefault()}>
                                    <ToggleStatus id={p.id} active={p.active ?? false} type="active" />
                                    <ToggleStatus id={p.id} active={p.featured ?? false} type="featured" />
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}


function ToggleStatus({ id, active, type }: { id: string, active: boolean, type: 'active' | 'featured' }) {
    const [loading, setLoading] = useState(false)

    const handleToggle = async (e: React.MouseEvent) => {
        e.preventDefault() // prevent Link navigation
        e.stopPropagation()
        if (loading) return

        setLoading(true)
        try {
            if (type === 'active') {
                await updateProductStatus(id, !active)
            } else {
                await updateProductFeatured(id, !active)
            }
        } catch (err) {
            console.error(err)
            alert("Failed to update status")
        } finally {
            setLoading(false)
        }
    }

    const activeColor = type === 'active' ? 'bg-green-500 text-white' : 'bg-orange-400 text-white'
    const inactiveColor = 'bg-gray-200 text-gray-400'

    let title = ''
    if (type === 'active') {
        title = active ? 'Visible in Store (Click to Hide)' : 'Hidden from Store (Click to Show)'
    } else {
        title = active ? 'Featured on Homepage (Click to Remove)' : 'Not Featured (Click to Add)'
    }

    return (
        <button
            onClick={handleToggle}
            disabled={loading}
            className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase transition-all ${active ? activeColor : inactiveColor} ${loading ? 'opacity-50' : ''}`}
            title={title}
        >
            {type === 'active' ? (active ? 'ON' : 'OFF') : (active ? '★' : '☆')}
        </button>
    )
}
