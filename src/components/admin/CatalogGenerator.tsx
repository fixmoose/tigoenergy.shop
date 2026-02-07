'use client'

import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer'
import { saveAs } from 'file-saver' // We might need to handle blob saving manually if we don't use PDFDownloadLink
import type { Product } from '@/types/database'
type Category = any // Temporary fallback to unblock build

// --- PDF STYLES ---
const styles = StyleSheet.create({
    page: { flexDirection: 'column', backgroundColor: '#FFFFFF', padding: 30, fontSize: 10, fontFamily: 'Helvetica' },
    header: { marginBottom: 20, borderBottomWidth: 1, borderBottomStyle: 'solid', paddingBottom: 10, borderColor: '#EEE' },
    title: { fontSize: 24, fontWeight: 'bold', color: '#111' },
    subtitle: { fontSize: 12, color: '#666', marginTop: 4 },

    // Pricelist Table
    table: { display: 'flex', flexDirection: 'column', width: 'auto', borderStyle: 'solid', borderWidth: 1, borderColor: '#EEE' },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#EEE', minHeight: 24, alignItems: 'center' },
    tableHeader: { backgroundColor: '#F9FAFB', fontWeight: 'bold' },
    colSku: { width: '15%', padding: 4 },
    colName: { width: '40%', padding: 4 },
    colPrice: { width: '15%', padding: 4, textAlign: 'right' },
    colDiscounts: { width: '30%', padding: 4, fontSize: 8, color: '#555' },

    // Catalog
    catCoverPage: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    catTitle: { fontSize: 36, fontWeight: 'bold', marginBottom: 20, color: '#458400' }, // Tigo Green
    catHeroParams: { marginTop: 20, padding: 20, backgroundColor: '#F9FAFB', borderRadius: 8 },
    heroImage: { width: 300, height: 300, objectFit: 'contain', marginBottom: 20 },

    gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    productCard: { width: '30%', marginBottom: 15, padding: 8, borderWidth: 1, borderStyle: 'solid', borderColor: '#EEE', borderRadius: 4 },
    cardImage: { width: '100%', height: 80, objectFit: 'contain', marginBottom: 8 },
    cardTitle: { fontSize: 9, fontWeight: 'bold', marginBottom: 4, height: 24, overflow: 'hidden' },
    cardSku: { fontSize: 8, color: '#666', marginBottom: 2 },
    cardDesc: { fontSize: 7, color: '#888', height: 30, overflow: 'hidden' },
})

// --- PRICELIST DOCUMENT ---
const PricelistDocument = ({ products }: { products: Product[] }) => (
    <Document>
        <Page size="A4" style={styles.page}>
            <View style={styles.header}>
                <Text style={styles.title}>Tigo Energy Shop - B2B Pricelist</Text>
                <Text style={styles.subtitle}>Current Pricing (EUR) - {new Date().toLocaleDateString()}</Text>
            </View>

            <View style={styles.table}>
                {/* Header */}
                <View style={[styles.tableRow, styles.tableHeader]}>
                    <Text style={styles.colSku}>SKU</Text>
                    <Text style={styles.colName}>Product Name</Text>
                    <Text style={styles.colPrice}>Base Price</Text>
                    <Text style={styles.colDiscounts}>Qty Discounts (Net)</Text>
                </View>

                {/* Rows */}
                {products.map((p, i) => {
                    // Parse discounts safely
                    let discountText = '-'
                    if (p.quantity_discounts && Array.isArray(p.quantity_discounts)) {
                        discountText = p.quantity_discounts
                            .map((d: any) => `${d.quantity}+: €${d.price.toFixed(2)}`)
                            .join(' | ')
                    }

                    return (
                        <View key={p.id} style={styles.tableRow}>
                            <Text style={styles.colSku}>{p.sku}</Text>
                            <Text style={styles.colName}>{p.name_en}</Text>
                            <Text style={styles.colPrice}>€{p.price_eur?.toFixed(2) || '0.00'}</Text>
                            <Text style={styles.colDiscounts}>{discountText}</Text>
                        </View>
                    )
                })}
            </View>
        </Page>
    </Document>
)

