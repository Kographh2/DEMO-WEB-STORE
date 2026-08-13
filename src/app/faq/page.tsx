import { Metadata } from 'next'
import LegalPage from '@/components/legal-page'

export const metadata: Metadata = {
  title: 'FAQ - Kograph Store',
}

export default function FAQ() {
  return <LegalPage type="faq" />
}
