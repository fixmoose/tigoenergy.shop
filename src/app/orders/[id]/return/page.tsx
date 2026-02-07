'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Order, OrderItem } from '@/types/database'
import { requestReturn } from '@/app/actions/returns'

type ReturnReason = 'found_cheaper' | 'damaged' | 'not_as_described' | 'changed_mind' | 'other'

const REASONS: { value: ReturnReason; label: string; requirePhoto?: boolean }[] = [
    { value: 'found_cheaper', label: 'Found at a lower price elsewhere' },
    { value: 'damaged', label: 'Broken/Damaged on arrival', requirePhoto: true },
    { value: 'not_as_described', label: 'Item not as described' },
    { value: 'changed_mind', label: 'Changed my mind' },
    { value: 'other', label: 'Other reasonable option' },
]

export default function ReturnFlowPage() {
    const params = useParams()
    const router = useRouter()
    const orderId = params.id as string
    const supabase = createClient()

    const [order, setOrder] = useState<Order | null>(null)
    const [items, setItems] = useState<OrderItem[]>([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [step, setStep] = useState(1) // 1: Selection, 2: Reason/Evidence, 3: Success

    // Step 1: Selection
    const [selectedItems, setSelectedItems] = useState<Record<string, number>>({})

    // Step 2: Reason & Evidence
    const [reason, setReason] = useState<ReturnReason | ''>('')
    const [customerNotes, setCustomerNotes] = useState('')
    const [files, setFiles] = useState<File[]>([])
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (!orderId) return
        const fetchData = async () => {
            const { data: orderData } = await supabase.from('orders').select('*').eq('id', orderId).single()
            const { data: itemsData } = await supabase.from('order_items').select('*, products(images)').eq('order_id', orderId)

            if (orderData) setOrder(orderData)
            if (itemsData) {
                setItems(itemsData)
                // Default select all if no selection yet
                const initialSelection: Record<string, number> = {}
                itemsData.forEach(item => {
                    initialSelection[item.id] = 0 // Start with 0 selected
                })
                setSelectedItems(initialSelection)
            }
            setLoading(false)
        }
        fetchData()
    }, [orderId])

    const handleQuantityChange = (itemId: string, qty: number, max: number) => {
        setSelectedItems(prev => ({
            ...prev,
            [itemId]: Math.min(Math.max(0, qty), max)
        }))
    }

    const toggleAll = () => {
        const allSelected = Object.values(selectedItems).every((q, i) => q === items[i].quantity)
        const updated: Record<string, number> = {}
        items.forEach(item => {
            updated[item.id] = allSelected ? 0 : item.quantity
        })
        setSelectedItems(updated)
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(prev => [...prev, ...Array.from(e.target.files!)])
        }
    }

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index))
    }

    const uploadImages = async (): Promise<string[]> => {
        if (!files.length) return []
        setUploading(true)
        const uploadedUrls: string[] = []

        for (const file of files) {
            const path = `returns/${orderId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
            const { data, error } = await supabase.storage.from('return-evidence').upload(path, file)
            if (error) {
                console.error('Upload error:', error)
                continue
            }
            const { data: { publicUrl } } = supabase.storage.from('return-evidence').getPublicUrl(path)
            uploadedUrls.push(publicUrl)
        }
        setUploading(false)
        return uploadedUrls
    }

    const handleSubmit = async () => {
        if (!order || !reason) return

        const selectedItemsList = items
            .filter(item => selectedItems[item.id] > 0)
            .map(item => ({
                product_id: item.product_id || '',
                sku: item.sku,
                product_name: item.product_name,
                quantity: selectedItems[item.id],
                unit_price: item.unit_price
            }))

        if (selectedItemsList.length === 0) {
            alert('Please select at least one item to return.')
            return
        }

        const reasonObj = REASONS.find(r => r.value === reason)
        if (reasonObj?.requirePhoto && files.length === 0) {
            alert('Please upload a photo as evidence for damaged items.')
            return
        }

        setSubmitting(true)

        try {
            const imageUrls = await uploadImages()

            const result = await requestReturn({
                orderId: order.id,
                customerId: order.customer_id!,
                reason: reason as ReturnReason,
                items: selectedItemsList,
                images: imageUrls,
                customerNotes
            })

            if (result.success) {
                setStep(3)
            } else {
                alert(result.error)
            }
        } catch (err) {
            console.error('Submission error:', err)
            alert('Something went wrong. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            </div>
        )
    }

    if (!order) return <div className="p-20 text-center">Order not found.</div>

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4">
            <div className="max-w-3xl mx-auto">
                <div className="mb-8">
                    <Link href={`/orders/${orderId}`} className="text-sm font-bold text-gray-500 hover:text-green-600 flex items-center gap-2 mb-4">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        Back to Order
                    </Link>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight">Easy Returns</h1>
                    <p className="text-gray-500 font-medium mt-1">Order #{order.order_number}</p>
                </div>

                {/* Stepper */}
                <div className="flex justify-between mb-12 relative">
                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 -z-10 -translate-y-1/2"></div>
                    {[1, 2, 3].map(s => (
                        <div key={s} className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm z-10 transition-colors ${step >= s ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                            {s}
                        </div>
                    ))}
                </div>

                <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
                    {step === 1 && (
                        <div className="p-8">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-black text-gray-900">Select Items to Return</h3>
                                <button onClick={toggleAll} className="text-xs font-black text-green-600 uppercase tracking-widest hover:underline">
                                    {Object.values(selectedItems).every((q, i) => q === items[i].quantity) ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>
                            <div className="space-y-4 mb-8">
                                {items.map(item => (
                                    <div key={item.id} className={`p-4 rounded-2xl border transition-all ${selectedItems[item.id] > 0 ? 'border-green-200 bg-green-50/30' : 'border-gray-100'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 bg-white rounded-xl border border-gray-100 flex-shrink-0 p-2">
                                                <img
                                                    src={(item as any).products?.images?.[0] || ''}
                                                    alt=""
                                                    className="w-full h-full object-contain"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-gray-900 truncate">{item.product_name}</h4>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{item.sku}</p>
                                            </div>
                                            <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-1">
                                                <button
                                                    onClick={() => handleQuantityChange(item.id, selectedItems[item.id] - 1, item.quantity)}
                                                    className="w-8 h-8 flex items-center justify-center hover:bg-gray-50 rounded-lg text-gray-400 font-bold"
                                                >-</button>
                                                <span className="w-6 text-center font-black text-sm">{selectedItems[item.id]}</span>
                                                <button
                                                    onClick={() => handleQuantityChange(item.id, selectedItems[item.id] + 1, item.quantity)}
                                                    className="w-8 h-8 flex items-center justify-center hover:bg-gray-50 rounded-lg text-gray-400 font-bold"
                                                >+</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={() => setStep(2)}
                                disabled={Object.values(selectedItems).every(q => q === 0)}
                                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-green-600 transition shadow-xl disabled:opacity-50 disabled:hover:bg-gray-900"
                            >
                                Continue to Reason
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="p-8">
                            <h3 className="text-xl font-black text-gray-900 mb-6">Return Reason</h3>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Why are you returning these?</label>
                                    <select
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value as ReturnReason)}
                                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold text-gray-900 focus:ring-2 focus:ring-green-500 outline-none"
                                    >
                                        <option value="">Select a reason...</option>
                                        {REASONS.map(r => (
                                            <option key={r.value} value={r.value}>{r.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {reason === 'damaged' && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Evidence Photos (Required)</label>
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center hover:border-green-400 hover:bg-green-50/30 transition cursor-pointer group"
                                        >
                                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-green-100 transition">
                                                <svg className="w-6 h-6 text-gray-400 group-hover:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                            </div>
                                            <p className="text-sm font-bold text-gray-500">Click to upload photos of the damage</p>
                                            <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple accept="image/*" className="hidden" />
                                        </div>

                                        {files.length > 0 && (
                                            <div className="grid grid-cols-4 gap-4">
                                                {files.map((file, i) => (
                                                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-gray-100 group/img">
                                                        <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="" />
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                                                            className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition"
                                                        >×</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Additional Notes (Optional)</label>
                                    <textarea
                                        value={customerNotes}
                                        onChange={(e) => setCustomerNotes(e.target.value)}
                                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-medium text-gray-900 h-32 outline-none focus:ring-2 focus:ring-green-500"
                                        placeholder="Tell us more about the issue..."
                                    ></textarea>
                                </div>

                                <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100">
                                    <div className="flex items-start gap-4">
                                        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                                            <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-black text-orange-800 uppercase tracking-widest mb-1">Return Policy Reminder</h4>
                                            <ul className="text-xs text-orange-700 font-medium space-y-1 list-disc pl-4">
                                                <li>Original shipping charges are non-refundable.</li>
                                                <li>You are responsible for shipping items back to Slovenia.</li>
                                                <li>Refunds are processed within 14 days of receipt in good condition.</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <button onClick={() => setStep(1)} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase tracking-widest hover:bg-gray-200 transition">Back</button>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={submitting || !reason || (reason === 'damaged' && files.length === 0)}
                                        className="flex-[2] py-4 bg-green-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-green-700 transition shadow-xl shadow-green-100 disabled:opacity-50"
                                    >
                                        {submitting ? 'Submitting...' : 'Complete Return'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="p-8 text-center animate-in zoom-in duration-500">
                            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <h3 className="text-3xl font-black text-gray-900 mb-4">Return Requested</h3>
                            <p className="text-gray-500 font-medium mb-8">Please follow the instructions below to complete your return.</p>

                            <div className="bg-gray-50 text-left p-8 rounded-3xl border border-gray-100 mb-8 space-y-6">
                                <div>
                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">1. Package your items</h4>
                                    <p className="text-sm text-gray-600 font-medium leading-relaxed">
                                        Place the items in their original packaging. Ensure they are well protected to avoid damage during transit.
                                    </p>
                                </div>
                                <div>
                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">2. Attach the Return Slip</h4>
                                    <p className="text-sm text-gray-600 font-medium mb-4 leading-relaxed">
                                        Download and print the return slip below and put it inside the package.
                                    </p>
                                    <button
                                        onClick={() => window.print()}
                                        className="btn btn-sm bg-white border-gray-200 text-gray-700 font-bold px-4 hover:bg-gray-50 shadow-sm"
                                    >
                                        Download Return Slip (PDF)
                                    </button>
                                </div>
                                <div>
                                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">3. Ship to</h4>
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 font-bold text-gray-900 text-sm">
                                        Initra Energija<br />
                                        Podsmreka 59A<br />
                                        1356 Dobrova<br />
                                        Slovenia
                                    </div>
                                </div>
                            </div>

                            <Link
                                href="/dashboard"
                                className="inline-block px-8 py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-green-600 transition"
                            >
                                Back to Dashboard
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            {/* Print View Styling */}
            <style jsx global>{`
                @media print {
                    body * { visibility: hidden; }
                    .print-area, .print-area * { visibility: visible; }
                    .print-area { position: absolute; left: 0; top: 0; width: 100%; }
                }
            `}</style>
        </div>
    )
}
