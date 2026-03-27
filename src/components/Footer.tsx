'use client'
import { useState } from 'react'
import { PRODUCT_CATEGORIES } from '@/lib/constants/categories'
import { useTranslations } from 'next-intl'

import Link from 'next/link'
import { useMarket } from '@/contexts/MarketContext'

const DACH_MARKETS = ['DE', 'AT', 'CH']

export default function Footer() {
  const [showDisclaimers, setShowDisclaimers] = useState(false)
  const t = useTranslations('footer')
  const { market } = useMarket()
  const isDACH = DACH_MARKETS.includes(market.key)

  return (
    <footer className="bg-gray-900 text-gray-300">
      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Company Info */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-3 mb-4">
              <img
                src="/tigo-distributor-logo.png"
                alt="Initra Energija — Tigo Products"
                className="h-16"
              />
            </Link>
            <p className="text-sm text-gray-400 mb-3">
              {t('companyDesc')}
            </p>
            <p className="text-[10px] text-gray-500 leading-relaxed border-t border-gray-800 pt-3">
              {t('independentDisclaimer')}
            </p>
          </div>

          {/* Products */}
          <div>
            <h3 className="text-white font-semibold mb-4">{t('products')}</h3>
            <ul className="space-y-2 text-sm">
              {Object.entries(PRODUCT_CATEGORIES).map(([label, info]) => (
                <li key={info.slug}>
                  <Link href={`/products?category=${info.slug}`} className="hover:text-white transition">{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-white font-semibold mb-4">{t('support')}</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/contact" className="hover:text-white transition">{t('contactUs')}</Link></li>
              <li><Link href="/shipping" className="hover:text-white transition">{t('shippingInfo')}</Link></li>
              <li><Link href="/returns" className="hover:text-white transition">{t('returnsWarranty')}</Link></li>
              <li><Link href="/faq" className="hover:text-white transition">{t('faq')}</Link></li>
              <li><a href="https://www.tigoenergy.com" target="_blank" rel="noopener" className="hover:text-white transition">{t('tigoGlobal')}</a></li>
            </ul>
          </div>

          {/* Trustpilot + Shopauskunft */}
          <div className="space-y-4">
            <a href="https://www.trustpilot.com/review/tigoenergy.shop" target="_blank" rel="noopener noreferrer" className="block hover:opacity-90 transition">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" fill="#00B67A"/>
                </svg>
                Trustpilot
              </h3>
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="w-5 h-5 bg-[#00B67A] flex items-center justify-center">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="white">
                          <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                        </svg>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-400">{t('trustpilotCta')}</p>
              </div>
            </a>
            {isDACH && (
              <a href="https://www.shopauskunft.de/review/tigoenergy.de" target="_blank" rel="noopener noreferrer" className="block hover:opacity-90 transition">
                <img
                  src="https://assets.shopauskunft.de/tigo-energy-shop/seal_listed_c3fbd4b2-8c83-4cce-b19f-679edbef947c.png"
                  alt="Initra Energija ist gelistet bei ShopAuskunft.de"
                  title="Initra Energija bei Shopauskunft.de"
                  className="h-16 mx-auto"
                />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Trust Bar */}
      <div className="border-t border-gray-800 bg-gray-900/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {/* Authorized Distributor */}
            <div className="flex flex-col items-center gap-1.5">
              <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              <span className="text-xs text-gray-300 font-medium">{t('trustAuthorized')}<sup className="text-gray-500 ml-0.5">2</sup></span>
            </div>
            {/* Secure Payments */}
            <div className="flex flex-col items-center gap-1.5">
              <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              <span className="text-xs text-gray-300 font-medium">{t('trustSecurePayments')}</span>
            </div>
            {/* EU Consumer Rights */}
            <div className="flex flex-col items-center gap-1.5">
              <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              <span className="text-xs text-gray-300 font-medium">{t('trustReturns')}<sup className="text-gray-500 ml-0.5">3</sup></span>
            </div>
            {/* EU Shipping */}
            <div className="flex flex-col items-center gap-1.5">
              <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="text-xs text-gray-300 font-medium">{t('trustEuShipping')}<sup className="text-gray-500 ml-0.5">1</sup></span>
            </div>
          </div>

          {/* Company details */}
          <div className="mt-5 pt-4 border-t border-gray-800 text-center text-xs text-gray-500 space-y-1">
            <p className="font-medium text-gray-400">Initra Energija d.o.o. · Podsmreka 59A, 1356 Dobrova, Slovenia</p>
            <p>VAT: SI62518313 · Reg. No: 9537368000</p>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
            <div className="text-center text-gray-400 text-sm mb-4">
              <p>&copy; {new Date().getFullYear()} Initra Energija d.o.o. — Authorized Tigo Energy Reseller</p>
            </div>
            <div className="flex flex-wrap justify-center gap-4 text-gray-400 items-center">
              <Link href="/impressum" className="hover:text-white transition">{t('impressum')}</Link>
              <Link href="/privacy" className="hover:text-white transition">{t('privacyPolicy')}</Link>
              <Link href="/terms" className="hover:text-white transition">{t('termsOfService')}</Link>
              <Link href="/cookies" className="hover:text-white transition">{t('cookiePolicy')}</Link>
              <button
                onClick={() => setShowDisclaimers(!showDisclaimers)}
                className={`hover:text-white transition ${showDisclaimers ? 'text-white font-medium' : ''}`}
              >
                {t('disclaimers')} {showDisclaimers ? '\u25B2' : '\u25BC'}
              </button>
            </div>
          </div>

          {/* Conditional Disclaimers */}
          {showDisclaimers && (
            <div className="mt-8 pt-6 border-t border-gray-800 text-xs text-gray-500 space-y-2 transition-all duration-300">
              <p><sup className="mr-1">1</sup>{t('disclaimer1')}</p>
              <p><sup className="mr-1">2</sup>{t('disclaimer2')}</p>
              <p><sup className="mr-1">3</sup>{t('disclaimer3')}</p>
            </div>
          )}

          <div className="mt-4 text-center text-gray-700 text-xs">
            Design by: &copy; {new Date().getFullYear()} ChristenFürEuropa. All rights reserved.
          </div>
        </div>
      </div>
    </footer >
  )
}
