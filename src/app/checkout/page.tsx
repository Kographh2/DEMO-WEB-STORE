import { Metadata } from 'next'
import { headers } from 'next/headers'
import CheckoutPage from '@/components/checkout-page'

export const metadata: Metadata = {
  title: 'Checkout - Kograph Store',
  description: 'Selesaikan pembayaran Anda',
}

export default function Checkout() {
  // Passed down so the dynamically-injected Midtrans snap.js <script>
  // tag can carry the same nonce the CSP header expects — see
  // src/middleware.ts for why this is needed instead of 'unsafe-inline'.
  const nonce = headers().get('x-nonce') ?? undefined
  return <CheckoutPage nonce={nonce} />
}
