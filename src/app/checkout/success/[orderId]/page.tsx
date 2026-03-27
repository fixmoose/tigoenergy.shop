'use client'

import React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

export default function OrderSuccessPage() {
    const params = useParams()
    const orderId = params.orderId
    const t = useTranslations('orderSuccess')

    return (
        <div className="min-h-screen bg-gray-50 flex items-start justify-center p-4 pt-20">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden text-center">

                {/* Header Graphic */}
                <div className="bg-amber-600 h-32 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute inset-0 bg-white/10 opacity-50 backdrop-blur-sm" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%)' }}></div>
                    <div className="relative z-10 w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg animate-bounce-short">
                        <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                </div>

                <div className="p-8 pb-12">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('title')}</h1>
                    <p className="text-gray-500 mb-6">
                        {t('subtitle')}
                    </p>

                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 mb-8">
                        <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">{t('orderNumber')}</div>
                        <div className="text-xl font-mono font-bold text-amber-700 select-all">{typeof orderId === 'string' ? orderId.substring(0, 8).toUpperCase() : orderId}</div>
                        <div className="text-[10px] text-gray-400 mt-1 font-mono">{orderId}</div>
                    </div>

                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                            {t('confirmationEmail')}<br />
                            {t('shippingNotice')}
                        </p>

                        <div className="pt-6 flex flex-col gap-3">
                            <Link
                                href="/products"
                                className="btn w-full bg-amber-600 hover:bg-amber-700 text-white font-bold border-none h-12 rounded-xl shadow-lg shadow-amber-200"
                            >
                                {t('continueShopping')}
                            </Link>
                            <Link
                                href="/dashboard#orders"
                                className="btn btn-ghost w-full text-gray-500 hover:text-gray-700 font-medium"
                            >
                                {t('viewOrders')}
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
