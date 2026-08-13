import { Metadata } from 'next'
import CartPage from '@/components/cart-page'

export const metadata: Metadata = {
  title: 'Keranjang Belanja - Kograph Store',
  description: 'Lihat keranjang belanja Anda',
}

export default function Cart() {
  return <CartPage />
}
