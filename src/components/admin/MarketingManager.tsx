'use client'

import React, { useState, useEffect } from 'react'
import {
    adminGetMarketingAudienceAction,
    adminGetMarketingLettersAction,
    adminSaveMarketingLetterAction,
    adminDeleteMarketingLetterAction,
    adminSendBulkMarketingEmailAction
} from '@/app/actions/admin'

type Tab = 'audience' | 'letters'

export default function MarketingManager() {
    const [activeTab, setActiveTab] = useState<Tab>('audience')
    const [loading, setLoading] = useState(false)
    const [audience, setAudience] = useState<any[]>([])
    const [letters, setLetters] = useState<any[]>([])
    const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([])
    const [editingLetter, setEditingLetter] = useState<any>(null)
    const [sendingStatus, setSendingStatus] = useState<any>(null)
    const [isPreview, setIsPreview] = useState(false)

    // Selection filters
    const [filterType, setFilterType] = useState<'all' | 'b2b' | 'b2c'>('all')
    const [searchTerm, setSearchTerm] = useState('')

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            const [aud, lets] = await Promise.all([
                adminGetMarketingAudienceAction(),
                adminGetMarketingLettersAction()
            ])
            setAudience(aud || [])
            setLetters(lets || [])
        } catch (error) {
            console.error('Error loading marketing data:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredAudience = audience.filter(c => {
        const matchesFilter = filterType === 'all' || (filterType === 'b2b' && c.is_b2b) || (filterType === 'b2c' && !c.is_b2b)
        const matchesSearch = !searchTerm ||
            (c.email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (c.first_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (c.last_name?.toLowerCase().includes(searchTerm.toLowerCase()))
        return matchesFilter && matchesSearch
    })

    const toggleSelectAll = () => {
        if (selectedCustomerIds.length === filteredAudience.length) {
            setSelectedCustomerIds([])
        } else {
            setSelectedCustomerIds(filteredAudience.map(c => c.id))
        }
    }

    const toggleSelectCustomer = (id: string) => {
        if (selectedCustomerIds.includes(id)) {
            setSelectedCustomerIds(selectedCustomerIds.filter(cid => cid !== id))
        } else {
            setSelectedCustomerIds([...selectedCustomerIds, id])
        }
    }

    const handleSaveLetter = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            await adminSaveMarketingLetterAction(editingLetter)
            setEditingLetter(null)
            loadData()
        } catch (error: any) {
            alert('Error saving letter: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteLetter = async (id: string) => {
        if (!confirm('Are you sure you want to delete this marketing letter?')) return
        setLoading(true)
        try {
            await adminDeleteMarketingLetterAction(id)
            loadData()
        } catch (error: any) {
            alert('Error deleting letter: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleSendBulk = async (letterId: string) => {
        if (selectedCustomerIds.length === 0) {
            alert('Please select at least one customer first.')
            setActiveTab('audience')
            return
        }

        const letter = letters.find(l => l.id === letterId)
        if (!confirm(`Send "${letter.title}" to ${selectedCustomerIds.length} customers?`)) return

        setLoading(true)
        setSendingStatus({ status: 'sending', progress: 0, total: selectedCustomerIds.length })
        try {
            const results = await adminSendBulkMarketingEmailAction(letterId, selectedCustomerIds)
            setSendingStatus({
                status: 'completed',
                sent: results.sent,
                failed: results.failed,
                errors: results.errors
            })
            alert(`Campaign complete!\nSent: ${results.sent}\nFailed: ${results.failed}`)
        } catch (error: any) {
            alert('Error sending bulk campaign: ' + error.message)
            setSendingStatus(null)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-800">Marketing Center</h1>
                <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('audience')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'audience' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                    >
                        Audience ({selectedCustomerIds.length} selected)
                    </button>
                    <button
                        onClick={() => setActiveTab('letters')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'letters' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                    >
                        Marketing Letters
                    </button>
                </div>
            </div>

            {activeTab === 'audience' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50">
                        <div className="flex gap-2">
                            <button onClick={() => setFilterType('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${filterType === 'all' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>All</button>
                            <button onClick={() => setFilterType('b2b')} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${filterType === 'b2b' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>B2B</button>
                            <button onClick={() => setFilterType('b2c')} className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${filterType === 'b2c' ? 'bg-green-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>B2C</button>
                        </div>
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="px-4 py-2 border border-slate-200 rounded-xl text-sm w-full max-w-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                                <tr>
                                    <th className="px-6 py-4 w-10">
                                        <input
                                            type="checkbox"
                                            checked={selectedCustomerIds.length === filteredAudience.length && filteredAudience.length > 0}
                                            onChange={toggleSelectAll}
                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                    </th>
                                    <th className="px-6 py-4">Customer</th>
                                    <th className="px-6 py-4">Contact Detail</th>
                                    <th className="px-6 py-4">Type</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredAudience.map(c => (
                                    <tr key={c.id} className={`hover:bg-slate-50 transition-colors ${selectedCustomerIds.includes(c.id) ? 'bg-blue-50/30' : ''}`}>
                                        <td className="px-6 py-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedCustomerIds.includes(c.id)}
                                                onChange={() => toggleSelectCustomer(c.id)}
                                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-900">{c.first_name} {c.last_name}</div>
                                            <div className="text-[10px] text-slate-400 font-mono tracking-tighter uppercase">{c.id}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5 text-slate-600">
                                                    <span className="text-xs">✉️</span> {c.email}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-slate-500">
                                                    <span className="text-xs">📱</span> {c.phone || 'No phone'}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {c.is_b2b ? (
                                                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-[10px] font-black uppercase tracking-widest">B2B</span>
                                            ) : (
                                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-[10px] font-black uppercase tracking-widest">B2C</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {filteredAudience.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400 font-medium">No customers match your filters.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'letters' && (
                <div className="grid lg:grid-cols-2 gap-8">
                    {/* List of Letters */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-lg font-bold text-slate-800">Saved Letters</h3>
                            <button
                                onClick={() => setEditingLetter({ title: '', content_html: '' })}
                                className="bg-blue-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-blue-700 transition"
                            >
                                + Create New
                            </button>
                        </div>

                        {letters.map(letter => (
                            <div key={letter.id} className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md transition group">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 className="font-black text-slate-900 text-lg">{letter.title}</h4>
                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1">
                                            Last Updated: {new Date(letter.updated_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setEditingLetter(letter)}
                                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                            title="Edit Template"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => handleDeleteLetter(letter.id)}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                            title="Delete Template"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                                <div className="border-t border-slate-50 pt-4 flex justify-between items-center">
                                    <span className="text-xs text-slate-400">Can use variables: {"{first_name}"}, {"{last_name}"}</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleSendBulk(letter.id)}
                                            disabled={loading}
                                            className="bg-slate-800 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 shadow-sm transition disabled:opacity-50"
                                        >
                                            Email Clients
                                        </button>
                                        <button
                                            onClick={() => alert('SMS Provider (Seven.io) not fully configured for bulk marketing yet. Phone numbers are ready.')}
                                            className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition"
                                        >
                                            SMS
                                        </button>
                                        <button
                                            onClick={() => alert('WhatsApp Marketing requires Business API verification. Contact data is ready.')}
                                            className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition"
                                        >
                                            WhatsApp
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {letters.length === 0 && (
                            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
                                <p className="text-slate-400 font-medium">No marketing letters saved yet.</p>
                            </div>
                        )}
                    </div>

                    {/* Editor / Preview */}
                    <div>
                        {editingLetter ? (
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden sticky top-8">
                                <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                    <h3 className="text-lg font-black text-slate-900">{editingLetter.id ? 'Edit' : 'Create'} Marketing Letter</h3>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsPreview(!isPreview)}
                                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition shadow-sm ${isPreview ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
                                        >
                                            {isPreview ? '✏️ Editor' : '👁️ Preview'}
                                        </button>
                                        <button onClick={() => { setEditingLetter(null); setIsPreview(false); }} className="text-slate-400 hover:text-slate-600 font-bold text-xl ml-2">✕</button>
                                    </div>
                                </div>
                                <form onSubmit={handleSaveLetter} className="p-8 space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Subject / Title</label>
                                        <input
                                            required
                                            type="text"
                                            value={editingLetter.title}
                                            onChange={e => setEditingLetter({ ...editingLetter, title: e.target.value })}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 outline-none transition"
                                            placeholder="Special Offer for our Tigo Partners..."
                                        />
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-end mb-2">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Email Content (HTML)</label>
                                            <span className="text-[9px] text-slate-400 font-bold">Supports full HTML, styles, and variables</span>
                                        </div>

                                        {isPreview ? (
                                            <div className="w-full h-[500px] border border-slate-200 rounded-2xl bg-white overflow-hidden">
                                                <iframe
                                                    title="Email Preview"
                                                    className="w-full h-full"
                                                    srcDoc={editingLetter.content_html || '<p style="color:#aaa;text-align:center;margin-top:200px">No content to preview</p>'}
                                                />
                                            </div>
                                        ) : (
                                            <textarea
                                                required
                                                rows={18}
                                                value={editingLetter.content_html}
                                                onChange={e => setEditingLetter({ ...editingLetter, content_html: e.target.value })}
                                                className="w-full px-4 py-3 bg-slate-900 text-green-400 border border-slate-700 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition font-mono leading-relaxed resize-y"
                                                placeholder="Hello {first_name}, <br><br> We have a new promotion..."
                                            />
                                        )}
                                    </div>

                                    <div className="pt-4 border-t border-slate-50 flex gap-4">
                                        <button
                                            type="button"
                                            onClick={() => { setEditingLetter(null); setIsPreview(false); }}
                                            className="flex-1 px-6 py-3 border border-slate-200 rounded-2xl text-slate-600 font-bold hover:bg-slate-50 transition"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 shadow-blue-200 shadow-lg disabled:opacity-50 transition"
                                        >
                                            {loading ? 'Saving...' : 'Save Letter'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        ) : (
                            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center h-full flex flex-col items-center justify-center space-y-4">
                                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-slate-300 shadow-sm text-2xl">
                                    ✉️
                                </div>
                                <div>
                                    <p className="text-slate-600 font-black">Editor Standby</p>
                                    <p className="text-slate-400 text-sm mt-1">Select a letter to edit or create a new campaign.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
