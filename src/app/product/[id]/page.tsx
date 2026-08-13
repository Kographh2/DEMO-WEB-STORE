import { Metadata } from 'next'
import ProductDetailPage from '@/components/product-detail-page'

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return {
    title: 'Detail Produk - Kograph Store',
    description: 'Lihat detail produk di Kograph Store',
  }
}

export default function ProductPage({ params }: PageProps) {
  return <ProductDetailPage productId={params.id} />
}
