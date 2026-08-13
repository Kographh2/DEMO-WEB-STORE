import { Metadata } from 'next'
import SearchPage from '@/components/search-page'

export const metadata: Metadata = {
  title: 'Cari Produk - Kograph Store',
}

export default function Search() {
  return <SearchPage />
}
