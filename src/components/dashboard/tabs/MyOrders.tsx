'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Customer, Order } from '@/types/database'
import SavedCartsList from '@/components/cart/SavedCartsList'
import { useTranslations } from 'next-intl'

interface Props {
    user: User
    customer: Customer
}

export default function MyOrders({ user, customer }: Props) {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const t = useTranslations('dashboard')

    useEffect(() => {
        const fetchOrders = async () => {
            const supabase = createClient()
            const { data } = await supabase
                .from('orders')
                .select('*')
                .eq('customer_id', user.id)
                .order('created_at', { ascending: false })

            if (data) setOrders(data)
            setLoading(false)
        }
        fetchOrders()
    }, [user.id])

    const filtered = search.trim()
        ? orders.filter(o =>
            o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
            (o as any).po_number?.toLowerCase().includes(search.toLowerCase()) ||
            o.invoice_number?.toLowerCase().includes(search.toLowerCase())
          )
        : orders

    return (
        <>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 text-green-700 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                    </div>
                    <h3 className="font-bold text-lg text-gray-900">{t('orderHistory')}</h3>
                </div>
                {orders.length > 0 && (
                    <div className="relative w-full sm:w-64">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={t('searchOrders')}
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {loading ? (
                <div className="p-12 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
                    <p className="text-gray-400">{t('loadingOrders')}</p>
                </div>
            ) : filtered.length > 0 ? (
                <div className="divide-y divide-gray-50">
                    {filtered.map(order => (
                        <div key={order.id} className="p-6 hover:bg-gray-50 transition flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                            <div className="flex items-center gap-4">
                                <div className="bg-gray-100 p-3 rounded-xl">
                                    <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                </div>
                                <div>
                                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                                        <span className="font-bold text-lg text-gray-900">Order #{order.order_number}</span>
                                        {(order as any).po_number && (
                                            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded font-medium">
                                                P.O.: {(order as any).po_number}
                                            </span>
                                        )}
                                        <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${order.status === 'completed' || order.status === 'paid' || order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                                            order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                                'bg-blue-100 text-blue-700'
                                            }`}>{order.status || 'Pending'}</span>
                                        {(order.payment_status === 'unpaid' || order.payment_status === 'pending' || !order.payment_status) && order.status !== 'cancelled' && (
                                            <span className="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider bg-amber-100 text-amber-700 animate-pulse">
                                                {t('awaitingPayment')}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-500 font-medium">
                                        {t('placedOn', { date: new Date(order.created_at!).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) })}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-none pt-4 md:pt-0">
                                <div className="text-right">
                                    <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-0.5">{t('totalAmount')}</p>
                                    <p className="text-lg font-bold text-gray-900">{order.currency} {order.total.toFixed(2)}</p>
                                </div>
                                <Link
                                    href={`/orders/${order.id}`}
                                    className="bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-black transition-all shadow-sm hover:shadow-md"
                                >
                                    {t('viewDetails')}
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            ) : orders.length > 0 ? (
                <div className="p-12 text-center">
                    <p className="text-gray-500 font-medium">{t('noOrdersMatch')}</p>
                    <button onClick={() => setSearch('')} className="mt-2 text-sm text-green-600 hover:underline">{t('clearSearch')}</button>
                </div>
            ) : (
                <div className="p-20 text-center">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{t('noOrders')}</h3>
                    <p className="text-gray-500 mb-8 max-w-xs mx-auto">{t('noOrdersDesc')}</p>
                    <Link href="/products" className="inline-block bg-green-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-green-200 hover:bg-green-700 transition-all">
                        {t('startShopping')}
                    </Link>
                </div>
            )}
        </div>
        <SavedCartsList />
        </>
    )
}
