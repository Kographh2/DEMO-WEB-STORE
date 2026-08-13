import { Metadata } from 'next'
import LegalPage from '@/components/legal-page'

export const metadata: Metadata = {
  title: 'Kebijakan Privasi - Kograph Store',
}

export default function PrivacyPolicy() {
  return <LegalPage type="privacy" />
}
