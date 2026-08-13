import { Metadata } from 'next'
import HelpPage from '@/components/help-page'

export const metadata: Metadata = {
  title: 'Bantuan - Kograph Store',
}

export default function Help() {
  return <HelpPage />
}
