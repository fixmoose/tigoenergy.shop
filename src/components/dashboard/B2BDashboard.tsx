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
import B2BTerms from './tabs/B2BTerms'

interface Props {
    user: User
    customer: Customer
}

export default function B2BDashboard({ user, customer }: Props) {
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
            id: 'overview', label: 'Company Overview', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            )
        },
        {
            id: 'orders', label: 'Purchase History (Net)', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
            )
        },
        {
            id: 'profile', label: 'Business Profile', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            )
        },
        {
            id: 'address', label: 'Logistics Addresses', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            )
        },
        {
            id: 'terms', label: 'Commercial Contract', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            )
        },
        {
            id: 'payment', label: 'Finance & Payments', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
            )
        },
        {
            id: 'docs', label: 'Technical Docs', icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            )
        },
    ]

    const handleScrollTo = (id: string) => {
        const el = document.getElementById(id)
        if (el) {
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
            <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white rounded-full p-3 shadow-lg md:hidden hover:bg-black transition-colors"
                aria-label="Back to Top"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
            </button>

            <aside className="md:w-64 flex-shrink-0">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-[180px] z-30 self-start transition-all duration-300">
                    <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                        <div className="w-16 h-16 rounded-2xl mx-auto mb-3 overflow-hidden shadow-md border-2 border-white bg-gray-900 flex items-center justify-center">
                            <span className="text-white font-black text-xl">{customer.company_name?.substring(0, 1).toUpperCase() || 'B'}</span>
                        </div>
                        <div className="text-center">
                            <h3 className="font-bold text-gray-900 truncate">{customer.company_name || 'Business Partner'}</h3>
                            <p className="text-[10px] text-green-600 font-bold uppercase tracking-widest">{customer.vat_id ? 'Verified B2B' : 'B2B Partner'}</p>
                        </div>
                    </div>
                    <nav className="p-2 space-y-1">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => handleScrollTo(tab.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeHash === tab.id
                                    ? 'bg-gray-900 text-white'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </aside>

            <main className="flex-1 min-w-0 flex flex-col gap-12 pb-20">
                <section id="overview" className="scroll-mt-[180px]">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-gray-400 uppercase tracking-wider text-xs">Business Overview</h2>
                        <span className="bg-blue-50 text-blue-700 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-tighter">B2B Terms Apply</span>
                    </div>
                    <DashboardOverview user={user} customer={customer} />
                </section>

                <section id="orders" className="scroll-mt-[180px]">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-gray-400 uppercase tracking-wider text-xs">Purchase History</h2>
                        <span className="text-[10px] text-gray-400 font-medium">Net Pricing Model</span>
                    </div>
                    < MyOrders user={user} customer={customer} />
                </section>

                <section id="profile" className="scroll-mt-[180px]">
                    <h2 className="mb-4 text-lg font-bold text-gray-400 uppercase tracking-wider text-xs">Business Information</h2>
                    <ProfileSettings customer={customer} />
                </section>

                <section id="address" className="scroll-mt-[180px]">
                    <h2 className="mb-4 text-lg font-bold text-gray-400 uppercase tracking-wider text-xs">Logistics & Branches</h2>
                    <AddressBook customer={customer} />
                </section>

                <section id="terms" className="scroll-mt-[180px]">
                    <h2 className="mb-4 text-lg font-bold text-gray-400 uppercase tracking-wider text-xs">Legal Framework</h2>
                    <B2BTerms customer={customer} />
                </section>

                <section id="payment" className="scroll-mt-[180px]">
                    <h2 className="mb-4 text-lg font-bold text-gray-400 uppercase tracking-wider text-xs">Payment Information</h2>
                    <PaymentMethods customer={customer} />
                </section>

                <section id="docs" className="scroll-mt-[180px]">
                    <h2 className="mb-4 text-lg font-bold text-gray-400 uppercase tracking-wider text-xs">Resources</h2>
                    <Documentation customer={customer} />
                </section>
            </main>
        </div>
    )
}
