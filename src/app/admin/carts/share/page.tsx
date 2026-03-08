
import React from 'react'
import SharedCartCreator from '@/components/admin/SharedCartCreator'
import Link from 'next/link'

export default function AdminShareCartPage() {
    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <Link
                    href="/admin/carts"
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                </Link>
                <div>
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Shared Cart Creator</h1>
                    <p className="text-slate-500 text-sm">Build equipment packages and share them with your customers.</p>
                </div>
            </div>

            <SharedCartCreator />
        </div>
    )
}
