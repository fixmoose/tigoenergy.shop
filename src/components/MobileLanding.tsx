'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { useTranslations } from 'next-intl'

const TILE_COLORS = {
    green: 'bg-amber-600',
    teal: 'bg-teal-600',
    blue: 'bg-blue-600',
    orange: 'bg-orange-500',
    slate: 'bg-slate-600',
    indigo: 'bg-indigo-600',
}

function Tile({
    href,
    color,
    icon,
    label,
    sublabel,
    className = '',
}: {
    href: string
    color: string
    icon: React.ReactNode
    label: string
    sublabel?: string
    className?: string
}) {
    return (
        <Link
            href={href}
            className={`${color} text-white rounded-sm p-5 flex flex-col justify-between
                active:scale-[0.95] active:brightness-90 transition-all
                shadow-md ${className}`}
        >
            <div className="mb-4">{icon}</div>
            <div>
                <div className="text-xl font-bold leading-tight">{label}</div>
                {sublabel && <div className="text-white/60 text-xs mt-1">{sublabel}</div>}
            </div>
        </Link>
    )
}

export default function MobileLanding() {
    const [user, setUser] = useState<User | null>(null)
    const [checking, setChecking] = useState(true)
    const [signingOut, setSigningOut] = useState(false)
    const router = useRouter()
    const t = useTranslations('mobileLanding')

    useEffect(() => {
        const supabase = createClient()
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user)
            setChecking(false)
        })
    }, [])

    // Prevent body scroll behind the fixed overlay on mobile
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 1023px)')
        if (mq.matches) {
            document.body.style.overflow = 'hidden'
            return () => { document.body.style.overflow = '' }
        }
    }, [])

    if (checking) {
        return (
            <div className="fixed inset-0 z-[60] bg-slate-900 flex items-center justify-center lg:hidden">
                <div className="w-6 h-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    const isAdmin = user?.user_metadata?.role === 'admin'

    return (
        <div className="fixed inset-0 z-[60] bg-slate-900 flex flex-col lg:hidden overflow-y-auto">
            {/* Header */}
            <div className="px-5 pt-8 pb-4">
                <img src="/tigo-leaf.png" alt="Initra Energija" className="w-10 h-10 brightness-0 invert opacity-90 mb-4" />
                <h1 className="text-2xl font-light text-white tracking-wide">
                    {user ? t('welcomeBack') : t('brandName')}
                </h1>
                {!user && (
                    <p className="text-slate-400 text-sm mt-1">{t('brandTagline')}</p>
                )}
                {user && (
                    <p className="text-slate-400 text-sm mt-1 truncate">{user.email}</p>
                )}
            </div>

            {/* Tiles */}
            <div className="flex-1 px-4 pb-6">
                {!user ? (
                    /* ── Guest tiles ── */
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <Tile
                            href="/auth/login"
                            color={TILE_COLORS.green}
                            className="aspect-square"
                            label={t('signIn')}
                            sublabel={t('signInSub')}
                            icon={
                                <svg className="w-8 h-8 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                                </svg>
                            }
                        />
                        <Tile
                            href="/auth/register?type=b2b"
                            color={TILE_COLORS.teal}
                            className="aspect-square"
                            label={t('register')}
                            sublabel={t('registerSub')}
                            icon={
                                <svg className="w-8 h-8 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                                </svg>
                            }
                        />
                        <Tile
                            href="/products"
                            color={TILE_COLORS.slate}
                            className="aspect-square"
                            label={t('products')}
                            sublabel={t('productsSub')}
                            icon={
                                <svg className="w-8 h-8 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                                </svg>
                            }
                        />
                        <Tile
                            href="/contact"
                            color={TILE_COLORS.orange}
                            className="aspect-square"
                            label={t('contact')}
                            sublabel={t('contactSub')}
                            icon={
                                <svg className="w-8 h-8 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                                </svg>
                            }
                        />
                    </div>
                ) : isAdmin ? (
                    /* ── Admin tiles ── */
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <Tile
                            href="/admin"
                            color={TILE_COLORS.green}
                            className="aspect-square"
                            label={t('admin')}
                            sublabel={t('adminSub')}
                            icon={
                                <svg className="w-8 h-8 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                                </svg>
                            }
                        />
                        <Tile
                            href="/admin/orders"
                            color={TILE_COLORS.teal}
                            className="aspect-square"
                            label={t('orders')}
                            sublabel={t('ordersSub')}
                            icon={
                                <svg className="w-8 h-8 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                </svg>
                            }
                        />
                        <Tile
                            href="/admin/customers"
                            color={TILE_COLORS.blue}
                            className="aspect-square"
                            label={t('customers')}
                            sublabel={t('customersSub')}
                            icon={
                                <svg className="w-8 h-8 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                                </svg>
                            }
                        />
                        <Tile
                            href="/products"
                            color={TILE_COLORS.slate}
                            className="aspect-square"
                            label={t('products')}
                            sublabel={t('productsSub')}
                            icon={
                                <svg className="w-8 h-8 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                                </svg>
                            }
                        />
                    </div>
                ) : (
                    /* ── Logged-in customer tiles ── */
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <Tile
                            href="/quick-order"
                            color={TILE_COLORS.green}
                            className="aspect-square"
                            label={t('quickOrder')}
                            sublabel={t('quickOrderSub')}
                            icon={
                                <svg className="w-8 h-8 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                                </svg>
                            }
                        />
                        <Tile
                            href="/dashboard#orders"
                            color={TILE_COLORS.teal}
                            className="aspect-square"
                            label={t('myOrders')}
                            sublabel={t('myOrdersSub')}
                            icon={
                                <svg className="w-8 h-8 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                </svg>
                            }
                        />
                        <Tile
                            href="/dashboard"
                            color={TILE_COLORS.blue}
                            className="aspect-square"
                            label={t('dashboard')}
                            sublabel={t('dashboardSub')}
                            icon={
                                <svg className="w-8 h-8 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                                </svg>
                            }
                        />
                        <Tile
                            href="/products"
                            color={TILE_COLORS.slate}
                            className="aspect-square"
                            label={t('products')}
                            sublabel={t('productsSub')}
                            icon={
                                <svg className="w-8 h-8 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                                </svg>
                            }
                        />
                    </div>
                )}
            </div>

            {/* Bottom — sign out + brand */}
            <div className="px-5 pb-6 text-center space-y-3">
                {user && (
                    <button
                        onClick={async () => {
                            setSigningOut(true)
                            const supabase = createClient()
                            await supabase.auth.signOut()
                            router.refresh()
                            window.location.reload()
                        }}
                        disabled={signingOut}
                        className="text-slate-500 text-xs hover:text-slate-300 transition active:text-white"
                    >
                        {signingOut ? t('signingOut') : t('signOut')}
                    </button>
                )}
                <p className="text-slate-600 text-xs">{t('brand')} &middot; tigoenergy.shop</p>
            </div>
        </div>
    )
}
