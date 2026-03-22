import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { headers } from 'next/headers'
import { getMarketFromKey } from '@/lib/constants/markets'
import { MarketProvider } from '@/contexts/MarketContext'
import { CartProvider } from '@/contexts/CartContext'
import { CurrencyProvider } from '@/contexts/CurrencyContext'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import MobileNav from '@/components/MobileNav'
import CookieConsent from '@/components/CookieConsent'
import { buildHreflangAlternates, buildCanonicalUrl, MARKET_DOMAINS } from '@/lib/utils/seo'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { SpeedInsights } from '@vercel/speed-insights/next'


export const dynamic = 'force-dynamic'

const inter = Inter({ subsets: ['latin'] })

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const marketKey = headersList.get('x-market-key') || 'SHOP'
  const market = getMarketFromKey(marketKey)
  const hostname = headersList.get('host') || 'tigoenergy.shop'
  const protocol = hostname.includes('localhost') ? 'http' : 'https'

  return {
    metadataBase: new URL(`${protocol}://${hostname}`),
    title: `Tigo Energy Shop ${market.countryName} | Authorized Distributor`,
    description: 'Authorized Tigo Energy distributor. Shop optimizers, inverters, batteries and monitoring solutions across 21+ European markets.',
    alternates: {
      canonical: buildCanonicalUrl(marketKey, '/'),
      languages: buildHreflangAlternates('/'),
    },
    icons: {
      icon: [
        { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
        { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
        { url: '/favicon.ico', sizes: 'any' },
      ],
      apple: [
        { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      ],
      other: [
        { rel: 'android-chrome-192x192', url: '/android-chrome-192x192.png' },
        { rel: 'android-chrome-512x512', url: '/android-chrome-512x512.png' },
      ],
    },
    manifest: '/site.webmanifest',
    openGraph: {
      title: `Tigo Energy Shop ${market.countryName} | Authorized Distributor`,
      description: 'Authorized Tigo Energy distributor. Shop optimizers, inverters, batteries and monitoring solutions across 21+ European markets.',
      siteName: 'Tigo Energy Shop',
      locale: market.locale,
      type: 'website',
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Tigo Energy Shop — Authorized Distributor' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Tigo Energy Shop ${market.countryName} | Authorized Distributor`,
      description: 'Authorized Tigo Energy distributor. Shop optimizers, inverters, batteries and monitoring solutions across 21+ European markets.',
      images: ['/og-image.png'],
    },
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const marketKey = headersList.get('x-market-key') || 'SHOP'
  const market = getMarketFromKey(marketKey)
  const messages = await getMessages()

  // Use preferred language if set (forwarded from cookie by middleware)
  const preferredLang = headersList.get('x-preferred-language')
  const htmlLang = (preferredLang && market.availableLanguages.includes(preferredLang))
    ? preferredLang
    : market.defaultLanguage

  const domain = MARKET_DOMAINS[marketKey] || 'tigoenergy.shop'
  const baseUrl = `https://${domain}`

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Tigo Energy Shop',
    url: baseUrl,
    legalName: 'Initra Energija d.o.o.',
    logo: `${baseUrl}/tigo-logo.png`,
    description: 'Authorized Tigo Energy distributor — solar optimizers, inverters, batteries and monitoring solutions across Europe.',
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@tigoenergy.shop',
      contactType: 'customer service',
      areaServed: market.country,
      availableLanguage: market.availableLanguages,
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Podsmreka 59A',
      addressLocality: 'Dobrova',
      postalCode: '1356',
      addressCountry: 'SI',
    },
  }

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: `Tigo Energy Shop ${market.countryName}`,
    url: baseUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${baseUrl}/products?search={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <html lang={htmlLang} suppressHydrationWarning>
      <body className={inter.className}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />
        <QueryProvider>
          <NextIntlClientProvider messages={messages}>
            <MarketProvider initialMarket={market} initialLanguage={htmlLang}>
              <CurrencyProvider>
                <CartProvider>
                  <div className="hidden lg:contents">
                    <Header />
                  </div>
                  <MobileNav />
                  <main className="lg:pt-0 pt-12">
                    {children}
                  </main>
                  <div className="hidden lg:contents">
                    <Footer />
                  </div>
                  <CookieConsent />
                  <SpeedInsights />
                </CartProvider>
              </CurrencyProvider>
            </MarketProvider>
          </NextIntlClientProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
