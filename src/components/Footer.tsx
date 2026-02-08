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
            <div className="flex gap-4">
              <a href="#" className="text-gray-400 hover:text-white transition" aria-label="LinkedIn">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition" aria-label="YouTube">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
                </svg>
              </a>
            </div>
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

      {/* Bottom Bar */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
            <div className="text-center text-gray-400 text-sm mb-4">
              <p>&copy; {new Date().getFullYear()} {t('operatedBy')}</p>
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
