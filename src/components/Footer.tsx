'use client'
import { useState } from 'react'
import { PRODUCT_CATEGORIES } from '@/lib/constants/categories'
import { useTranslations } from 'next-intl'

import Link from 'next/link'

export default function Footer() {
  const [showDisclaimers, setShowDisclaimers] = useState(false)
  const t = useTranslations('footer')

  return (
    <footer className="bg-gray-900 text-gray-300">
      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Company Info */}
          <div className="lg:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <img
                src="/tigo-distributor-logo.png"
                alt="Tigo Distributor"
                className="h-16"
              />
            </Link>
            <p className="text-sm text-gray-400 mb-4">
              {t('companyDesc')}
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

          {/* Google Reviews */}
          <div>
            <h3 className="text-white font-semibold mb-6 flex items-center gap-2">
              <span className="text-[#4285F4]">G</span>oogle reviews
            </h3>
            <div className="space-y-4">
              <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50 transform transition hover:scale-[1.02]">
                <div className="flex text-yellow-500 mb-1">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-xs text-gray-300 italic">"Best prices on the market and extremely fast shipping. Highly recommend!"</p>
                <p className="text-[10px] text-gray-500 mt-2 font-medium">— Marco S., Solar Installer</p>
              </div>

              <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50 transform transition hover:scale-[1.02]">
                <div className="flex text-yellow-500 mb-1">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-xs text-gray-300 italic">"Excellent support team. They helped me with technical questions immediately. Will buy again!"</p>
                <p className="text-[10px] text-gray-500 mt-2 font-medium">— Elena P., Project Manager</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trust Bar */}
      <div className="border-t border-gray-800 bg-gray-900/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {/* Authorized Distributor */}
            <div className="flex flex-col items-center gap-1.5">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              <span className="text-xs text-gray-300 font-medium">{t('trustAuthorized')}</span>
            </div>
            {/* Secure Payments */}
            <div className="flex flex-col items-center gap-1.5">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              <span className="text-xs text-gray-300 font-medium">{t('trustSecurePayments')}</span>
            </div>
            {/* EU Consumer Rights */}
            <div className="flex flex-col items-center gap-1.5">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              <span className="text-xs text-gray-300 font-medium">{t('trustReturns')}</span>
            </div>
            {/* EU Shipping */}
            <div className="flex flex-col items-center gap-1.5">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="text-xs text-gray-300 font-medium">{t('trustEuShipping')}</span>
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
              <p>&copy; {new Date().getFullYear()} Tigo Energy Shop</p>
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
