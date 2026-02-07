'use client'

import React from 'react'
import Link from 'next/link'
import SignOutButton from '@/components/admin/SignOutButton'

export default function AdminHeader() {
    return (
        <header className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
                <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
            </div>
            <div className="flex items-center gap-4">
                <Link
                    href="/admin/products"
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border rounded hover:bg-gray-100"
                >
                    <span>Products</span>
                </Link>
                <Link
                    href="/admin/orders"
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border rounded hover:bg-gray-100"
                >
                    <span>Orders</span>
                </Link>
                <Link
                    href="/admin/carts"
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border rounded hover:bg-gray-100"
                >
                    <span>Carts</span>
                </Link>
                <Link
                    href="/admin/customers"
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border rounded hover:bg-gray-100"
                >
                    <span>Customers</span>
                </Link>
                <Link
                    href="/admin/reporting"
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border rounded hover:bg-gray-100"
                >
                    <span>Reporting</span>
                </Link>
                <Link
                    href="/admin/settings"
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border rounded hover:bg-gray-100"
                >
                    <span>Settings</span>
                </Link>
                <form action="/api/auth/signout" method="POST">
                    <button
                        type="submit"
                        className="text-sm text-gray-700 border px-3 py-2 rounded hover:bg-gray-100"
                    >
                        Sign out
                    </button>
                </form>
            </div>
        </header>
    )
}
