import { Metadata } from 'next'
import SettingsPage from '@/components/settings-page'

export const metadata: Metadata = {
  title: 'Pengaturan - Kograph Store',
}

export const dynamic = 'force-dynamic'

export default function Settings() {
  return <SettingsPage />
}
