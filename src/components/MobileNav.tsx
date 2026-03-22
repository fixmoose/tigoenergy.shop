'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCart } from '@/contexts/CartContext'

/**
 * Compact mobile navigation bar — shows on mobile only (lg:hidden).
 * Provides a back-to-home button, page title, and cart access.
 * Hidden on the homepage where MobileLanding takes over.
 */
export default function MobileNav() {
    const pathname = usePathname()
    const { count, openDrawer } = useCart()

    // Don't show on pages with their own fullscreen mobile UI
    if (pathname === '/' || pathname === '/quick-order') return null

    // Derive page title from pathname
    const title = getPageTitle(pathname)

    return (
        <div className="lg:hidden fixed top-0 left-0 right-0 z-[60] bg-slate-900 border-b border-slate-700/50">
            <div className="flex items-center justify-between px-4 py-3">
                {/* Back / Home */}
                <Link
                    href="/"
                    className="flex items-center gap-2 text-white active:opacity-70 transition-opacity"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <img src="/tigo-leaf.png" alt="" className="w-6 h-6 brightness-0 invert opacity-80" />
                </Link>

                {/* Title */}
                <h1 className="text-white text-sm font-medium truncate mx-3 flex-1 text-center">
                    {title}
                </h1>

                {/* Cart */}
                <button
                    onClick={openDrawer}
                    className="relative text-white active:opacity-70 transition-opacity p-1"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-5.98.286h5.98zm0 0h9m-9 0a3 3 0 01-5.98.286M16.5 14.25a3 3 0 005.98.286h-5.98zm0 0a3 3 0 015.98.286M7.106 5.272H20.25a1.125 1.125 0 011.07 1.472l-2.14 6.726a1.125 1.125 0 01-1.07.78H7.5" />
                    </svg>
                    {count > 0 && (
                        <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                            {count > 9 ? '9+' : count}
                        </span>
                    )}
                </button>
            </div>
        </div>
    )
}

function getPageTitle(pathname: string): string {
    if (pathname.startsWith('/dashboard')) return 'Dashboard'
    if (pathname.startsWith('/orders/')) return 'Order Details'
    if (pathname.startsWith('/products/')) return 'Product'
    if (pathname === '/products') return 'Products'
    if (pathname === '/quick-order') return 'Quick Order'
    if (pathname === '/checkout') return 'Checkout'
    if (pathname === '/cart') return 'Cart'
    if (pathname.startsWith('/auth/login')) return 'Sign In'
    if (pathname.startsWith('/auth/register')) return 'Register'
    if (pathname.startsWith('/auth/forgot')) return 'Reset Password'
    if (pathname === '/contact') return 'Contact'
    if (pathname === '/faq') return 'FAQ'
    if (pathname.startsWith('/admin')) return 'Admin'
    if (pathname === '/shipping') return 'Shipping'
    if (pathname === '/returns') return 'Returns'
    if (pathname === '/terms') return 'Terms'
    if (pathname === '/privacy') return 'Privacy'
    return 'Tigo Energy'
}
