'use client'
import React from 'react'
import ProductForm from '@/components/admin/ProductForm'

export default function NewProductPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">New Product</h1>
      <ProductForm onSaved={(p: any) => { window.location.href = `/admin/products/${p.id}` }} />
    </div>
  )
}
