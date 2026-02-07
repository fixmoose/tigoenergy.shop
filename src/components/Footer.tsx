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

          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold mb-4">{t('contact')}</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <svg className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Podsmreka 59A<br />1356 Dobrova, Slovenia</span>
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <a href="mailto:support@tigoenergy.shop" className="hover:text-white transition">support@tigoenergy.shop</a>
              </li>
              <li className="flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <a href="tel:+38640123456" className="hover:text-white transition">+386 40 123 456</a>
              </li>
            </ul>
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
