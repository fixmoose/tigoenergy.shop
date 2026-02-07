'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/contexts/CartContext'
import { Order, OrderItem } from '@/types/database'
import ContactSupportModal from '@/components/orders/ContactSupportModal'

export default function OrderDetailsPage() {
    const params = useParams()
    const router = useRouter()
    const { addItem } = useCart()
    const orderId = params.id as string

    const [order, setOrder] = useState<Order | null>(null)
    const [items, setItems] = useState<OrderItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [buyAgainLoading, setBuyAgainLoading] = useState(false)
    const [cancelling, setCancelling] = useState(false)
    const [isHeaderSummaryVisible, setIsHeaderSummaryVisible] = useState(false)
    const [supportModal, setSupportModal] = useState<{ isOpen: boolean, type: 'shipping' | 'return' | 'general' }>({
        isOpen: false,
        type: 'general'
    })

    useEffect(() => {
        if (!orderId) return

        const fetchOrderDetails = async () => {
            const supabase = createClient()

            // 1. Fetch Order
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .select('*')
                .eq('id', orderId)
                .single()

            if (orderError) {
                console.error('Error fetching order:', orderError)
                setError('Order not found or you don\'t have permission to view it.')
                setLoading(false)
                return
            }

            setOrder(orderData)

            // 2. Fetch Items with Product info (for images)
            const { data: itemsData, error: itemsError } = await supabase
                .from('order_items')
                .select('*, products(images)')
                .eq('order_id', orderId)

            if (itemsError) {
                console.error('Error fetching order items:', itemsError)
            } else {
                setItems(itemsData || [])
            }

            setLoading(false)
        }

        fetchOrderDetails()
    }, [orderId])

    const handleBuyAgain = async () => {
        if (!items.length) return
        setBuyAgainLoading(true)
        try {
            for (const item of items) {
                const productImages = (item as any).products?.images
                const imageUrl = productImages && productImages.length > 0 ? productImages[0] : undefined

                await addItem({
                    product_id: item.product_id || '',
                    sku: item.sku || '',
                    name: item.product_name || 'Unknown Product',
                    quantity: item.quantity || 1,
                    unit_price: item.unit_price || 0,
                    total_price: item.total_price || 0,
                    image_url: imageUrl
                })
            }
            router.push('/cart')
        } catch (err) {
            console.error('Error in Buy Again:', err)
            alert('Failed to add items to cart. Please try again.')
        } finally {
            setBuyAgainLoading(false)
        }
    }

    const handleOrderSingleItem = async (item: OrderItem) => {
        try {
            const productImages = (item as any).products?.images
            const imageUrl = productImages && productImages.length > 0 ? productImages[0] : undefined

            await addItem({
                product_id: item.product_id || '',
                sku: item.sku || '',
                name: item.product_name || 'Unknown Product',
                quantity: 1,
                unit_price: item.unit_price || 0,
                total_price: item.unit_price || 0,
                image_url: imageUrl
            })
            router.push('/cart')
        } catch (err) {
            console.error('Error adding single item:', err)
            alert('Failed to add item to cart.')
        }
    }

    const handleCancelOrder = async () => {
        if (!order) return
        if (!confirm('Are you sure you want to cancel this order? This action cannot be undone.')) return

        setCancelling(true)
        const supabase = createClient()
        try {
            const { error: cancelError } = await supabase
                .from('orders')
                .update({ status: 'cancelled' })
                .eq('id', order.id)

            if (cancelError) throw cancelError

            setOrder({ ...order, status: 'cancelled' })
            alert('Order cancelled successfully.')
        } catch (err) {
            console.error('Error cancelling order:', err)
            alert('Failed to cancel order. Please contact support.')
        } finally {
            setCancelling(false)
        }
    }

    useEffect(() => {
        const handleScroll = () => {
            // Show sticky bar when user scrolls past the main order title (approx 200px)
            setIsHeaderSummaryVisible(window.scrollY > 150)
        }
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            </div>
        )
    }

    if (error || !order) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-4">Oops!</h1>
                    <p className="text-gray-500 mb-8">{error || 'We couldn\'t find that order.'}</p>
                    <Link href="/dashboard" className="btn w-full bg-gray-900 text-white font-bold h-12 rounded-xl">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        )
    }

    const shippingAddress = (order.shipping_address as any) || {}
    const billingAddress = (order.billing_address as any) || {}

    // Cancellation Logic (Pending orders only, no time window)
    const now = new Date()
    const isCancellable = order.status === 'pending' && !order.confirmed_at

    const isDelivered = order.status === 'delivered'

    // Return Eligibility (14 days from delivery, B2C only)
    const deliveredAt = order.delivered_at ? new Date(order.delivered_at) : (isDelivered ? new Date(order.updated_at || '') : null)
    const isWithinReturnWindow = deliveredAt ? (now.getTime() - deliveredAt.getTime()) <= (14 * 24 * 60 * 60 * 1000) : false
    const canReturn = !order.is_b2b && isDelivered && isWithinReturnWindow
    const isB2B = order.is_b2b

    const handleContactSupport = (type: 'shipping' | 'return' | 'general' = 'general') => {
        setSupportModal({ isOpen: true, type })
    }

    return (
        <div className="min-h-screen bg-gray-50 pt-10 pb-20">
            {/* Sticky Header Summary Bar */}
            <div className={`fixed top-[80px] left-0 right-0 bg-white border-b border-gray-200 shadow-lg z-40 transition-all duration-300 transform ${isHeaderSummaryVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="hidden sm:block">
                            <h2 className="text-sm font-black text-gray-900 truncate">Order #{order.order_number}</h2>
                            <p className="text-[10px] text-gray-500 font-medium">{new Date(order.created_at || '').toLocaleDateString()}</p>
                        </div>
                        <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest ${order.status === 'completed' || order.status === 'paid' || order.status === 'delivered' || order.confirmed_at ? 'bg-green-100 text-green-700' :
                            order.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                            {order.confirmed_at ? 'Confirmed' : (order.status || 'Pending')}
                        </span>
                    </div>

                    <div className="flex items-center gap-3 md:gap-8">
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Total</p>
                            <p className="text-lg font-black text-green-600 leading-none">{order.currency} {order.total.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    if (!isDelivered) {
                                        alert('Invoice will be available for download once the order is delivered.')
                                        return
                                    }
                                    window.location.href = `/api/orders/${order.id}/invoice`
                                }}
                                className={`p-2 rounded-lg transition ${isDelivered ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-gray-50 text-gray-300 cursor-not-allowed'}`}
                                title="Download Invoice"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            </button>
                            <button
                                onClick={handleBuyAgain}
                                disabled={buyAgainLoading}
                                className="px-4 py-2 bg-green-600 text-white text-xs font-black uppercase tracking-widest rounded-lg hover:bg-green-700 transition shadow-md shadow-green-100 disabled:opacity-50"
                            >
                                {buyAgainLoading ? '...' : 'Buy Again'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header Section */}
                <div className="mb-8">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                        <Link href="/dashboard" className="hover:text-green-600 transition-colors">Dashboard</Link>
                        <span>/</span>
                        <Link href="/dashboard#orders" className="hover:text-green-600 transition-colors">Orders</Link>
                        <span>/</span>
                        <span className="text-gray-900 font-medium">#{order.order_number}</span>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard" className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-400 hover:text-green-600 hover:border-green-200 transition shadow-sm group">
                                <svg className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                            </Link>
                            <h1 className="text-3xl font-black text-gray-900">Order #{order.order_number}</h1>
                        </div>
                    </div>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Left Column: Details */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Unified Action Card */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6 overflow-visible">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Order Status</span>
                                <div className="flex items-center gap-3 group/status relative">
                                    <span className={`text-sm px-4 py-1.5 rounded-full font-black uppercase tracking-widest cursor-help flex items-center gap-2 ${order.status === 'completed' || order.status === 'paid' || order.status === 'delivered' || order.confirmed_at ? 'bg-green-100 text-green-700' :
                                        order.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                        }`}>
                                        <div className={`w-2 h-2 rounded-full animate-pulse ${order.status === 'cancelled' ? 'bg-red-500' : 'bg-green-500'}`}></div>
                                        {order.confirmed_at ? 'Order Confirmed' : (order.status || 'Pending')}
                                    </span>
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full left-0 mb-3 px-4 py-3 bg-gray-900 text-white text-[11px] rounded-xl opacity-0 group-hover/status:opacity-100 transition-all duration-200 pointer-events-none z-50 shadow-2xl w-64 font-medium leading-relaxed scale-95 group-hover/status:scale-100 transform origin-bottom-left">
                                        <p className="font-bold text-white mb-1 border-b border-gray-700 pb-1">Status Information</p>
                                        {order.confirmed_at
                                            ? "Your order has been confirmed by our administrative team and is currently being processed for shipment."
                                            : order.status === 'pending'
                                                ? "Pending order confirmation. Our team will review your order shortly to confirm stock and shipping details."
                                                : `Current update: The order status is ${order.status}.`}
                                        <div className="absolute top-full left-6 -mt-1 border-8 border-transparent border-t-gray-900"></div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <button
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 shadow-sm ${isDelivered
                                        ? 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                                        : 'bg-gray-50 border border-gray-100 text-gray-300 cursor-not-allowed'
                                        }`}
                                    onClick={() => {
                                        if (!isDelivered) return
                                        window.location.href = `/api/orders/${order.id}/invoice`
                                    }}
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    Invoice
                                </button>
                                <div className="flex flex-col items-end gap-1">
                                    <div className="flex flex-wrap items-center gap-3">
                                        {isCancellable && (
                                            <button
                                                onClick={handleCancelOrder}
                                                disabled={cancelling}
                                                className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 hover:border-red-300 transition-all duration-200 shadow-sm disabled:opacity-50"
                                            >
                                                {cancelling ? (
                                                    <span className="animate-spin rounded-full h-3 w-3 border-2 border-red-600 border-t-transparent"></span>
                                                ) : (
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                )}
                                                Cancel Order
                                            </button>
                                        )}
                                        {isB2B ? (
                                            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-[10px] font-black text-red-700 uppercase tracking-tighter shadow-sm">
                                                <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m0 0v2m0-2h2m-2 0H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                B2B: Sales Final
                                            </div>
                                        ) : (
                                            <div className="relative group/return">
                                                {canReturn ? (
                                                    <Link
                                                        href={`/orders/${order.id}/return`}
                                                        className="flex items-center gap-2 px-4 py-2 bg-white border border-orange-200 rounded-xl text-xs font-bold text-orange-600 hover:bg-orange-50 hover:border-orange-300 transition-all duration-200 shadow-sm"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4 2 4-2 4 2z" /></svg>
                                                        Return Items
                                                    </Link>
                                                ) : (
                                                    <>
                                                        <button
                                                            disabled
                                                            className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-gray-300 cursor-not-allowed opacity-60 transition-all"
                                                        >
                                                            <svg className="w-4 h-4 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4 2 4-2 4 2z" /></svg>
                                                            Return Items
                                                        </button>
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-[10px] rounded-lg pointer-events-none opacity-0 group-hover/return:opacity-100 transition-all duration-200 whitespace-nowrap z-50 shadow-xl font-bold border border-gray-800">
                                                            {!isDelivered ? 'Not available until Delivered' : 'Return window expired'}
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                        <div className="relative group/buy">
                                            <button
                                                onClick={handleBuyAgain}
                                                disabled={buyAgainLoading}
                                                className="flex items-center gap-2 px-5 py-2 bg-green-600 rounded-xl text-xs font-bold text-white hover:bg-green-700 transition-all duration-200 shadow-md shadow-green-100 hover:shadow-green-200 disabled:opacity-50"
                                            >
                                                {buyAgainLoading ? (
                                                    <span className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></span>
                                                ) : (
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4h16l-1.5 9h-13L4 4zm4 15a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2z" /></svg>
                                                )}
                                                Buy Again
                                            </button>
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-[10px] rounded-lg pointer-events-none opacity-0 group-hover/buy:opacity-100 transition-all duration-200 whitespace-nowrap z-50 shadow-xl font-bold border border-gray-800">
                                                Reorder all items
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                                            </div>
                                        </div>
                                    </div>
                                    {canReturn && (
                                        <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-tight">
                                            Returns at customer expense • Original shipping non-refundable
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Order Status Stepper */}
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                            <div className="flex justify-between relative">
                                <div className="absolute top-4 left-0 w-full h-0.5 bg-gray-100 -z-10"></div>
                                <div className="flex flex-col items-center gap-2 bg-white px-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${order.status !== 'cancelled' ? 'bg-green-600 text-white shadow-md shadow-green-100' : 'bg-gray-200 text-gray-400'}`}>✓</div>
                                    <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Confirmed</span>
                                </div>
                                <div className="flex flex-col items-center gap-2 bg-white px-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${order.status === 'processing' || order.status === 'shipped' || order.status === 'completed' || order.status === 'delivered' ? 'bg-green-600 text-white shadow-md shadow-green-100' : 'bg-gray-100 text-gray-400'}`}>
                                        {['processing', 'shipped', 'completed', 'delivered'].includes(order.status || '') ? '✓' : '2'}
                                    </div>
                                    <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Processing</span>
                                </div>
                                <div className="flex flex-col items-center gap-2 bg-white px-2 text-center">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${order.status === 'shipped' || order.status === 'completed' || order.status === 'delivered' ? 'bg-green-600 text-white shadow-md shadow-green-100' : 'bg-gray-100 text-gray-400'}`}>
                                        {['shipped', 'completed', 'delivered'].includes(order.status || '') ? '✓' : '3'}
                                    </div>
                                    <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">In Transit</span>
                                </div>
                                <div className="flex flex-col items-center gap-2 bg-white px-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${order.status === 'delivered' || order.status === 'completed' ? 'bg-green-600 text-white shadow-md shadow-green-100' : 'bg-gray-100 text-gray-400'}`}>
                                        {order.status === 'delivered' || order.status === 'completed' ? '✓' : '4'}
                                    </div>
                                    <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Delivered</span>
                                </div>
                            </div>
                        </div>

                        {/* Addresses */}
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Shipping Address</h3>
                                <div className="space-y-1 text-gray-900 font-medium text-sm">
                                    <p className="font-black text-base mb-1">{shippingAddress.first_name} {shippingAddress.last_name}</p>
                                    <p>{shippingAddress.street}</p>
                                    <p>{shippingAddress.postal_code} {shippingAddress.city}</p>
                                    <p>{shippingAddress.country}</p>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Billing Address</h3>
                                <div className="space-y-1 text-gray-900 font-medium text-sm">
                                    <p className="font-black text-base mb-1">{billingAddress.first_name} {billingAddress.last_name}</p>
                                    <p>{billingAddress.street}</p>
                                    <p>{billingAddress.postal_code} {billingAddress.city}</p>
                                    <p>{billingAddress.country}</p>
                                </div>
                            </div>
                        </div>

                        {/* Items */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                                <h3 className="font-black text-gray-900 uppercase tracking-widest text-xs">Order Items ({items.length})</h3>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {items.map((item) => {
                                    const productImages = (item as any).products?.images
                                    const imageUrl = productImages && productImages.length > 0 ? productImages[0] : null

                                    return (
                                        <div key={item.id} className="p-6 flex items-center gap-6 group hover:bg-gray-50 transition">
                                            <div className="w-20 h-20 bg-gray-50 rounded-xl overflow-hidden shadow-sm flex-shrink-0 border border-gray-100">
                                                {imageUrl ? (
                                                    <img src={imageUrl} alt={item.product_name} className="w-full h-full object-contain p-2" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-gray-900 group-hover:text-green-600 transition truncate">{item.product_name}</h4>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{item.sku}</p>
                                                </div>
                                                <p className="text-sm text-gray-500">Qty: {item.quantity} × {order.currency} {item.unit_price.toFixed(2)}</p>

                                                {/* Individual Item Actions */}
                                                <button
                                                    onClick={() => handleOrderSingleItem(item)}
                                                    className="mt-3 text-[10px] font-black text-green-600 uppercase tracking-widest flex items-center gap-1 hover:text-green-700 transition"
                                                >
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                                    Order Again
                                                </button>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-gray-900">{order.currency} {item.total_price.toFixed(2)}</p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Summary */}
                    <div className="space-y-6">
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 sticky top-[140px] z-30">
                            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">Payment Summary</h3>
                            <div className="space-y-4">
                                <div className="flex justify-between text-gray-500 text-sm">
                                    <span>Subtotal (Net)</span>
                                    <span className="font-bold text-gray-900">{order.currency} {order.subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-gray-500 text-sm">
                                    <span>VAT ({((order.vat_rate || 0.19) * 100).toFixed(0)}%)</span>
                                    <span className="font-bold text-gray-900">{order.currency} {order.vat_amount.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-gray-500 text-sm">
                                    <span>Shipping ({order.shipping_carrier})</span>
                                    <span className="font-bold text-gray-900">{order.currency} {order.shipping_cost.toFixed(2)}</span>
                                </div>
                                <div className="pt-6 border-t border-gray-100 flex justify-between items-center bg-gray-50 -mx-8 px-8 py-5 mt-4">
                                    <span className="text-xs font-black text-gray-900 uppercase tracking-widest">Grand Total</span>
                                    <span className="text-3xl font-black text-green-600">{order.currency} {order.total.toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="mt-8 space-y-4">
                                <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100">
                                    <div className="flex items-center gap-3 mb-2">
                                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                                        <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Payment Details</span>
                                    </div>
                                    <p className="text-sm text-blue-700 font-black capitalize mb-1">{order.payment_method?.replace(/_/g, ' ')}</p>
                                    <p className="text-[10px] text-blue-500 uppercase tracking-widest">Status: <span className="font-black underline">{order.payment_status}</span></p>

                                    {order.payment_status === 'pending' && (order.payment_method === 'wise' || order.payment_method === 'invoice' || order.payment_method === 'iban' || order.payment_method === 'bank_transfer') && (
                                        <div className="mt-4 pt-4 border-t border-blue-100">
                                            <a
                                                href={`https://wise.com/pay/business/initraenergijadoo?utm_source=quick_pay&reference=${order.order_number}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-700 transition w-full"
                                            >
                                                <span>Pay Now with Wise</span>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                                </svg>
                                            </a>
                                            <p className="text-[9px] text-blue-400 mt-2 text-center leading-tight">
                                                Supports Card, ApplePay, and Wise BE Bank Transfer.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {order.tracking_number && (
                                    <div className="bg-green-50 p-5 rounded-2xl border border-green-100">
                                        <div className="flex items-center gap-3 mb-2">
                                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                            <span className="text-[10px] font-black text-green-800 uppercase tracking-widest">Tracking Info</span>
                                        </div>
                                        <p className="text-xs text-green-700 mb-1 font-bold">{order.shipping_carrier || 'Shipping Carrier'}</p>
                                        <a
                                            href={order.tracking_url || '#'}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm font-black text-green-600 hover:underline flex items-center gap-1"
                                        >
                                            {order.tracking_number}
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Quick Links */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                            <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Need Assistance?</h4>
                            <ul className="space-y-4">
                                <li>
                                    <button
                                        onClick={() => handleContactSupport('shipping')}
                                        className="text-sm font-bold text-gray-700 hover:text-green-600 transition flex items-center gap-3 group w-full text-left"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center group-hover:bg-green-50 transition">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        </div>
                                        Shipping Inquiry
                                    </button>
                                </li>
                                <li>
                                    <button
                                        onClick={() => handleContactSupport('return')}
                                        className="text-sm font-bold text-gray-700 hover:text-green-600 transition flex items-center gap-3 group w-full text-left"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center group-hover:bg-green-50 transition">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" /></svg>
                                        </div>
                                        Return Inquiry
                                    </button>
                                </li>
                                <li>
                                    <button
                                        onClick={() => handleContactSupport('general')}
                                        className="text-sm font-bold text-gray-700 hover:text-green-600 transition flex items-center gap-3 group w-full text-left"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center group-hover:bg-green-50 transition">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                        </div>
                                        Contact Support
                                    </button>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            <ContactSupportModal
                isOpen={supportModal.isOpen}
                onClose={() => setSupportModal(prev => ({ ...prev, isOpen: false }))}
                order={order}
                items={items}
                type={supportModal.type}
            />
        </div>
    )
}
