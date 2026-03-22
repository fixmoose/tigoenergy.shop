'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

export default function WarehouseUploadMobile() {
    const searchParams = useSearchParams()
    const orderId = searchParams.get('order')
    const warehouseEmail = searchParams.get('email')
    const orderNumber = searchParams.get('num') || ''

    const [status, setStatus] = useState<'ready' | 'uploading' | 'done' | 'error'>('ready')
    const [errorMsg, setErrorMsg] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    const handleFile = async (file: File) => {
        if (!orderId || !warehouseEmail) {
            setErrorMsg('Manjkajoči podatki. Poskusite znova skenirati QR kodo.')
            setStatus('error')
            return
        }
        setStatus('uploading')
        try {
            const formData = new FormData()
            formData.append('email', warehouseEmail)
            formData.append('file', file)
            const res = await fetch(`/api/warehouse/orders/${orderId}/upload`, {
                method: 'POST',
                body: formData,
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data.error || 'Nalaganje ni uspelo')
            }
            setStatus('done')
        } catch (err: any) {
            setErrorMsg(err.message || 'Napaka pri nalaganju')
            setStatus('error')
        }
    }

    if (!orderId || !warehouseEmail) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
                <div className="text-center">
                    <div className="text-4xl mb-4">??</div>
                    <p className="text-white font-bold text-lg">Neveljavna povezava</p>
                    <p className="text-slate-400 text-sm mt-2">Poskusite znova skenirati QR kodo na skladiščnem portalu.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-sm">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                        </svg>
                    </div>
                    <h1 className="text-white font-bold text-xl">Fotografiraj dobavnico</h1>
                    {orderNumber && (
                        <p className="text-orange-400 font-mono font-bold text-lg mt-2">#{orderNumber}</p>
                    )}
                </div>

                {status === 'ready' && (
                    <div className="space-y-3">
                        {/* Camera capture — primary action */}
                        <button
                            onClick={() => inputRef.current?.click()}
                            className="w-full py-5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-lg rounded-2xl transition active:scale-95"
                        >
                            Odpri kamero
                        </button>
                        <input
                            ref={inputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={e => {
                                const file = e.target.files?.[0]
                                if (file) handleFile(file)
                            }}
                        />
                        <p className="text-slate-500 text-xs text-center">Slikaj podpisano dobavnico in bo samodejno naložena.</p>
                    </div>
                )}

                {status === 'uploading' && (
                    <div className="text-center py-8">
                        <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-white font-bold">Nalagam...</p>
                    </div>
                )}

                {status === 'done' && (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                        </div>
                        <p className="text-green-400 font-bold text-lg">Dobavnica naložena!</p>
                        <p className="text-slate-400 text-sm mt-2">Lahko zaprete to stran.</p>
                        <button
                            onClick={() => { setStatus('ready'); setErrorMsg('') }}
                            className="mt-6 px-6 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium"
                        >
                            Naloži novo
                        </button>
                    </div>
                )}

                {status === 'error' && (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <p className="text-red-400 font-bold text-lg">Napaka</p>
                        <p className="text-slate-400 text-sm mt-2">{errorMsg}</p>
                        <button
                            onClick={() => { setStatus('ready'); setErrorMsg('') }}
                            className="mt-6 px-6 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium"
                        >
                            Poskusi znova
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
