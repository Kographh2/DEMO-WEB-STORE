import { Metadata } from 'next'
import LegalPage from '@/components/legal-page'

export const metadata: Metadata = {
  title: 'Ketentuan Undang-Undang - Kograph Store',
}

export default function Law() {
  return <LegalPage type="law" />
}
