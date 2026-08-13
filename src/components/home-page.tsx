'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, TrendingUp, Star, ChevronRight, ShoppingBag } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Product, Shop } from '@/types'
import { formatCurrency } from '@/lib/utils'
import ProductCard from '@/components/product-card'
import AuthModal from '@/components/auth-modal'
import { useAuth } from '@/components/auth-provider'

export default function HomePage() {
  const [products, setProducts] = useState<(Product & { shop: Shop })[]>([])
  const [loading, setLoading] = useState(true)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    try {
      const { data } = await supabase
        .from('products')
        .select(`
          *,
          shop:shops(*)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(20)
      
      setProducts(data as (Product & { shop: Shop })[])
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleProductClick = (productId: string) => {
    if (!user) {
      setShowAuthModal(true)
      return
    }
    router.push(`/product/${productId}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <section className="pt-8 pb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 text-balance">
              Selamat Datang di{' '}
              <span className="text-primary-600">Kograph Store</span>
            </h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Platform jual beli online dengan sistem toko yang terpercaya. Temukan produk terbaik dari seller terverifikasi.
            </p>
          </motion.div>

          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="max-w-2xl mx-auto mb-8"
          >
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Cari produk..."
                className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none transition-all bg-white shadow-sm"
              />
            </div>
          </motion.div>

          {/* Categories */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide"
          >
            {['Semua', 'Elektronik', 'Fashion', 'Kecantikan', 'Rumah Tangga', 'Olahraga', 'Makanan', 'Buku'].map((category, index) => (
              <button
                key={category}
                className={`flex-shrink-0 px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
                  index === 0
                    ? 'bg-primary-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-200 hover:border-primary-300'
                }`}
              >
                {category}
              </button>
            ))}
          </motion.div>
        </section>

        {/* Featured Products */}
        <section className="pb-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="text-primary-600" size={24} />
              <h2 className="text-xl font-bold text-gray-900">Produk Unggulan</h2>
            </div>
            <button className="flex items-center text-sm text-primary-600 font-medium hover:text-primary-700">
              Lihat Semua <ChevronRight size={16} />
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                  <div className="w-full aspect-square bg-gray-200 rounded-xl mb-3" />
                  <div className="h-4 bg-gray-200 rounded mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {products.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <ProductCard 
                    product={product} 
                    onClick={() => handleProductClick(product.id)}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Promo Banner */}
        <section className="pb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-3xl p-8 text-white relative overflow-hidden"
          >
            <div className="relative z-10">
              <h3 className="text-2xl font-bold mb-2">Diskon Spesial!</h3>
              <p className="text-primary-100 mb-4">Dapatkan diskon hingga 50% untuk produk pilihan</p>
              <button className="bg-white text-primary-600 px-6 py-3 rounded-xl font-semibold hover:bg-gray-100 transition-colors">
                Belanja Sekarang
              </button>
            </div>
            <ShoppingBag className="absolute right-8 top-1/2 -translate-y-1/2 w-32 h-32 text-white/10" />
          </motion.div>
        </section>
      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  )
}
