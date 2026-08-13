import { Metadata } from 'next'
import CreateProductPage from '@/components/create-product-page'

export const metadata: Metadata = {
  title: 'Tambah Produk - Kograph Store',
}

export default function CreateProduct() {
  return <CreateProductPage />
}
