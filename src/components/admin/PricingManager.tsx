'use client'

import { useState } from 'react'
import type { PricingSchema, PricingSchemaRule, Product } from '@/types/database'
import { createPricingSchema, deletePricingSchema, addPricingRule, deletePricingRule } from '@/app/actions/pricing'

interface PricingManagerProps {
    initialSchemas: PricingSchema[]
    products: Partial<Product>[]
    categories: string[]
    subcategories: string[]
}

export default function PricingManager({ initialSchemas, products, categories, subcategories }: PricingManagerProps) {
    const [schemas, setSchemas] = useState(initialSchemas)
    const [selectedSchema, setSelectedSchema] = useState<PricingSchema | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [newSchemaName, setNewSchemaName] = useState('')
    const [newSchemaDesc, setNewSchemaDesc] = useState('')
    const [loading, setLoading] = useState(false)

    const handleCreateSchema = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const result = await createPricingSchema(newSchemaName, newSchemaDesc)
            setSchemas([result, ...schemas])
            setIsModalOpen(false)
            setNewSchemaName('')
            setNewSchemaDesc('')
        } catch (error) {
            alert((error as Error).message)
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteSchema = async (id: string) => {
        if (!confirm('Are you sure you want to delete this schema?')) return
        try {
            await deletePricingSchema(id)
            setSchemas(schemas.filter(s => s.id !== id))
            if (selectedSchema?.id === id) setSelectedSchema(null)
        } catch (error) {
            alert((error as Error).message)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-800">Pricing Schemas</h1>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm"
                >
                    + New Schema
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Schema List */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-fit">
                    <div className="p-4 border-b bg-slate-50 font-semibold text-slate-700">All Schemas</div>
                    <div className="divide-y divide-slate-100">
                        {schemas.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-sm">No schemas created yet.</div>
                        ) : (
                            schemas.map(s => (
                                <div
                                    key={s.id}
                                    onClick={() => setSelectedSchema(s)}
                                    className={`p-4 cursor-pointer transition-colors hover:bg-slate-50 flex justify-between items-center ${selectedSchema?.id === s.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''}`}
                                >
                                    <div>
                                        <div className="font-medium text-slate-800">{s.name}</div>
                                        <div className="text-xs text-slate-500 truncate max-w-[200px]">{s.description || 'No description'}</div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeleteSchema(s.id) }}
                                        className="text-slate-400 hover:text-red-600 transition-colors"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Schema Detail & Rules */}
                <div className="md:col-span-2">
                    {selectedSchema ? (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="p-6 border-b flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">{selectedSchema.name}</h2>
                                    <p className="text-sm text-slate-500">{selectedSchema.description}</p>
                                </div>
                            </div>

                            <div className="p-6">
                                <RulesTable
                                    schema={selectedSchema}
                                    products={products}
                                    categories={categories}
                                    subcategories={subcategories}
                                    onUpdate={(updatedSchema) => {
                                        setSchemas(schemas.map(s => s.id === updatedSchema.id ? updatedSchema : s))
                                        setSelectedSchema(updatedSchema)
                                    }}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-12 text-center text-slate-400">
                            Select a schema from the left to manage rules.
                        </div>
                    )}
                </div>
            </div>

            {/* New Schema Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-800">Create New Pricing Schema</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        <form onSubmit={handleCreateSchema} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Schema Name</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="e.g. 5% Discount for MLPE"
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={newSchemaName}
                                    onChange={e => setNewSchemaName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description (Internal)</label>
                                <textarea
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24"
                                    placeholder="Describe the logic or target for this schema..."
                                    value={newSchemaDesc}
                                    onChange={e => setNewSchemaDesc(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2 border rounded-lg hover:bg-slate-50 font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                                >
                                    {loading ? 'Creating...' : 'Create Schema'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

function RulesTable({ schema, products, categories, subcategories, onUpdate }: {
    schema: PricingSchema,
    products: Partial<Product>[],
    categories: string[],
    subcategories: string[],
    onUpdate: (s: PricingSchema) => void
}) {
    const [isAdding, setIsAdding] = useState(false)
    const [newRule, setNewRule] = useState<Partial<PricingSchemaRule>>({
        type: 'category_discount',
        discount_percentage: 0,
        fixed_price_eur: 0
    })

    const rules = schema.rules || []

    const handleAddRule = async () => {
        try {
            const result = await addPricingRule({ ...newRule, schema_id: schema.id })
            onUpdate({
                ...schema,
                rules: [...rules, result]
            })
            setIsAdding(false)
            setNewRule({
                type: 'category_discount',
                discount_percentage: 0,
                fixed_price_eur: 0
            })
        } catch (error) {
            alert((error as Error).message)
        }
    }

    const handleDeleteRule = async (id: string) => {
        try {
            await deletePricingRule(id)
            onUpdate({
                ...schema,
                rules: rules.filter(r => r.id !== id)
            })
        } catch (error) {
            alert((error as Error).message)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-slate-700">Pricing Rules</h3>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="text-sm bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 font-medium flex items-center gap-1.5"
                    >
                        + Add Rule
                    </button>
                )}
            </div>

            <div className="overflow-hidden border border-slate-100 rounded-lg">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider font-bold">
                        <tr>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3">Selection</th>
                            <th className="px-4 py-3">Adjustment</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {rules.length === 0 && !isAdding && (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-slate-400 italic">No rules defined for this schema.</td>
                            </tr>
                        )}

                        {rules.map(rule => (
                            <tr key={rule.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3 capitalize font-medium text-slate-600">{rule.type.replace(/_/g, ' ')}</td>
                                <td className="px-4 py-3">
                                    {rule.type === 'category_discount' && <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-bold uppercase">{rule.category}</span>}
                                    {rule.type === 'subcategory_discount' && <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-xs font-bold uppercase">{rule.subcategory}</span>}
                                    {rule.type === 'product_fixed_price' && (
                                        <div className="flex flex-col">
                                            <span className="font-medium text-slate-800">{products.find(p => p.id === rule.product_id)?.name_en}</span>
                                            <span className="text-[10px] text-slate-400 font-mono">{products.find(p => p.id === rule.product_id)?.sku}</span>
                                        </div>
                                    )}
                                    {rule.type === 'global_discount' && <span className="text-slate-400 italic">Global (Whole Catalog)</span>}
                                </td>
                                <td className="px-4 py-3">
                                    {rule.discount_percentage ? (
                                        <span className="text-green-600 font-bold">-{rule.discount_percentage}%</span>
                                    ) : rule.fixed_price_eur ? (
                                        <span className="text-slate-900 font-bold">{rule.fixed_price_eur} EUR</span>
                                    ) : '-'}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <button onClick={() => handleDeleteRule(rule.id)} className="text-slate-300 hover:text-red-600">✕</button>
                                </td>
                            </tr>
                        ))}

                        {isAdding && (
                            <tr className="bg-blue-50/50">
                                <td className="px-4 py-3">
                                    <select
                                        className="bg-white border rounded px-2 py-1 outline-none w-full"
                                        value={newRule.type}
                                        onChange={e => setNewRule({ ...newRule, type: e.target.value as any, category: undefined, product_id: undefined })}
                                    >
                                        <option value="category_discount">Category Discount</option>
                                        <option value="subcategory_discount">Subcategory Discount</option>
                                        <option value="product_fixed_price">Product Fixed Price</option>
                                        <option value="global_discount">Global Discount</option>
                                    </select>
                                </td>
                                <td className="px-4 py-3">
                                    {newRule.type === 'category_discount' && (
                                        <select
                                            className="bg-white border rounded px-2 py-1 outline-none w-full"
                                            value={newRule.category || ''}
                                            onChange={e => setNewRule({ ...newRule, category: e.target.value })}
                                        >
                                            <option value="">Select Category...</option>
                                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    )}
                                    {newRule.type === 'subcategory_discount' && (
                                        <select
                                            className="bg-white border rounded px-2 py-1 outline-none w-full"
                                            value={newRule.subcategory || ''}
                                            onChange={e => setNewRule({ ...newRule, subcategory: e.target.value })}
                                        >
                                            <option value="">Select Subcategory...</option>
                                            {subcategories.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    )}
                                    {newRule.type === 'product_fixed_price' && (
                                        <select
                                            className="bg-white border rounded px-2 py-1 outline-none w-full max-w-[200px]"
                                            value={newRule.product_id || ''}
                                            onChange={e => setNewRule({ ...newRule, product_id: e.target.value })}
                                        >
                                            <option value="">Select Product...</option>
                                            {products.map(p => <option key={p.id} value={p.id}>{p.name_en} ({p.sku})</option>)}
                                        </select>
                                    )}
                                    {newRule.type === 'global_discount' && <span className="text-slate-400 italic">Apply to everything</span>}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        {newRule.type === 'product_fixed_price' ? (
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    className="w-20 border rounded px-2 py-1 bg-white outline-none"
                                                    placeholder="Price"
                                                    value={newRule.fixed_price_eur || ''}
                                                    onChange={e => setNewRule({ ...newRule, fixed_price_eur: Number(e.target.value), discount_percentage: 0 })}
                                                />
                                                <span className="text-xs text-slate-500 uppercase font-bold">EUR</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1">
                                                <input
                                                    type="number"
                                                    className="w-16 border rounded px-2 py-1 bg-white outline-none"
                                                    placeholder="%"
                                                    value={newRule.discount_percentage || ''}
                                                    onChange={e => setNewRule({ ...newRule, discount_percentage: Number(e.target.value), fixed_price_eur: 0 })}
                                                />
                                                <span className="text-xs text-slate-500 font-bold">% OFF</span>
                                            </div>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-right space-x-2">
                                    <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600 text-xs uppercase font-bold">Cancel</button>
                                    <button
                                        onClick={handleAddRule}
                                        className="bg-blue-600 text-white px-3 py-1 rounded text-xs uppercase font-bold hover:bg-blue-700 shadow-sm"
                                    >
                                        Save
                                    </button>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
