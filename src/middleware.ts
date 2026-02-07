import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getMarketKeyFromHostname } from '@/lib/constants/markets'

export function middleware(request: NextRequest) {
  const { cookies, nextUrl } = request

  // --- Market detection (all routes) ---
  const hostname = request.headers.get('host') || 'localhost'
  const marketKey = getMarketKeyFromHostname(hostname)

  // Clone the request headers and set market key + preferred language
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-market-key', marketKey)

  // Forward user's language preference cookie as a header for server components
  const preferredLang = cookies.get('preferred_language')?.value
  if (preferredLang) {
    requestHeaders.set('x-preferred-language', preferredLang)
  }

  // Create response with the market header
  let response: NextResponse

  // --- Admin route protection ---
  if (nextUrl.pathname.startsWith('/admin')) {
    const whitelist = ['/admin/sign-in', '/api/admin/create-user', '/api/admin/session']
    if (whitelist.some((p) => nextUrl.pathname.startsWith(p))) {
      response = NextResponse.next({
        request: { headers: requestHeaders },
      })
      response.headers.set('x-market-key', marketKey)
      return response
    }

    const isAdmin = cookies.get('tigo-admin')?.value === '1'
    if (!isAdmin) {
      const signInUrl = new URL('/admin/sign-in', request.url)
      signInUrl.searchParams.set('from', nextUrl.pathname)
      response = NextResponse.redirect(signInUrl)
      response.headers.set('x-market-key', marketKey)
      return response
    }
  }

  // --- Default: pass through with market header ---
  response = NextResponse.next({
    request: { headers: requestHeaders },
  })
  response.headers.set('x-market-key', marketKey)
  return response
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
}
