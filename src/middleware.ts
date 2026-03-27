import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getMarketKeyFromHostname } from '@/lib/constants/markets'
import { seoMiddleware } from '@/lib/utils/seo-middleware'

const REDIRECT_DOMAINS = new Set([
  'tigoenergy.be',
  'tigoenergy.ch',
  'tigoenergy.dk',
  'tigoenergy.se',
  'tigoenergy.pl',
  'tigoenergy.fr',
  'tigoenergy.es',
  'tigoenergy.ro',
  'tigoenergy.rs',
  'tigoenergy.mk',
  'tigoenergy.me',
  'tigoenergy.uk',
])

export function middleware(request: NextRequest) {
  const { cookies, nextUrl } = request

  // 0. Redirect inactive country domains to tigoenergy.com
  const rawHost = request.headers.get('host')?.replace(/:\d+$/, '') ?? ''
  const hostname = rawHost.replace(/^www\./, '')
  if (REDIRECT_DOMAINS.has(hostname)) {
    return NextResponse.redirect(
      `https://www.tigoenergy.com${nextUrl.pathname}${nextUrl.search}`,
      301
    )
  }

  // 1. Run SEO and Market detection middleware
  const response = seoMiddleware(request)

  // If seoMiddleware returned a redirect, return it immediately
  if (response.status >= 300 && response.status < 400) {
    return response
  }

  // 2. Admin route protection
  if (nextUrl.pathname.startsWith('/admin')) {
    const whitelist = ['/admin/sign-in', '/api/admin/create-user', '/api/admin/session']
    if (whitelist.some((p) => nextUrl.pathname.startsWith(p))) {
      return response
    }

    const isAdmin = cookies.get('tigo-admin')?.value === '1'
    if (!isAdmin) {
      const signInUrl = new URL('/admin/sign-in', request.url)
      signInUrl.searchParams.set('from', nextUrl.pathname)
      const redirectResponse = NextResponse.redirect(signInUrl)
      // Keep market headers even on redirect
      const marketKey = response.headers.get('x-market-key') || 'SHOP'
      redirectResponse.headers.set('x-market-key', marketKey)
      return redirectResponse
    }
  }

  return response
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
}
