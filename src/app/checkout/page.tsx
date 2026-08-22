import { Metadata } from 'next'
import CheckoutPage from '@/components/checkout-page'

export const metadata: Metadata = {
  title: 'Checkout - Kograph Store',
  description: 'Selesaikan pembayaran Anda',
}

export default function Checkout() {
  return <CheckoutPage />
}
