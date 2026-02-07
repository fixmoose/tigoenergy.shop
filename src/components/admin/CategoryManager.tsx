'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Category = {
    id: string
    name: string
    slug: string
    parent_id: string | null
    description?: string
    sort_order?: number
    image_url?: string
}

export default function CategoryManager() {
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingCat, setEditingCat] = useState<Category | null>(null)
    const [formData, setFormData] = useState({ name: '', slug: '', parent_id: '', description: '', image_url: '' })

    const supabase = createClient()
    const router = useRouter()

    useEffect(() => {
        fetchCategories()
    }, [])

    async function fetchCategories() {
        setLoading(true)
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('sort_order', { ascending: true })

        if (data) setCategories(data)
        if (error) console.error('Error fetching categories:', error)
        setLoading(false)
    }

    function openModal(cat?: Category) {
        if (cat) {
            setEditingCat(cat)
            setFormData({
                name: cat.name,
                slug: cat.slug,
                parent_id: cat.parent_id || '',
                description: cat.description || '',
                image_url: cat.image_url || ''
            })
        } else {
            setEditingCat(null)
            setFormData({ name: '', slug: '', parent_id: '', description: '', image_url: '' })
        }
        setIsModalOpen(true)
    }

    async function handleSave() {
        const payload: any = {
            name: formData.name,
            slug: formData.slug || formData.name.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-]/g, ''),
            parent_id: formData.parent_id || null,
            description: formData.description,
            image_url: formData.image_url
        }

        let error
        if (editingCat) {
            const res = await supabase.from('categories').update(payload).eq('id', editingCat.id)
            error = res.error
        } else {
            const res = await supabase.from('categories').insert([payload])
            error = res.error
        }

        if (!error) {
            setIsModalOpen(false)
            fetchCategories()
            router.refresh()
        } else {
            alert('Error saving category: ' + error.message)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure? Products using this category might be affected.')) return
        const { error } = await supabase.from('categories').delete().eq('id', id)
        if (!error) {
            fetchCategories()
            router.refresh()
        }
        else alert('Error deleting: ' + error.message)
    }

    // Drag and Drop Logic
    const [draggedItem, setDraggedItem] = useState<Category | null>(null)

    function handleDragStart(e: React.DragEvent, cat: Category) {
        setDraggedItem(cat)
        e.dataTransfer.effectAllowed = 'move'
    }

    function handleDragOver(e: React.DragEvent, targetCat: Category) {
        e.preventDefault()
        if (!draggedItem || draggedItem.id === targetCat.id) return
        if (draggedItem.parent_id !== targetCat.parent_id) return // Only sort siblings
    }

    async function handleDrop(e: React.DragEvent, targetCat: Category) {
        e.preventDefault()
        if (!draggedItem || draggedItem.id === targetCat.id) return

        // Reorder locally
        const siblings = categories.filter(c => c.parent_id === draggedItem.parent_id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        const oldIndex = siblings.findIndex(c => c.id === draggedItem.id)
        const newIndex = siblings.findIndex(c => c.id === targetCat.id)

        const newSiblings = [...siblings]
        const [removed] = newSiblings.splice(oldIndex, 1)
        newSiblings.splice(newIndex, 0, removed)

        // Update local state temporarily to reflect UI
        const updatedCategories = categories.map(c => {
            if (c.parent_id !== draggedItem.parent_id) return c
            const idx = newSiblings.findIndex(s => s.id === c.id)
            if (idx !== -1) return { ...c, sort_order: idx }
            return c
        }).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

        setCategories(updatedCategories)
        setDraggedItem(null)

        // Save to DB
        const updates = newSiblings.map((c, idx) => ({ id: c.id, sort_order: idx }))

        for (const u of updates) {
            await supabase.from('categories').update({ sort_order: u.sort_order }).eq('id', u.id)
        }
    }

    // Hierarchy Builder
    const rootCategories = categories.filter(c => !c.parent_id)
    const getChildren = (parentId: string) => categories.filter(c => c.parent_id === parentId)

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-fit max-h-full">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 sticky top-0 z-10">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                    <span>📂</span> Categorization
                </h3>
                <button className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 font-medium" onClick={() => openModal()}>
                    + New
                </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 bg-gray-50/30">
                {loading ? (
                    <div className="text-center py-8 text-gray-400">Loading...</div>
                ) : (
                    <div className="space-y-4">
                        {rootCategories.length === 0 && <p className="text-gray-400 italic text-center py-4">No categories defined.</p>}

                        {rootCategories.map(root => (
                            <div
                                key={root.id}
                                className="border rounded-lg p-3 bg-white hover:border-blue-200 transition-colors group shadow-sm"
                                draggable
                                onDragStart={(e) => handleDragStart(e, root)}
                                onDragOver={(e) => handleDragOver(e, root)}
                                onDrop={(e) => handleDrop(e, root)}
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm text-gray-800 cursor-move">{root.name}</span>
                                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-mono">{root.slug}</span>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openModal(root)} className="text-[10px] bg-gray-50 border px-1.5 py-0.5 rounded hover:bg-white hover:text-blue-600">✎</button>
                                        <button onClick={() => handleDelete(root.id)} className="text-[10px] bg-gray-50 border border-red-100 text-red-500 px-1.5 py-0.5 rounded hover:bg-red-50">✕</button>
                                    </div>
                                </div>

                                {/* Subcategories */}
                                <div className="ml-2 space-y-1 border-l-2 border-gray-100 pl-3 mt-2">
                                    {getChildren(root.id).map(child => (
                                        <div key={child.id} className="flex justify-between items-center text-xs py-1 px-2 rounded hover:bg-gray-50 group/child">
                                            <div className="flex items-center gap-2">
                                                {child.image_url && <img src={child.image_url} alt="" className="w-4 h-4 object-contain opacity-70" />}
                                                <span className="text-gray-700 font-medium">{child.name}</span>
                                            </div>
                                            <div className="flex gap-2 opacity-0 group-hover/child:opacity-100 transition-opacity">
                                                <button onClick={() => openModal(child)} className="text-[10px] text-blue-600 hover:underline">Edit</button>
                                                <button onClick={() => handleDelete(child.id)} className="text-[10px] text-red-600 hover:underline">Del</button>
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => {
                                            setEditingCat(null)
                                            setFormData({ name: '', slug: '', parent_id: root.id, description: '', image_url: '' })
                                            setIsModalOpen(true)
                                        }}
                                        className="text-[10px] text-blue-500 font-medium hover:underline flex items-center gap-1 mt-1 px-2"
                                    >
                                        + Sub
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md m-4">
                        <h3 className="text-lg font-bold mb-4">{editingCat ? 'Edit Category' : 'New Category'}</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Name</label>
                                <input
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full border rounded px-3 py-2"
                                    placeholder="Category Name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Slug</label>
                                <input
                                    value={formData.slug}
                                    onChange={e => setFormData({ ...formData, slug: e.target.value })}
                                    className="w-full border rounded px-3 py-2 font-mono text-sm"
                                    placeholder="auto-generated"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Parent Category</label>
                                <select
                                    value={formData.parent_id}
                                    onChange={e => setFormData({ ...formData, parent_id: e.target.value })}
                                    className="w-full border rounded px-3 py-2"
                                >
                                    <option value="">None (Top Level)</option>
                                    {rootCategories.filter(c => c.id !== editingCat?.id).map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
