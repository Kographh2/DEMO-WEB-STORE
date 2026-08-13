import { Metadata } from 'next'
import WishlistPage from '@/components/wishlist-page'

export const metadata: Metadata = {
  title: 'Wishlist - Kograph Store',
}

export default function Wishlist() {
  return <WishlistPage />
}
