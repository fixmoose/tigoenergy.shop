'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { getAdminsAction, inviteAdminAction, deleteAdminAction } from '@/app/actions/admin'
import TemplateManager from '@/components/admin/TemplateManager'
import BankStatementUpload from '@/components/admin/BankStatementUpload'

type Category = {
    id: string
    name: string
    slug: string
    parent_id: string | null
    description?: string
    sort_order?: number
    image_url?: string
}

type Driver = {
    id: string
    name: string
    email: string
    phone: string
    is_warehouse?: boolean
}

export default function SettingsPage() {
    const [categories, setCategories] = useState<Category[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingCat, setEditingCat] = useState<Category | null>(null)
    const [formData, setFormData] = useState({ name: '', slug: '', parent_id: '', description: '', image_url: '' })

    // Admin Team State
    const [admins, setAdmins] = useState<any[]>([])
    const [adminsLoading, setAdminsLoading] = useState(true)
    const [inviteEmail, setInviteEmail] = useState('')
    const [currentUser, setCurrentUser] = useState<any>(null)

    // Drivers State
    const [drivers, setDrivers] = useState<Driver[]>([])
    const [driversLoading, setDriversLoading] = useState(true)
    const [driverForm, setDriverForm] = useState({ name: '', email: '', phone: '' })
    const [editingDriver, setEditingDriver] = useState<Driver | null>(null)

    const supabase = createClient()
    const router = useRouter()

    useEffect(() => {
        fetchCategories()
        fetchAdmins()
        fetchCurrentUser()
        fetchDrivers()
    }, [])

    async function fetchCurrentUser() {
        const { data: { user } } = await supabase.auth.getUser()
        setCurrentUser(user)
    }

    async function fetchAdmins() {
        setAdminsLoading(true)
        try {
            const res = await getAdminsAction()
            if (res.success && Array.isArray(res.data)) {
                setAdmins(res.data)
            } else {
                console.error('Failed to fetch admins:', res.error)
                setAdmins([])
            }
        } catch (err) {
            console.error('Error fetching admins:', err)
            setAdmins([])
        }
        setAdminsLoading(false)
    }

    async function handleInviteAdmin(e: React.FormEvent) {
        e.preventDefault()
        if (!inviteEmail) return
        setAdminsLoading(true)
        try {
            await inviteAdminAction(inviteEmail)
            setInviteEmail('')
            alert('Invitation sent to ' + inviteEmail)
            fetchAdmins()
        } catch (err: any) {
            alert('Error inviting admin: ' + err.message)
        }
        setAdminsLoading(false)
    }

    async function handleDeleteAdmin(userId: string) {
        if (!confirm('Are you sure you want to remove this admin?')) return
        setAdminsLoading(true)
        try {
            await deleteAdminAction(userId)
            alert('Admin removed.')
            fetchAdmins()
        } catch (err: any) {
            alert('Error deleting admin: ' + err.message)
        }
        setAdminsLoading(false)
    }

    async function fetchDrivers() {
        setDriversLoading(true)
        const { data } = await supabase.from('drivers').select('*').order('name')
        setDrivers(data || [])
        setDriversLoading(false)
    }

    async function handleSaveDriver(e: React.FormEvent) {
        e.preventDefault()
        if (!driverForm.name || !driverForm.email) return
        if (editingDriver) {
            const { error } = await supabase.from('drivers').update(driverForm).eq('id', editingDriver.id)
            if (error) { alert('Error: ' + error.message); return }
        } else {
            const { error } = await supabase.from('drivers').insert([driverForm])
            if (error) { alert('Error: ' + error.message); return }
        }
        setDriverForm({ name: '', email: '', phone: '' })
        setEditingDriver(null)
        fetchDrivers()
    }

    async function handleDeleteDriver(id: string) {
        if (!confirm('Remove this driver?')) return
        await supabase.from('drivers').delete().eq('id', id)
        fetchDrivers()
    }

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
        // Hack to hide ghost image if needed, or just let default behavior work
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
        // We need to map over all categories and update the sort_order of these siblings
        const updatedCategories = categories.map(c => {
            if (c.parent_id !== draggedItem.parent_id) return c
            const idx = newSiblings.findIndex(s => s.id === c.id)
            if (idx !== -1) return { ...c, sort_order: idx }
            return c
        }).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

        setCategories(updatedCategories)
        setDraggedItem(null)

        // Save to DB
        // Optimize: only update changed items
        const updates = newSiblings.map((c, idx) => ({ id: c.id, sort_order: idx }))

        for (const u of updates) {
            await supabase.from('categories').update({ sort_order: u.sort_order }).eq('id', u.id)
        }
    }

    // Hierarchy Builder
    const rootCategories = categories.filter(c => !c.parent_id)
    const getChildren = (parentId: string) => categories.filter(c => c.parent_id === parentId)

    return (
        <div className="space-y-6">


            {/* Main Settings Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Categorization Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-fit">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">Categorization</h3>
                            <p className="text-xs text-gray-500 mt-1">Manage product categories and hierarchy.</p>
                        </div>
                        <button className="btn btn-primary btn-sm gap-2" onClick={() => openModal()}>
                            + New Category
                        </button>
                    </div>

                    <div className="p-6">
                        {loading ? (
                            <div className="text-center py-8 text-gray-400">Loading categories...</div>
                        ) : (
                            <div className="space-y-4">
                                {rootCategories.length === 0 && <p className="text-gray-400 italic text-center py-4">No categories defined. Add one to get started.</p>}

                                {rootCategories.map(root => (
                                    <div
                                        key={root.id}
                                        className="border rounded-lg p-3 bg-white hover:border-blue-200 transition-colors group"
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, root)}
                                        onDragOver={(e) => handleDragOver(e, root)}
                                        onDrop={(e) => handleDrop(e, root)}
                                    >
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-800 cursor-move">{root.name}</span>
                                                <span className="text-[10px] px-2 py-0.5 bg-gray-100 rounded text-gray-500 font-mono tracking-tighter">{root.slug}</span>
                                            </div>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openModal(root)} className="text-xs bg-gray-50 border px-2 py-1 rounded hover:bg-white hover:text-blue-600">Edit</button>
                                                <button onClick={() => handleDelete(root.id)} className="text-xs bg-gray-50 border border-red-100 text-red-500 px-2 py-1 rounded hover:bg-red-50">Delete</button>
                                            </div>
                                        </div>

                                        {/* Subcategories */}
                                        <div className="ml-4 space-y-1 border-l-2 border-gray-100 pl-4 mt-2">
                                            {getChildren(root.id).map(child => (
                                                <div key={child.id} className="flex justify-between items-center text-sm py-1.5 px-2 rounded hover:bg-gray-50 group/child">
                                                    <div className="flex items-center gap-2">
                                                        {child.image_url && <img src={child.image_url} alt="" className="w-6 h-6 object-contain" />}
                                                        <span className="text-gray-700">{child.name}</span>
                                                    </div>
                                                    <div className="flex gap-2 opacity-0 group-hover/child:opacity-100 transition-opacity">
                                                        <button onClick={() => openModal(child)} className="text-[10px] text-blue-600 hover:underline">Edit</button>
                                                        <button onClick={() => handleDelete(child.id)} className="text-[10px] text-red-600 hover:underline">Delete</button>
                                                    </div>
                                                </div>
                                            ))}
                                            <button
                                                onClick={() => {
                                                    setEditingCat(null)
                                                    setFormData({ name: '', slug: '', parent_id: root.id, description: '', image_url: '' })
                                                    setIsModalOpen(true)
                                                }}
                                                className="text-xs text-blue-500 font-medium hover:underline flex items-center gap-1 mt-2 px-2"
                                            >
                                                + Add Subcategory
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Admin Team Card */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-fit">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="text-lg font-bold text-gray-800">Admin Team</h3>
                        <p className="text-xs text-gray-500 mt-1">Manage administrative access and permissions.</p>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Invite Form */}
                        <form onSubmit={handleInviteAdmin} className="flex gap-2">
                            <input
                                type="email"
                                placeholder="Email address"
                                value={inviteEmail}
                                onChange={e => setInviteEmail(e.target.value)}
                                className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                required
                            />
                            <button
                                type="submit"
                                disabled={adminsLoading}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
                            >
                                {adminsLoading ? 'Sending...' : 'Invite Admin'}
                            </button>
                        </form>

                        {/* Admins List */}
                        <div className="space-y-3">
                            {adminsLoading && admins.length === 0 ? (
                                <div className="text-center py-4 text-gray-400 text-sm">Loading admins...</div>
                            ) : (
                                admins.map(admin => (
                                    <div key={admin.id} className="flex justify-between items-center p-3 border rounded-lg group">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-gray-800 truncate">{admin.email}</span>
                                                {admin.role === 'Master Admin' && (
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-bold uppercase">Master</span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-gray-400 font-mono">ID: {admin.id}</div>
                                        </div>
                                        {currentUser?.email === 'dejan@haywilson.com' && admin.role !== 'Master Admin' && (
                                            <button
                                                onClick={() => handleDeleteAdmin(admin.id)}
                                                className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 text-xs font-bold transition-opacity"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

            </div>

            {/* Drivers & Warehouse Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-lg font-bold text-gray-800">Drivers & Warehouse</h3>
                    <p className="text-xs text-gray-500 mt-1">Manage delivery drivers and warehouse workers. Toggle &quot;Warehouse&quot; to receive auto-checkout emails and show quick-send buttons on orders.</p>
                </div>
                <div className="p-6 space-y-4">
                    <form onSubmit={handleSaveDriver} className="flex flex-wrap gap-2 items-end">
                        <div className="flex-1 min-w-[140px]">
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Name</label>
                            <input value={driverForm.name} onChange={e => setDriverForm({ ...driverForm, name: e.target.value })}
                                placeholder="Full name" className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
                        </div>
                        <div className="flex-1 min-w-[180px]">
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Email</label>
                            <input type="email" value={driverForm.email} onChange={e => setDriverForm({ ...driverForm, email: e.target.value })}
                                placeholder="driver@email.com" className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
                        </div>
                        <div className="flex-1 min-w-[140px]">
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Phone</label>
                            <input type="tel" value={driverForm.phone} onChange={e => setDriverForm({ ...driverForm, phone: e.target.value })}
                                placeholder="+386 ..." className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                        <div className="flex gap-2">
                            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700">
                                {editingDriver ? 'Update' : 'Add'}
                            </button>
                            {editingDriver && (
                                <button type="button" onClick={() => { setEditingDriver(null); setDriverForm({ name: '', email: '', phone: '' }) }}
                                    className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
                            )}
                        </div>
                    </form>

                    <div className="space-y-2">
                        {driversLoading ? (
                            <div className="text-center py-4 text-gray-400 text-sm">Loading...</div>
                        ) : drivers.length === 0 ? (
                            <div className="text-center py-4 text-gray-400 text-sm italic">No drivers or warehouse workers added yet.</div>
                        ) : drivers.map(d => (
                            <div key={d.id} className="flex justify-between items-center p-3 border rounded-lg group hover:border-blue-200 transition-colors">
                                <div className="min-w-0 flex items-center gap-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-gray-800">{d.name}</span>
                                            {d.is_warehouse && (
                                                <span className="text-[9px] px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded font-bold uppercase">Warehouse</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-gray-500">{d.email}{d.phone ? ` · ${d.phone}` : ''}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={!!d.is_warehouse}
                                            onChange={async (e) => {
                                                const { error } = await supabase.from('drivers').update({ is_warehouse: e.target.checked }).eq('id', d.id)
                                                if (!error) fetchDrivers()
                                            }}
                                            className="w-3.5 h-3.5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                                        />
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">Warehouse</span>
                                    </label>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setEditingDriver(d); setDriverForm({ name: d.name, email: d.email, phone: d.phone }) }}
                                            className="text-xs text-blue-600 hover:underline font-bold">Edit</button>
                                        <button onClick={() => handleDeleteDriver(d.id)}
                                            className="text-xs text-red-500 hover:underline font-bold">Remove</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Banking Section */}
            <BankStatementUpload />

            {/* Document Templates Section */}
            <TemplateManager />

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                        <h3 className="text-lg font-bold mb-4">{editingCat ? 'Edit Category' : 'New Category'}</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Name</label>
                                <input
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full border rounded px-3 py-2"
                                    placeholder="e.g. Inverters"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Slug</label>
                                <input
                                    value={formData.slug}
                                    onChange={e => setFormData({ ...formData, slug: e.target.value })}
                                    className="w-full border rounded px-3 py-2 font-mono text-sm"
                                    placeholder="e.g. inverters"
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
