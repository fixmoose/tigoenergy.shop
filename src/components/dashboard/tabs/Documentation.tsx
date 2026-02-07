'use client'
import { useState, useEffect } from 'react'
import { Customer } from '@/types/database'

interface Props {
    customer: Customer
}

interface UploadedDoc {
    id: string
    name: string
    date: string
    status: 'pending' | 'reviewed' | 'rejected'
    customerId?: string
    adminNote?: string
}

export default function Documentation({ customer }: Props) {
    const agreedDate = new Date(customer.created_at || Date.now()).toLocaleDateString()
    const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([])
    const [uploading, setUploading] = useState(false)

    useEffect(() => {
        const stored = localStorage.getItem('tigo_uploaded_docs')
        if (stored) {
            setUploadedDocs(JSON.parse(stored))
        }
    }, [])

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)

        // Simulate upload delay
        setTimeout(() => {
            const newDoc: UploadedDoc = {
                id: Math.random().toString(36).substr(2, 9),
                name: file.name,
                date: new Date().toLocaleDateString(),
                status: 'pending',
                customerId: customer.id
            }

            const updated = [newDoc, ...uploadedDocs]
            setUploadedDocs(updated)
            localStorage.setItem('tigo_uploaded_docs', JSON.stringify(updated))
            setUploading(false)

            // Mock System Notification
            console.log(`[SYSTEM] Notification sent to Admin: New document '${file.name}' uploaded by customer ${customer.id}`)
            alert(`Document '${file.name}' uploaded successfully!\n\nWe have notified our team to review this document.`)
        }, 1500)
    }

    const DOCUMENTS = [
        {
            id: 'terms',
            title: 'Terms & Conditions',
            version: 'v2.4 (2025)',
            agreed: true,
            desc: 'General terms of service for Tigo Energy Shop.'
        },
        {
            id: 'privacy',
            title: 'Privacy Policy',
            version: 'v1.2 (2024)',
            agreed: true,
            desc: 'How we handle and protect your personal data.'
        },
        {
            id: 'sepa',
            title: 'SEPA Mandate Template',
            version: 'v1.0',
            agreed: false,
            desc: 'Blank template for SEPA Direct Debit authorization.'
        }
    ]

    const handleDownload = (doc: any) => {
        alert(`Downloading ${doc.title}...\n\nNote: Includes confirmation that ${customer.first_name} ${customer.last_name} agreed to this on ${agreedDate}.`)
    }

    const handleDownloadUpload = (doc: UploadedDoc) => {
        // In a real app, this would fetch the file from storage
        alert(`Downloading ${doc.name}...`)
    }

    const handleDeleteUpload = (docId: string) => {
        if (!confirm('Are you sure you want to delete this document?')) return

        const updated = uploadedDocs.filter(d => d.id !== docId)
        setUploadedDocs(updated)
        localStorage.setItem('tigo_uploaded_docs', JSON.stringify(updated))
    }

    return (
        <div className="space-y-8">
            <div className="grid md:grid-cols-2 gap-6">
                {DOCUMENTS.map(doc => (
                    <div key={doc.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div>
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                </div>
                                {doc.agreed && (
                                    <span className="bg-green-50 text-green-700 text-xs font-bold px-2 py-1 rounded-full border border-green-100 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                        Agreed
                                    </span>
                                )}
                            </div>
                            <h3 className="font-bold text-gray-900 text-lg mb-1">{doc.title}</h3>
                            <p className="text-sm text-gray-500 mb-4">{doc.desc}</p>

                            {doc.agreed && (
                                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 mb-4 border border-gray-100">
                                    <p className="font-medium text-gray-700">Confirmation</p>
                                    Customer accepted on: {agreedDate}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => handleDownload(doc)}
                            className="w-full border border-gray-200 text-gray-700 font-medium py-2.5 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            Download PDF
                        </button>
                    </div>
                ))}

                {/* Upload Card */}
                <div className="bg-white rounded-2xl shadow-sm border-2 border-dashed border-gray-300 p-6 flex flex-col justify-center items-center text-center hover:border-green-400 transition-colors group">
                    <div className="p-4 bg-gray-50 text-gray-400 rounded-full mb-4 group-hover:bg-green-50 group-hover:text-green-500 transition-colors">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg mb-2">Upload Document</h3>
                    <p className="text-sm text-gray-500 mb-6">Scan and upload your signed SEPA mandate or other requested documents.</p>

                    <label className={`cursor-pointer bg-gray-900 text-white px-6 py-3 rounded-xl font-bold shadow-sm hover:bg-black transition-all w-full flex items-center justify-center gap-2 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {uploading ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Uploading...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Select File
                            </>
                        )}
                        <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} accept=".pdf,.jpg,.png" />
                    </label>
                </div>
            </div>

            {/* Uploaded Documents List */}
            {uploadedDocs.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b border-gray-100 font-bold text-gray-700">
                        Your Uploads
                    </div>
                    <div className="divide-y divide-gray-50">
                        {uploadedDocs.map(doc => (
                            <div key={doc.id} className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-gray-100 rounded-lg text-gray-500">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-gray-900">{doc.name}</h4>
                                        <p className="text-xs text-gray-500">Uploaded on {doc.date}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                                        doc.status === 'reviewed' ? 'bg-green-100 text-green-700' :
                                        doc.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                        'bg-yellow-100 text-yellow-700'
                                    }`}>
                                        {doc.status}
                                    </span>
                                    <button
                                        onClick={() => handleDownloadUpload(doc)}
                                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Download"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    </button>
                                    <button
                                        onClick={() => handleDeleteUpload(doc.id)}
                                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Delete"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
