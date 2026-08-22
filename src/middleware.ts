import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Generates a per-request CSP nonce and sets a Content-Security-Policy
 * header that allows the Midtrans Snap SDK to run.
 *
 * Why 'strict-dynamic' instead of listing every third-party domain by
 * hand: Snap.js dynamically injects further scripts and inline code of
 * its own (Google Pay, GoPay/Alicdn CDN helpers, Google Tag Manager —
 * all seen in the reported console errors). A nonce is placed only on
 * OUR <script> tag that loads snap.js; 'strict-dynamic' then tells the
 * browser to trust anything THAT script goes on to load, without us
 * having to enumerate every domain Midtrans might use internally (and
 * without resorting to 'unsafe-inline', which would trust ANY inline
 * script on the page, not just ones legitimately loaded by our
 * nonce'd payment script).
 *
 * connect-src / frame-src are NOT covered by strict-dynamic, so
 * Midtrans's own API + iframe domains are explicitly allowlisted there.
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https:;
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https:;
    font-src 'self' data:;
    connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.sandbox.midtrans.com https://api.midtrans.com https://app.sandbox.midtrans.com https://app.midtrans.com;
    frame-src 'self' https://app.sandbox.midtrans.com https://app.midtrans.com https://pay.google.com https://*.gojek.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'self';
  `
    .replace(/\s{2,}/g, ' ')
    .trim()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', cspHeader)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })
  response.headers.set('Content-Security-Policy', cspHeader)
  return response
}

export const config = {
  matcher: [
    // Apply to all routes except static assets and API routes (API
    // responses are JSON, not HTML, so a script-src CSP is irrelevant
    // there and just adds noise to every response).
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
