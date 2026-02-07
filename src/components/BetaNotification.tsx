'use client'

import React, { useState, useEffect } from 'react'

export default function BetaNotification() {
    const [isVisible, setIsVisible] = useState(false)
    const [shouldRender, setShouldRender] = useState(false)

    useEffect(() => {
        // Check if user has already dismissed the notification in this session
        const isDismissed = sessionStorage.getItem('tigo-beta-notif-dismissed')
        if (isDismissed) return

        const timer = setTimeout(() => {
            setShouldRender(true)
            // Small delay for the CSS transition to kick in
            setTimeout(() => setIsVisible(true), 10)
        }, 2000)

        return () => clearTimeout(timer)
    }, [])

    const handleDismiss = () => {
        setIsVisible(false)
        sessionStorage.setItem('tigo-beta-notif-dismissed', '1')
        // Wait for animation to finish before removing from DOM
        setTimeout(() => setShouldRender(false), 500)
    }

    if (!shouldRender) return null

    return (
        <div
            className={`fixed bottom-6 right-6 z-50 max-w-sm w-full bg-white rounded-2xl shadow-2xl border border-green-100 overflow-hidden transition-all duration-500 transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
                }`}
        >
            <div className="bg-green-600 px-4 py-2 flex justify-between items-center">
                <span className="text-white font-bold tracking-wide text-sm flex items-center gap-2">
                    <span className="bg-orange-500 text-[10px] px-1.5 py-0.5 rounded uppercase leading-none">Beta</span>
                    eStore BETA version
                </span>
                <button
                    onClick={handleDismiss}
                    className="text-white hover:text-green-200 transition-colors"
                    aria-label="Close notification"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <div className="p-5">
                <p className="text-gray-700 text-sm leading-relaxed mb-4">
                    We apologize for the delay, we are still testing out the shop. Estimated opening day is <strong>March 1st, 2026</strong>.
                </p>
                <p className="text-gray-600 text-[13px] leading-relaxed italic border-l-2 border-orange-400 pl-3">
                    You are free to open an account and shop around, but please note that pricing and conditions of the store may change at the official opening.
                </p>
                <div className="mt-4 flex justify-end">
                    <button
                        onClick={handleDismiss}
                        className="text-xs font-semibold text-green-600 hover:text-green-700 hover:underline"
                    >
                        I understand
                    </button>
                </div>
            </div>
        </div>
    )
}
