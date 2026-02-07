'use client'

import React, { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import B2CRegistrationForm from '@/components/auth/B2CRegistrationForm'
import B2BRegistrationForm from '@/components/auth/B2BRegistrationForm'

function RegisterContent() {
    const searchParams = useSearchParams()
    const type = searchParams.get('type')

    if (type === 'b2c') {
        return (
            <div>
                <h1 className="text-3xl font-bold text-center mb-2">Create Customer Account</h1>
                <p className="text-center text-gray-500 mb-6">For homeowners and individual buyers</p>
                <B2CRegistrationForm />
                <div className="text-center mt-4">
                    <Link href="/auth/register?type=b2b" className="text-sm text-blue-600 hover:underline">
                        Are you a Business? Create B2B Account
                    </Link>
                </div>
            </div>
        )
    }

    if (type === 'b2b') {
        return (
            <div>
                <B2BRegistrationForm />
                <div className="text-center mt-4 pb-8">
                    <Link href="/auth/register?type=b2c" className="text-sm text-gray-500 hover:text-gray-900">
                        Not a business? Create Personal Account
                    </Link>
                </div>
            </div>
        )
    }

    // Selection Screen
    return (
        <div className="max-w-4xl mx-auto py-12 px-4">
            <h1 className="text-3xl font-bold text-center mb-8">Choose Account Type</h1>
            <div className="grid md:grid-cols-2 gap-6">
                <Link href="/auth/register?type=b2c" className="block p-8 bg-white rounded-xl shadow-md border hover:border-green-500 hover:shadow-lg transition-all text-center group">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                    <h2 className="text-xl font-bold mb-2">Personal Account</h2>
                    <p className="text-gray-500">For homeowners purchasing Tigo equipment.</p>
                </Link>

                <Link href="/auth/register?type=b2b" className="block p-8 bg-white rounded-xl shadow-md border hover:border-blue-500 hover:shadow-lg transition-all text-center group">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    </div>
                    <h2 className="text-xl font-bold mb-2">Business Account</h2>
                    <p className="text-gray-500">For installers, distributors, and resellers.</p>
                </Link>
            </div>
        </div>
    )
}

export default function RegisterPage() {
    return (
        <div className="min-h-screen bg-gray-50 pt-14 pb-12">
            <Suspense fallback={<div>Loading...</div>}>
                <RegisterContent />
            </Suspense>
        </div>
    )
}
