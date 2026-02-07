'use client'
import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { Customer } from '@/types/database'
import DashboardOverview from './tabs/DashboardOverview'
import ProfileSettings from './tabs/ProfileSettings'
import AddressBook from './tabs/AddressBook'
import MarketingPreferences from './tabs/MarketingPreferences'
import PaymentMethods from './tabs/PaymentMethods'
import Documentation from './tabs/Documentation'
import MyOrders from './tabs/MyOrders'

interface Props {
    user: User
    customer: Customer
}

export default function B2CDashboard({ user, customer }: Props) {
    const [activeHash, setActiveHash] = useState('overview')

    // Handle hash on mount
    useEffect(() => {
        const hash = window.location.hash.replace('#', '')
        if (hash) {
            // Give it a small delay for content to render
            setTimeout(() => handleScrollTo(hash), 100)
        }
    }, [])

    const TABS = [
        {
            id: 'overview', label: 'Overview', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            )
        },
        {
            id: 'profile', label: 'My Profile', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            )
        },
        {
            id: 'address', label: 'Addresses', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            )
        },
        {
            id: 'orders', label: 'My Orders', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
            )
        },
        {
            id: 'payment', label: 'Payment Methods', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
            )
        },
        {
            id: 'preferences', label: 'Preferences', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            )
        },
        {
            id: 'docs', label: 'Documents', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            )
        },
    ]

    const handleScrollTo = (id: string) => {
        const el = document.getElementById(id)
        if (el) {
            // Adjust for header 
            const headerOffset = 180;
            const elementPosition = el.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: "smooth"
            });
            setActiveHash(id)
        }
    }

    // Optional: IntersectionObserver to update activeHash on scroll
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setActiveHash(entry.target.id)
                }
            })
        }, { threshold: 0.5 })

        TABS.forEach(tab => {
            const el = document.getElementById(tab.id)
            if (el) observer.observe(el)
        })

        return () => observer.disconnect()
    }, [])

    return (
        <div className="flex flex-col md:flex-row gap-8 relative">
            {/* Scroll to Top FAB (Mobile only?) */}
            <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="fixed bottom-6 right-6 z-50 bg-green-600 text-white rounded-full p-3 shadow-lg md:hidden hover:bg-green-700 transition-colors"
                aria-label="Back to Top"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
            </button>

            {/* Floating Sticky Sidebar */}
            <aside className="md:w-64 flex-shrink-0">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-[180px] z-30 self-start transition-all duration-300">
                    <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                        <div className="w-16 h-16 rounded-full mx-auto mb-3 overflow-hidden shadow-md border-2 border-white">
                            <img
                                src="/b2c-avatar.png"
                                alt="Profile"
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="text-center">
                            <h3 className="font-bold text-gray-900 truncate">{customer.first_name} {customer.last_name}</h3>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                    </div>
                    <nav className="p-2 space-y-1">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => handleScrollTo(tab.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeHash === tab.id
                                    ? 'bg-green-50 text-green-700'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                        <div className="pt-2 mt-2 border-t border-gray-100">
                            <form action="/auth/signout" method="post">
                                <button type="submit" className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium transition">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                                    Sign Out
                                </button>
                            </form>
                        </div>
                    </nav>
                </div>
            </aside>

            {/* Main Content (Single Page Scroll) */}
            <main className="flex-1 min-w-0 flex flex-col gap-12 pb-20">
                <section id="overview" className="scroll-mt-[180px]">
                    <DashboardOverview user={user} customer={customer} />
                </section>

                <section id="profile" className="scroll-mt-[180px]">
                    <div className="mb-4">
                        <h2 className="text-lg font-bold text-gray-400 uppercase tracking-wider text-xs">Profile Settings</h2>
                    </div>
                    <ProfileSettings customer={customer} />
                </section>

                <section id="address" className="scroll-mt-[180px]">
                    <div className="mb-4">
                        <h2 className="text-lg font-bold text-gray-400 uppercase tracking-wider text-xs">Address Book</h2>
                    </div>
                    <AddressBook customer={customer} />
                </section>

                <section id="orders" className="scroll-mt-[180px]">
                    <div className="mb-4">
                        <h2 className="text-lg font-bold text-gray-400 uppercase tracking-wider text-xs">Manage Orders</h2>
                    </div>
                    < MyOrders user={user} customer={customer} />
                </section>

                <section id="payment" className="scroll-mt-[180px]">
                    <div className="mb-4">
                        <h2 className="text-lg font-bold text-gray-400 uppercase tracking-wider text-xs">Payment Methods</h2>
                    </div>
                    <PaymentMethods customer={customer} />
                </section>

                <section id="preferences" className="scroll-mt-[180px]">
                    <div className="mb-4">
                        <h2 className="text-lg font-bold text-gray-400 uppercase tracking-wider text-xs">Communication</h2>
                    </div>
                    <MarketingPreferences customer={customer} />
                </section>

                <section id="docs" className="scroll-mt-[180px]">
                    <div className="mb-4">
                        <h2 className="text-lg font-bold text-gray-400 uppercase tracking-wider text-xs">Legal & Documents</h2>
                    </div>
                    <Documentation customer={customer} />
                </section>
            </main>
        </div>
    )
}
