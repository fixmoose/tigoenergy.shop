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
import { buildHreflangAlternates, buildCanonicalUrl } from '@/lib/utils/seo'

const inter = Inter({ subsets: ['latin'] })

export async function generateMetadata(): Promise<Metadata> {
  let marketKey = 'SHOP'
  try {
    const headersList = await headers()
    marketKey = headersList.get('x-market-key') || 'SHOP'
  } catch {
    // Static rendering fallback
  }
  const market = getMarketFromKey(marketKey)

  return {
    title: `Tigo Energy ${market.countryName} | Professional Solar Solutions`,
    description: 'Tigo Energy products across 21+ European markets. Optimizers, inverters, batteries and monitoring solutions.',
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
      title: `Tigo Energy ${market.countryName} | Professional Solar Solutions`,
      description: 'Tigo Energy products across 21+ European markets. Optimizers, inverters, batteries and monitoring solutions.',
      siteName: 'Tigo Energy',
      locale: market.locale,
      type: 'website',
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

  return (
    <html lang={htmlLang} suppressHydrationWarning>
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>
          <MarketProvider initialMarket={market} initialLanguage={htmlLang}>
            <CurrencyProvider>
              <CartProvider>
                <Header />
                <main>
                  {children}
                </main>
                <Footer />
              </CartProvider>
            </CurrencyProvider>
          </MarketProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
