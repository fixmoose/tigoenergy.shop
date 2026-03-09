'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

type ConsentState = {
    essential: true
    analytics: boolean
    marketing: boolean
}

const CONSENT_COOKIE = 'tigo_consent'
const CONSENT_DURATION_DAYS = 365

function readConsent(): ConsentState | null {
    if (typeof document === 'undefined') return null
    const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`))
    if (!match) return null
    try {
        return JSON.parse(decodeURIComponent(match[1]))
    } catch {
        return null
    }
}

function writeConsent(consent: ConsentState) {
    const expires = new Date()
    expires.setDate(expires.getDate() + CONSENT_DURATION_DAYS)
    document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(consent))}; expires=${expires.toUTCString()}; path=/; SameSite=Lax; Secure`
}

export default function CookieConsent() {
    const t = useTranslations('cookieConsent')
    const [visible, setVisible] = useState(false)
    const [expanded, setExpanded] = useState(false)
    const [prefs, setPrefs] = useState({ analytics: false, marketing: false })

    useEffect(() => {
        const existing = readConsent()
        if (!existing) setVisible(true)
    }, [])

    if (!visible) return null

    function accept(analytics: boolean, marketing: boolean) {
        writeConsent({ essential: true, analytics, marketing })
        setVisible(false)
    }

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 sm:p-6">
            <div className="max-w-4xl mx-auto bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
                <div className="p-5 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 mb-1">{t('title')}</p>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                {t('description')}{' '}
                                <Link href="/cookies" className="underline hover:text-gray-700">{t('cookiePolicy')}</Link>
                                {' '}{t('and')}{' '}
                                <Link href="/privacy" className="underline hover:text-gray-700">{t('privacyPolicy')}</Link>.
                            </p>

                            {expanded && (
                                <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                                    {/* Essential — always on */}
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-xs font-bold text-gray-900">{t('essentialTitle')}</p>
                                            <p className="text-[11px] text-gray-500 mt-0.5">{t('essentialDesc')}</p>
                                        </div>
                                        <span className="flex-shrink-0 text-[10px] font-black text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full uppercase tracking-wide mt-0.5">{t('alwaysOn')}</span>
                                    </div>

                                    {/* Analytics */}
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-xs font-bold text-gray-900">{t('analyticsTitle')}</p>
                                            <p className="text-[11px] text-gray-500 mt-0.5">{t('analyticsDesc')}</p>
                                        </div>
                                        <button
                                            onClick={() => setPrefs(p => ({ ...p, analytics: !p.analytics }))}
                                            className={`flex-shrink-0 mt-0.5 w-10 h-5 rounded-full transition-colors relative ${prefs.analytics ? 'bg-blue-600' : 'bg-gray-300'}`}
                                            aria-label="Toggle analytics"
                                        >
                                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${prefs.analytics ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                        </button>
                                    </div>

                                    {/* Marketing */}
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-xs font-bold text-gray-900">{t('marketingTitle')}</p>
                                            <p className="text-[11px] text-gray-500 mt-0.5">{t('marketingDesc')}</p>
                                        </div>
                                        <button
                                            onClick={() => setPrefs(p => ({ ...p, marketing: !p.marketing }))}
                                            className={`flex-shrink-0 mt-0.5 w-10 h-5 rounded-full transition-colors relative ${prefs.marketing ? 'bg-blue-600' : 'bg-gray-300'}`}
                                            aria-label="Toggle marketing"
                                        >
                                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${prefs.marketing ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-shrink-0 sm:min-w-[180px]">
                            <button
                                onClick={() => accept(true, true)}
                                className="w-full px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black transition"
                            >
                                {t('acceptAll')}
                            </button>
                            {expanded ? (
                                <button
                                    onClick={() => accept(prefs.analytics, prefs.marketing)}
                                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition"
                                >
                                    {t('savePreferences')}
                                </button>
                            ) : (
                                <button
                                    onClick={() => accept(false, false)}
                                    className="w-full px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 transition"
                                >
                                    {t('essentialOnly')}
                                </button>
                            )}
                            <button
                                onClick={() => setExpanded(e => !e)}
                                className="w-full px-4 py-2 text-gray-400 rounded-xl text-xs hover:text-gray-600 transition text-center"
                            >
                                {expanded ? t('hidePreferences') : t('managePreferences')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
