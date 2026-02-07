'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
    { name: 'Products', href: '/admin/products' },
    { name: 'Orders', href: '/admin/orders' },
    { name: 'Customers', href: '/admin/customers' },
    { name: 'Pricing', href: '/admin/pricing' },
    { name: 'Marketing', href: '/admin/marketing' },
    { name: 'Suppliers', href: '/admin/suppliers' },
    { name: 'Reporting', href: '/admin/reporting' },
    { name: 'Settings', href: '/admin/settings' },
]

export default function AdminNavigation() {
    const pathname = usePathname()

    return (
        <div className="flex flex-wrap items-center gap-2">
            {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href)
                return (
                    <Link
                        key={item.name}
                        href={item.href}
                        className={`text-sm px-3 py-2 rounded transition-colors border ${isActive
                            ? 'bg-gray-600 text-white border-gray-600 font-medium shadow-sm'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                            }`}
                    >
                        {item.name}
                    </Link>
                )
            })}
            <a
                href="/api/auth/signout"
                className="text-sm text-red-600 border border-red-200 px-3 py-2 rounded hover:bg-red-50 ml-2"
            >
                Sign out
            </a>
        </div>
    )
}
