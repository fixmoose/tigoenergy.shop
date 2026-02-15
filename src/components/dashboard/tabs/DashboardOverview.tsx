'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Customer, Order } from '@/types/database'

interface Props {
    user: User
    customer: Customer
}

export default function DashboardOverview({ user, customer }: Props) {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedOrder, setSelectedOrder] = useState<string>('')

    const firstName = customer?.first_name || user?.user_metadata?.first_name || 'Valued Customer'

    useEffect(() => {
        const fetchOrders = async () => {
            const supabase = createClient()
            const { data } = await supabase
                .from('orders')
                .select('*')
                .eq('customer_id', user.id)
                .order('created_at', { ascending: false })
                .limit(5)

            if (data) setOrders(data)
            setLoading(false)
        }
        fetchOrders()
    }, [user.id])

    const handleSupportContact = () => {
        let subject = `Support Request - Tigo Energy Shop`
        let body = `Hello Support,\n\nI need help with...`

        if (selectedOrder) {
            const order = orders.find(o => o.id === selectedOrder)
            if (order) {
                subject = `Support Request - Order #${order.order_number}`
                body = `Hello Support,\n\nI have a question regarding Order #${order.order_number} (${new Date(order.created_at || '').toLocaleDateString()}).\n\n[Describe issue here]`
            }
        }

        const params = new URLSearchParams({
            subject: subject,
            message: body
        })

        if (selectedOrder) {
            const order = orders.find(o => o.id === selectedOrder)
            if (order) params.set('orderId', order.id)
        }

        window.location.href = `/contact?${params.toString()}`
    }

    const scrollToSection = (id: string) => {
        const el = document.getElementById(id)
        if (el) {
            const headerOffset = 100;
            const elementPosition = el.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            window.scrollTo({ top: offsetPosition, behavior: "smooth" });
        }
    }

    return (
        <div className="space-y-8">
            {/* Welcome Hero */}
            <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                    <h1 className="text-3xl font-bold mb-2">Welcome back, {firstName}!</h1>
                    <p className="text-green-50 opacity-90">Manage your profile, orders, and preferences from your personal dashboard.</p>
                </div>
                {/* Decorative Circles */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
                <div className="absolute bottom-0 right-10 w-32 h-32 bg-white opacity-5 rounded-full translate-y-1/3 pointer-events-none"></div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-6 items-start">
                {/* My Cart */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full hover:shadow-md transition-shadow">
                    <div className="flex-1">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        </div>
                        <h3 className="font-bold text-lg text-gray-900 mb-2">My Cart</h3>
                        <p className="text-sm text-gray-500">Review your pending items and proceed to checkout.</p>
                    </div>
                    <Link href="/cart" className="mt-6 block w-full text-center bg-gray-50 text-gray-900 font-medium py-2.5 rounded-xl hover:bg-gray-100 transition-colors border border-gray-200">
                        View Cart
                    </Link>
                </div>

                {/* Support with Order Dropdown */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full hover:shadow-md transition-shadow">
                    <div className="flex-1">
                        <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-4">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        </div>
                        <h3 className="font-bold text-lg text-gray-900 mb-2">Help & Support</h3>
                        <p className="text-sm text-gray-500 mb-4">Select an order from this menu if you have questions about it or the products inside this order.</p>

                        <div className="relative">
                            <select
                                className="w-full border border-gray-200 rounded-lg p-2.5 text-sm mb-2 outline-none focus:ring-2 focus:ring-purple-500 appearance-none bg-white"
                                value={selectedOrder}
                                onChange={(e) => setSelectedOrder(e.target.value)}
                            >
                                <option value="">General Inquiry / No Specific Order</option>
                                {orders.map(order => (
                                    <option key={order.id} value={order.id}>
                                        Order #{order.order_number} ({new Date(order.created_at!).toLocaleDateString()})
                                    </option>
                                ))}
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none mb-2">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                    </div>
                    <button onClick={handleSupportContact} className="mt-4 block w-full text-center bg-purple-600 text-white font-medium py-2.5 rounded-xl hover:bg-purple-700 transition-colors shadow-sm shadow-purple-200">
                        Contact Support
                    </button>
                </div>
            </div>

        </div>
    )
}
