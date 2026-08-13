import { Metadata } from 'next'
import LanguageSettings from '@/components/language-settings'

export const metadata: Metadata = {
  title: 'Pengaturan Bahasa - Kograph Store',
}

export const dynamic = 'force-dynamic'

export default function LanguageSettingsPage() {
  return <LanguageSettings />
}
