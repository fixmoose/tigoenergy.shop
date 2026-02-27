'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

export default function ImpressumPage() {
    const t = useTranslations('staticPages.impressum')
    const [emailRevealed, setEmailRevealed] = useState(false)
    const email = "support@tigoenergy.shop"

    return (
        <div className="min-h-screen bg-gray-50 py-12">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white rounded-lg shadow-sm p-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-8">{t('title')}</h1>

                    {/* Company Information */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('hCompany')}</h2>
                        <div className="space-y-2 text-gray-700">
                            <p className="font-medium text-lg">{t('companyName')}</p>
                            <p>{t('vat')}</p>
                            <p>{t('registration')}</p>
                        </div>
                    </section>

                    {/* Contact Information */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('hContact')}</h2>
                        <div className="space-y-2 text-gray-700">
                            <div className="flex items-center gap-2">
                                <span>{t('emailLabel')}</span>
                                {emailRevealed ? (
                                    <a href={`mailto:${email}`} className="text-green-600 hover:text-green-700 font-medium">
                                        {email}
                                    </a>
                                ) : (
                                    <button
                                        onClick={() => setEmailRevealed(true)}
                                        className="text-green-600 hover:text-green-700 font-medium filter blur-[4px] select-none cursor-pointer transition-all hover:blur-none"
                                        title={t('clickToReveal')}
                                    >
                                        {email}
                                        <span className="ml-2 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded opacity-0 transition-opacity group-hover:opacity-100 italic">
                                            {t('clickToReveal')}
                                        </span>
                                    </button>
                                )}
                            </div>
                            <p>Website: <a href="https://tigoenergy.shop" className="text-green-600 hover:text-green-700">tigoenergy.shop</a></p>
                        </div>
                    </section>

                    {/* Authorization */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('hAuthorized')}</h2>
                        <div className="space-y-4 text-gray-700">
                            <p>
                                {t('pAuthorized1')}
                            </p>
                        </div>
                    </section>

                    {/* Responsible for Content */}
                    <section className="mb-8">
                        <h2 className="text-2xl font-semibold text-gray-900 mb-4">{t('hResponsible')}</h2>
                        <p className="text-gray-700">
                            {t('pResponsible')}
                        </p>
                    </section>
                </div>
            </div>
        </div>
    )
}
