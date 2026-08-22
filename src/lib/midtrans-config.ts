/**
 * Centralized Midtrans configuration — single source of truth for
 * server key, API base URLs, and sandbox/production mode.
 *
 * ROOT CAUSE FIX (502 Bad Gateway on /api/payments/snap):
 * The code previously read `process.env.MIDTRANS_SANDBOX`, but the
 * actual environment variable configured on Vercel is
 * `MIDTRANS_IS_PRODUCTION` (inverted meaning, different name). Since
 * `MIDTRANS_SANDBOX` was always undefined, the code always resolved to
 * the PRODUCTION Midtrans API URL regardless of intent. If the server
 * key configured is a Sandbox key, Midtrans rejects the request against
 * the production endpoint (401), which the route then reported as a
 * generic 502.
 *
 * This module reads `MIDTRANS_IS_PRODUCTION` (the variable that's
 * actually set) as the canonical source, while still accepting the
 * older `MIDTRANS_SANDBOX` name for backward compatibility if someone
 * only has that one set. Defaults to sandbox (the safer choice) if
 * neither is present.
 */

function resolveIsProduction(): boolean {
  const isProductionFlag = process.env.MIDTRANS_IS_PRODUCTION
  if (isProductionFlag !== undefined) {
    return isProductionFlag.trim().toLowerCase() === 'true'
  }

  // Backward-compat: some earlier deployments used MIDTRANS_SANDBOX
  // instead (opposite meaning — sandbox=true means NOT production).
  const sandboxFlag = process.env.MIDTRANS_SANDBOX
  if (sandboxFlag !== undefined) {
    return sandboxFlag.trim().toLowerCase() !== 'true'
  }

  // Neither set — default to sandbox to avoid accidentally charging
  // real money against a misconfigured environment.
  return false
}

export const MIDTRANS_SERVER_KEY = (process.env.MIDTRANS_SERVER_KEY || '').trim()
export const MIDTRANS_CLIENT_KEY = (process.env.MIDTRANS_CLIENT_KEY || process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '').trim()
export const MIDTRANS_IS_PRODUCTION = resolveIsProduction()

export const MIDTRANS_SNAP_API_URL = MIDTRANS_IS_PRODUCTION
  ? 'https://app.midtrans.com/snap/v1'
  : 'https://app.sandbox.midtrans.com/snap/v1'

export const MIDTRANS_CORE_API_URL = MIDTRANS_IS_PRODUCTION
  ? 'https://api.midtrans.com/v2'
  : 'https://api.sandbox.midtrans.com/v2'

export const MIDTRANS_SNAP_JS_URL = MIDTRANS_IS_PRODUCTION
  ? 'https://app.midtrans.com/snap/snap.js'
  : 'https://app.sandbox.midtrans.com/snap/snap.js'

/**
 * Throws a descriptive error (never silently proceeds with an empty
 * key) if required server-side Midtrans config is missing. Callers
 * catch this and turn it into a clear 500 response with a stable
 * `code` field, instead of letting a raw fetch/auth failure surface as
 * an opaque 502 further down the line.
 */
export function assertMidtransServerConfig(): void {
  if (!MIDTRANS_SERVER_KEY) {
    throw new MidtransConfigError('MIDTRANS_SERVER_KEY is not set')
  }
}

export class MidtransConfigError extends Error {
  code = 'MIDTRANS_CONFIG_MISSING' as const
}

export function midtransAuthHeader(): string {
  return `Basic ${Buffer.from(`${MIDTRANS_SERVER_KEY}:`).toString('base64')}`
}
