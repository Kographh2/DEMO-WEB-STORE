import { NextResponse } from 'next/server'
import { MIDTRANS_CLIENT_KEY, MIDTRANS_IS_PRODUCTION, MIDTRANS_SNAP_JS_URL } from '@/lib/midtrans-config'

/**
 * Serves the Midtrans CLIENT key (never the server key) and the correct
 * Snap.js URL for the current environment (sandbox vs production) to
 * the browser.
 *
 * Why this exists instead of just using NEXT_PUBLIC_MIDTRANS_CLIENT_KEY
 * directly in the frontend: Next.js only inlines NEXT_PUBLIC_* variables
 * into the client bundle at BUILD time. If that exact variable name
 * isn't set wherever the app was built (only the server-only
 * `MIDTRANS_CLIENT_KEY` was), the browser gets an empty string with no
 * way to recover short of a full rebuild. Fetching it from this route
 * instead works immediately from whatever server-side env var is
 * actually configured, and updates the moment the env var changes on
 * Vercel — no rebuild required.
 *
 * This is safe to expose: the Midtrans Client Key is designed to be
 * public (it's meant to sit in browser-side <script> tags), unlike the
 * Server Key which must never leave the backend.
 */
export async function GET() {
  if (!MIDTRANS_CLIENT_KEY) {
    return NextResponse.json(
      { error: 'Midtrans client configuration is missing', code: 'MIDTRANS_CLIENT_CONFIG_MISSING' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    clientKey: MIDTRANS_CLIENT_KEY,
    isProduction: MIDTRANS_IS_PRODUCTION,
    snapJsUrl: MIDTRANS_SNAP_JS_URL,
  })
}
