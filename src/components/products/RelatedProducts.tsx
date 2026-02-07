'use client'

import { Product } from '@/types/database';

interface RelatedProductsProps {
    products: Product[];
}

export default function RelatedProducts({ products }: RelatedProductsProps) {
    if (!products || products.length === 0) return null;

    return (
        <section className="mt-16 pt-10 border-t border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Related Products</h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {products.map((product) => (
                    <a
                        key={product.id}
                        href={`/products/${product.slug}`}
                        className="group block bg-white border border-gray-100 rounded-lg p-4 hover:shadow-md transition"
                    >
                        <div className="aspect-square w-full mb-4 bg-gray-50 rounded-md flex items-center justify-center overflow-hidden">
                            {product.images && product.images[0] ? (
                                <img
                                    src={product.images[0]}
                                    alt={product.name_en}
                                    className="w-full h-full object-contain group-hover:scale-105 transition duration-300"
                                />
                            ) : (
                                <div className="text-gray-300">No Image</div>
                            )}
                        </div>

                        <h3 className="font-semibold text-gray-900 group-hover:text-[green-600] transition line-clamp-2 sm:h-12 text-sm sm:text-base">
                            {product.name_en}
                        </h3>

                        <div className="mt-2 text-sm text-gray-500 font-mono">
                            {product.sku}
                        </div>
                    </a>
                ))}
            </div>
        </section>
    );
}
