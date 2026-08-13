'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import { Star, ShoppingCart } from 'lucide-react'
import { Product } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { useCart } from '@/components/cart-provider'

interface ProductCardProps {
  product: Product
  onClick?: () => void
}

export default function ProductCard({ product, onClick }: ProductCardProps) {
  const { addToCart } = useCart()
  const displayPrice = product.discount_price ?? product.price
  const hasDiscount = product.discount_price && product.discount_price < product.price

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation()
    addToCart({ productId: product.id })
  }

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="relative aspect-square bg-gray-100">
        {product.images?.[0] ? (
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            No Image
          </div>
        )}
        
        {hasDiscount && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-lg">
            -{product.discount_percentage}%
          </div>
        )}

        <button
          onClick={handleAddToCart}
          className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-sm hover:bg-white transition-colors opacity-0 group-hover:opacity-100"
        >
          <ShoppingCart size={18} className="text-primary-600" />
        </button>
      </div>

      <div className="p-3">
        <h3 className="font-medium text-gray-900 text-sm line-clamp-2 mb-1 min-h-[2.5rem]">
          {product.name}
        </h3>
        
        <div className="flex items-center gap-1 mb-2">
          <Star size={12} className="text-yellow-400 fill-yellow-400" />
          <span className="text-xs text-gray-600">
            {product.rating.toFixed(1)} ({product.total_reviews})
          </span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="font-bold text-gray-900 text-sm">
            {formatCurrency(displayPrice)}
          </span>
          {hasDiscount && (
            <span className="text-xs text-gray-400 line-through">
              {formatCurrency(product.price)}
            </span>
          )}
        </div>

        {product.stock <= 5 && product.stock > 0 && (
          <p className="text-xs text-orange-500 mt-1">Tersisa {product.stock}</p>
        )}
        {product.stock === 0 && (
          <p className="text-xs text-red-500 mt-1">Stok habis</p>
        )}
      </div>
    </motion.div>
  )
}