// --- IMAGE UTILS ---
async function convertImgToPng(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new window.Image()
        img.crossOrigin = "Anonymous" // Critical for canvas export
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas')
                canvas.width = img.width
                canvas.height = img.height
                const ctx = canvas.getContext('2d')
                if (!ctx) throw new Error('No canvas context')
                ctx.drawImage(img, 0, 0)
                resolve(canvas.toDataURL('image/png'))
            } catch (e) {
                console.warn('Canvas conversion failed (likely CORS):', e)
                // Fallback: return original URL and hope PDF handles it or user accepts it missing
                resolve(url)
            }
        }
        img.onerror = (e) => {
            console.warn('Image load failed:', url, e)
            resolve(url)
        }
        img.src = url
    })
}

async function preprocessImages(products: Product[]): Promise<Map<string, string>> {
    const map = new Map<string, string>()
    const uniqueUrls = new Set<string>()

    // Collect all main images
    products.forEach(p => {
        const img = p.images?.[0]
        if (img) uniqueUrls.add(img)
    })

    // Process sequentially or in parallel chunks to avoid choking network
    // parallel is faster
    await Promise.all(Array.from(uniqueUrls).map(async (url) => {
        // Check if it looks like webp or just do it for all to be safe?
        // Doing it for all is safest to ensure compatibility, but slow.
        // Let's check extension strictly? No, URLs might not have ext.
        // Let's Convert EVERYTHING to PNG DataURL.
        // This solves WebP, generic fetch issues, etc.
        // Warning: DataURLs are large.
        const safeUrl = await convertImgToPng(url)
        map.set(url, safeUrl)
    }))

    return map
}

// --- CATALOG DOCUMENT ---
const CatalogDocument = ({ products, categories, imageMap }: { products: Product[], categories: Category[], imageMap: Map<string, string> }) => {
    const sortedCats = [...categories].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

    return (
        <Document>
            {sortedCats.map(cat => {
                // Filter products by category name or slug (matching current Product type which stores category as string)
                // We use relaxed matching to catch inconsistencies
                const catProducts = products.filter(p =>
                    p.category === cat.name ||
                    p.category === cat.slug ||
                    p.category?.toLowerCase() === cat.name.toLowerCase() ||
                    p.category?.toLowerCase() === cat.slug.toLowerCase()
                )

                if (catProducts.length === 0) return null

                // Hero product: First FEATURED item, otherwise default to first item
                const heroProduct = catProducts.find(p => p.featured) || catProducts[0]
                const rawMainImage = heroProduct.images?.[0]
                const mainImage = rawMainImage ? (imageMap.get(rawMainImage) || rawMainImage) : null

                return (
                    <React.Fragment key={cat.id}>
                        {/* 1. Category Cover Page */}
                        <Page size="A4" style={styles.page}>
                            <View style={styles.catCoverPage}>
                                <Text style={styles.catTitle}>{cat.name}</Text>
                                {mainImage && (
                                    <Image src={mainImage} style={styles.heroImage} />
                                )}
                                <View style={styles.catHeroParams}>
                                    <Text style={{ fontSize: 14, fontWeight: 'bold' }}>{heroProduct.name_en}</Text>
                                    <Text style={{ fontSize: 12, color: '#666', marginTop: 8 }}>{heroProduct.sku}</Text>
                                    <Text style={{ fontSize: 10, marginTop: 12 }}>{heroProduct.description_en?.substring(0, 300)}...</Text>
                                </View>
                            </View>
                        </Page>

                        {/* 2. Product Grid Pages */}
                        <Page size="A4" style={styles.page}>
                            <View style={styles.header}>
                                <Text style={styles.title}>{cat.name} Collection</Text>
                            </View>
                            <View style={styles.gridContainer}>
                                {catProducts.map(p => {
                                    const rawImg = p.images?.[0]
                                    const img = rawImg ? (imageMap.get(rawImg) || rawImg) : null

                                    return (
                                        <View key={p.id} style={styles.productCard}>
                                            {img ? (
                                                <Image src={img} style={styles.cardImage} />
                                            ) : (
                                                <View style={[styles.cardImage, { backgroundColor: '#f0f0f0' }]} />
                                            )}
                                            <Text style={styles.cardTitle}>{p.name_en}</Text>
                                            <Text style={styles.cardSku}>{p.sku}</Text>
                                            <Text style={styles.cardDesc}>{p.description_en?.replace(/<[^>]*>?/gm, '').substring(0, 60)}...</Text>
                                        </View>
                                    )
                                })}
                            </View>
                        </Page>
                    </React.Fragment>
                )
            })}
        </Document>
    )
}

