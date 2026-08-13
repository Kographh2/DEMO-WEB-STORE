import { Metadata } from 'next'
import SellerDashboard from '@/components/seller-dashboard'

export const metadata: Metadata = {
  title: 'Dashboard Seller - Kograph Store',
}

export default function SellerPage() {
  return <SellerDashboard />
}
