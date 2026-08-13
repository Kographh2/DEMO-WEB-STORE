import { Metadata } from 'next'
import LegalPage from '@/components/legal-page'

export const metadata: Metadata = {
  title: 'Syarat dan Ketentuan - Kograph Store',
}

export default function Terms() {
  return <LegalPage type="terms" />
}