// --- MAIN COMPONENT ---
export default function CatalogGenerator({ products, categories = [] }: { products: Product[], categories: Category[] }) {
    const [isGenerating, setIsGenerating] = React.useState<string | null>(null)

    const handleDownloadPricelist = async () => {
        setIsGenerating('pricelist')
        let url: string | null = null
        try {
            const blob = await pdf(<PricelistDocument products={products} />).toBlob()
            url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `Tigo_Pricelist_B2B_${new Date().toISOString().split('T')[0]}.pdf`
            link.click()
        } catch (e) {
            console.error(e)
            alert("Error generating Pricelist: " + (e instanceof Error ? e.message : String(e)))
        } finally {
            setIsGenerating(null)
            if (url) URL.revokeObjectURL(url)
        }
    }

    const handleDownloadCatalog = async () => {
        setIsGenerating('catalog')
        let url: string | null = null
        try {
            // Preprocess images to avoid WebP/CORS issues
            const imageMap = await preprocessImages(products)

            const blob = await pdf(<CatalogDocument products={products} categories={categories} imageMap={imageMap} />).toBlob()
            url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `Tigo_Catalog_${new Date().toISOString().split('T')[0]}.pdf`
            link.click()
        } catch (e) {
            console.error(e)
            alert("Error generating Catalog: " + (e instanceof Error ? e.message : String(e)))
        } finally {
            setIsGenerating(null)
            if (url) URL.revokeObjectURL(url)
        }
    }

    return (
        <div className="bg-white border border-gray-200 rounded-xl flex flex-col h-fit shadow-sm">
            <div className="p-4 border-b border-gray-100 bg-gray-50">
                <h2 className="font-bold text-gray-700 flex items-center gap-2">
                    <span>🖨️</span> Catalogs
                </h2>
            </div>
            <div className="p-6">
                <p className="text-sm text-gray-600 mb-6">
                    Generate and download PDF catalogs for your customers.
                </p>

                <div className="space-y-4">
                    <button
                        onClick={handleDownloadCatalog}
                        disabled={isGenerating === 'catalog'}
                        className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all group disabled:opacity-50"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center group-hover:bg-blue-200">
                                {isGenerating === 'catalog' ? '⏳' : '📄'}
                            </div>
                            <div className="text-left">
                                <div className="font-medium text-gray-900">Full Catalog</div>
                                <div className="text-xs text-gray-500">All products & specs (No Prices)</div>
                            </div>
                        </div>
                        <span className="text-gray-400 group-hover:text-blue-500">⬇️</span>
                    </button>

                    <button
                        onClick={handleDownloadPricelist}
                        disabled={isGenerating === 'pricelist'}
                        className="w-full flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition-all group disabled:opacity-50"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center group-hover:bg-green-200">
                                {isGenerating === 'pricelist' ? '⏳' : '💰'}
                            </div>
                            <div className="text-left">
                                <div className="font-medium text-gray-900">Pricelist (B2B)</div>
                                <div className="text-xs text-gray-500">Simple lines, Base + Volume Pricing</div>
                            </div>
                        </div>
                        <span className="text-gray-400 group-hover:text-green-500">⬇️</span>
                    </button>
                </div>

                <div className="mt-8 border-t border-gray-100 pt-6">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Quick Stats</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-gray-50 rounded">
                            <div className="text-2xl font-bold text-gray-800">{products.length}</div>
                            <div className="text-xs text-gray-500">Active Products</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
