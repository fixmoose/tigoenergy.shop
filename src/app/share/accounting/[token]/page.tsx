'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

export default function AccountingSharePage() {
    const { token } = useParams()
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [verifying, setVerifying] = useState(true)
    const [shareData, setShareData] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [step, setStep] = useState<'verify' | 'download'>('verify')

    useEffect(() => {
        async function checkLink() {
            try {
                const res = await fetch(`/api/share/accounting/check?token=${token}`)
                const data = await res.json()
                if (data.success) {
                    setShareData(data.data)
                } else {
                    setError(data.error || 'Link expired or invalid')
                }
            } catch {
                setError('Failed to load sharing details')
            } finally {
                setVerifying(false)
            }
        }
        checkLink()
    }, [token])

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/share/accounting/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, email: email.toLowerCase().trim() })
            })
            const data = await res.json()
            if (data.success) {
                setStep('download')
            } else {
                setError(data.error || 'Email verification failed')
            }
        } catch {
            setError('Verification service unavailable')
        } finally {
            setLoading(false)
        }
    }

    const handleDownload = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/share/accounting/download?token=${token}&email=${encodeURIComponent(email)}`)
            if (!res.ok) throw new Error('Download failed')

            const blob = await res.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            const filename = `Tigo_Accounting_${shareData?.year}_${shareData?.month.toString().padStart(2, '0')}.pdf`
            a.download = filename
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
        } catch (err: any) {
            setError(err.message || 'Failed to merge and download PDFs')
        } finally {
            setLoading(false)
        }
    }

    if (verifying) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
                <div className="animate-spin text-4xl mb-4">🌀</div>
                <p className="text-slate-500 font-medium">Verifying link security...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <div className="bg-white p-8 rounded-3xl shadow-xl border border-red-100 max-w-md w-full text-center">
                    <div className="text-4xl mb-4 text-red-500">⚠️</div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Error</h2>
                    <p className="text-slate-500 mb-6">{error}</p>
                    <a href="/" className="inline-block px-6 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition">
                        Return Home
                    </a>
                </div>
            </div>
        )
    }

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const periodStr = shareData ? `${monthNames[shareData.month - 1]} ${shareData.year}` : ''

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 bg-gradient-to-tr from-slate-100 to-blue-50">
            <div className="bg-white p-8 md:p-12 rounded-3xl shadow-2xl border border-white max-w-lg w-full">
                <div className="flex justify-center mb-8">
                    <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                        <span className="text-white text-3xl font-bold">T</span>
                    </div>
                </div>

                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-slate-800">Accounting Access</h1>
                    <p className="text-slate-500 mt-2">Shared documents for {periodStr}</p>
                </div>

                {step === 'verify' ? (
                    <form onSubmit={handleVerify} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-600 ml-1">Accountant Email</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email to verify"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 transition"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition disabled:opacity-50"
                        >
                            {loading ? 'Verifying...' : 'Verify Access'}
                        </button>
                        <p className="text-center text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                            Link Valid for 24 Hours
                        </p>
                    </form>
                ) : (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-4">
                            <div className="bg-emerald-100 text-emerald-600 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0">
                                ✓
                            </div>
                            <div className="text-sm text-emerald-800">
                                <p className="font-bold">Access Verified</p>
                                <p className="opacity-80">You can now download the bulk invoice PDF.</p>
                            </div>
                        </div>

                        <div className="p-6 border-2 border-dashed border-slate-100 rounded-3xl text-center space-y-4">
                            <div className="text-5xl mb-2">📦</div>
                            <div>
                                <h3 className="font-bold text-slate-800">Consolidated Invoices</h3>
                                <p className="text-xs text-slate-500">Single PDF including all invoices for {periodStr}</p>
                            </div>
                            <button
                                onClick={handleDownload}
                                disabled={loading}
                                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-black transition shadow-xl disabled:bg-slate-400"
                            >
                                {loading ? (
                                    <>
                                        <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                                        Preparing Bulk Document...
                                    </>
                                ) : (
                                    <>
                                        📥 Download Bulk PDF
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
