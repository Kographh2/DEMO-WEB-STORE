import { Metadata } from 'next'
import NotificationsPage from '@/components/notifications-page'

export const metadata: Metadata = {
  title: 'Notifikasi - Kograph Store',
}

export default function Notifications() {
  return <NotificationsPage />
}
