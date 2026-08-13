import { Metadata } from 'next'
import OwnerDashboard from '@/components/owner-dashboard'

export const metadata: Metadata = {
  title: 'Dashboard Owner - Kograph Store',
}

export default function OwnerPage() {
  return <OwnerDashboard />
}
