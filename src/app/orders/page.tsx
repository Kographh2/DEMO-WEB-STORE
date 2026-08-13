import { Metadata } from 'next'
import OrdersPage from '@/components/orders-page'

export const metadata: Metadata = {
  title: 'Pesanan Saya - Kograph Store',
}

export default function Orders() {
  return <OrdersPage />
}
