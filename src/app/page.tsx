import { Metadata } from 'next'
import HomePage from '@/components/home-page'

export const metadata: Metadata = {
  title: 'Kograph Store - Beranda',
  description: 'Selamat datang di Kograph Store, platform jual beli online minimalis',
}

export default function Home() {
  return <HomePage />
}
