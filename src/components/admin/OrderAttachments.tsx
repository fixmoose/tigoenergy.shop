'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface Attachment {
    action: string
    by_email: string
    by_name: string
    at: string
    file_url?: string
    note?: string
    comment?: string
}

export default function OrderAttachments({ orderId, warehouseActions }: { orderId: string; warehouseActions: Attachment[] }) {
    const [uploading, setUploading] = useState(false)
    const [note, setNote] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)
    const router = useRouter()

    // Filter to only file attachments
    const attachments = warehouseActions.filter(a => a.action === 'uploaded_dobavnica' || a.action === 'admin_attachment')

    const handleUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return
        setUploading(true)
        try {
            for (const file of Array.from(files)) {
                const formData = new FormData()
                formData.append('file', file)
                if (note.trim()) formData.append('note', note.trim())

                await fetch(`/api/admin/orders/${orderId}/attachments`, {
                    method: 'POST',
                    body: formData,
                })
            }
            setNote('')
            if (inputRef.current) inputRef.current.value = ''
            router.refresh()
        } finally {
            setUploading(false)
        }
    }

    const handleDelete = async (index: number) => {
        if (!confirm('Remove this attachment?')) return
        await fetch(`/api/admin/orders/${orderId}/attachments`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actionIndex: index }),
        })
        router.refresh()
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border p-5 mb-6">
            <h3 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
                Internal Attachments
                {attachments.length > 0 && (
                    <span className="text-xs text-slate-400 font-normal">({attachments.length})</span>
                )}
            </h3>

            {/* Existing attachments */}
            {attachments.length > 0 && (
                <div className="space-y-1.5 mb-3">
                    {warehouseActions.map((a, i) => {
                        if (a.action !== 'uploaded_dobavnica' && a.action !== 'admin_attachment') return null
                        const time = new Date(a.at)
                        const fileName = a.file_url ? decodeURIComponent(a.file_url.split('path=')[1] || '').split('/').pop() : 'file'
                        return (
                            <div key={i} className="flex items-center gap-2 text-sm bg-slate-50 rounded-lg px-3 py-2 group">
                                <span className="text-base">
                                    {fileName?.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i) ? '🖼️' : '📄'}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <a href={a.file_url} target="_blank" rel="noopener noreferrer"
                                        className="text-blue-600 text-xs hover:underline font-medium truncate block">
                                        {fileName}
                                    </a>
                                    <div className="text-slate-400 text-[10px]">
                                        {a.by_name || a.by_email} · {time.toLocaleDateString('sl-SI')} {time.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}
                                        {(a.note || a.comment) && <span className="ml-1 text-slate-500">— {a.note || a.comment}</span>}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(i)}
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-red-400 hover:bg-red-100 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                                    title="Remove"
                                >
                                    ✕
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Upload area */}
            <div className="flex gap-2 items-end">
                <div className="flex-1">
                    <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Note (optional)"
                        className="w-full text-xs border border-slate-200 rounded-lg px-3 py-1.5 mb-1.5 focus:outline-none focus:border-blue-400"
                    />
                    <input
                        ref={inputRef}
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.bmp,.doc,.docx,.xls,.xlsx"
                        onChange={(e) => handleUpload(e.target.files)}
                        disabled={uploading}
                        className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100 disabled:opacity-50"
                    />
                </div>
            </div>
            {uploading && (
                <p className="text-xs text-blue-500 mt-1">Uploading...</p>
            )}
        </div>
    )
}
