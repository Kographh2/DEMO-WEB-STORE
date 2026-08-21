'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import { Star, ShoppingCart, Heart, Share2, Truck, Shield, ArrowLeft, Minus, Plus, Check, BadgeCheck, Store, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Product, Shop, Review } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { useCart } from '@/components/cart-provider'
import { useAuth } from '@/components/auth-provider'
import ProductCard from '@/components/product-card'
import AuthModal from '@/components/auth-modal'

export default function ProductDetailPage({ productId }: { productId: string }) {
  const [product, setProduct] = useState<(Product & { shop: Shop }) | null>(null)
  const [reviews, setReviews] = useState<(Review & { user: { full_name: string; avatar_url: string | null } })[]>([])
  const [relatedProducts, setRelatedProducts] = useState<(Product & { shop: Shop })[]>([])
  const [shopFollowerCount, setShopFollowerCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [quantity, setQuantity] = useState(1)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'description' | 'reviews'>('description')
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' })
  const [showReviewForm, setShowReviewForm] = useState(false)
  
  const router = useRouter()
  const { addToCart } = useCart()
  const { user } = useAuth()
  const isOwner = !!user && !!product && (product.shop as any).owner_id === user.id

  useEffect(() => {
    loadProduct()

    // Subscribe to real-time review updates
    const subscription = supabase
      .channel(`product:${productId}:reviews`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reviews',
          filter: `product_id=eq.${productId}`,
        },
        (payload) => {
          loadProduct()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [productId])

  const loadProduct = async () => {
    try {
      const { data: productData } = await supabase
        .from('products')
        .select(`
          *,
          shop:shops(*)
        `)
        .eq('id', productId)
        .single()

      if (productData) {
        setProduct(productData as Product & { shop: Shop })

        const shopOwnerId = (productData as any).shop?.owner_id
        if (shopOwnerId) {
          const { count } = await supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', shopOwnerId)
          setShopFollowerCount(count || 0)
        }
        
        const { data: reviewsData } = await supabase
          .from('reviews')
          .select(`
            *,
            user:profiles(full_name, avatar_url)
          `)
          .eq('product_id', productId)
          .order('created_at', { ascending: false })

        setReviews(reviewsData as any[])

        const { data: relatedData } = await (supabase as any)
          .from('products')
          .select(`
            *,
            shop:shops(*)
          `)
          .eq('shop_id', (productData as any).shop_id)
          .neq('id', productId)
          .eq('is_active', true)
          .limit(6)

        setRelatedProducts(relatedData as any[])
      }
    } catch (error) {
      console.error('Error loading product:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddToCart = () => {
    if (!user) {
      setShowAuthModal(true)
      return
    }
    addToCart({ productId: product!.id, quantity })
  }

  const handleBuyNow = () => {
    if (!user) {
      setShowAuthModal(true)
      return
    }
    addToCart({ productId: product!.id, quantity })
    router.push('/checkout')
  }

  const handleSubmitReview = async () => {
    if (!user || !product) return

    try {
      // Find a qualifying order for this exact product — the reviews
      // RLS policy only allows the insert at all if one exists (delivered
      // /paid/processing/shipped order containing this product), so if we
      // can find it here, this is a genuine verified purchase and we can
      // mark it as such instead of leaving is_verified/order_id empty.
      const { data: qualifyingOrderItem } = await (supabase as any)
        .from('order_items')
        .select('order_id, orders!inner(user_id, status)')
        .eq('product_id', product.id)
        .eq('orders.user_id', user.id)
        .in('orders.status', ['delivered', 'paid', 'processing', 'shipped'])
        .limit(1)
        .maybeSingle()

      const { error } = await (supabase as any).from('reviews').insert({
        product_id: product.id,
        user_id: user.id,
        rating: newReview.rating,
        comment: newReview.comment,
        order_id: qualifyingOrderItem?.order_id ?? null,
        is_verified: !!qualifyingOrderItem,
      })

      if (error) throw error

      setNewReview({ rating: 5, comment: '' })
      setShowReviewForm(false)
      loadProduct()
    } catch (error) {
      console.error('Error submitting review:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Produk tidak ditemukan</p>
      </div>
    )
  }

  const displayPrice = product.discount_price ?? product.price
  const hasDiscount = product.discount_price && product.discount_price < product.price

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center justify-between gap-2 mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <span className="text-sm text-gray-500">
              {product.shop.name} / {product.name}
            </span>
          </div>

          {isOwner && (
            <button
              onClick={() => router.push(`/product/${product.id}/edit`)}
              className="btn-secondary text-sm"
            >
              Edit Produk
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Product Image */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-3xl p-6 aspect-square relative"
          >
            {product.images?.[0] ? (
              <Image
                src={product.images[0]}
                alt={product.name}
                fill
                className="object-contain rounded-2xl"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                No Image
              </div>
            )}
            
            {hasDiscount && (
              <div className="absolute top-6 left-6 bg-red-500 text-white text-sm font-bold px-3 py-1.5 rounded-xl">
                -{product.discount_percentage}%
              </div>
            )}
          </motion.div>

          {/* Product Info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col"
          >
            <div className="mb-4">
              <button
                onClick={() => router.push(`/seller/${(product.shop as any).owner_id}`)}
                className="flex items-center gap-2 mb-2 group"
              >
                <span className="text-sm text-primary-600 font-medium group-hover:underline">
                  {product.shop.name}
                </span>
                {product.shop.is_verified && (
                  <span className="bg-primary-100 text-primary-700 text-xs px-2 py-0.5 rounded-full font-medium">
                    Terverifikasi
                  </span>
                )}
              </button>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h1>
              
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1">
                  <Star size={16} className="text-yellow-400 fill-yellow-400" />
                  <span className="font-medium">{product.rating.toFixed(1)}</span>
                  <span className="text-gray-500 text-sm">({product.total_reviews} ulasan)</span>
                </div>
                <span className="text-gray-400">|</span>
                <span className="text-sm text-gray-600">{product.total_sold} terjual</span>
              </div>
            </div>

            {/* Price */}
            <div className="bg-gray-50 rounded-2xl p-6 mb-6">
              <div className="flex items-baseline gap-3 mb-2">
                <span className="text-3xl font-bold text-gray-900">
                  {formatCurrency(displayPrice)}
                </span>
                {hasDiscount && (
                  <span className="text-lg text-gray-400 line-through">
                    {formatCurrency(product.price)}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Truck size={16} />
                <span>Ongkir mulai Rp 15.000</span>
              </div>
            </div>

            {/* Quantity */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Jumlah
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                >
                  <Minus size={16} />
                </button>
                <span className="w-12 text-center font-medium text-lg">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                  disabled={quantity >= product.stock}
                >
                  <Plus size={16} />
                </button>
                <span className="text-sm text-gray-500 ml-2">
                  {product.stock} tersedia
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-auto">
              <button
                onClick={handleAddToCart}
                className="flex-1 btn-secondary flex items-center justify-center gap-2"
              >
                <ShoppingCart size={18} />
                Tambah ke Keranjang
              </button>
              <button
                onClick={handleBuyNow}
                className="flex-1 btn-primary"
              >
                Beli Sekarang
              </button>
            </div>

            {/* Trust Badges */}
            <div className="flex items-center gap-6 mt-6 pt-6 border-t border-gray-100">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Shield size={16} className="text-primary-600" />
                <span>Jaminan Keaslian</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Truck size={16} className="text-primary-600" />
                <span>Pengiriman Aman</span>
              </div>
            </div>

            {/* Shop Summary — makes the seller checkable, not just a
                name: rating, sales, followers, and a direct link to
                their full profile with all their listed products. */}
            <button
              onClick={() => router.push(`/seller/${(product.shop as any).owner_id}`)}
              className="mt-4 flex items-center justify-between gap-3 bg-gray-50 hover:bg-gray-100 transition-colors rounded-2xl p-4 text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0">
                  {(product.shop as any).logo_url ? (
                    <img src={(product.shop as any).logo_url} alt={product.shop.name} className="w-full h-full object-cover rounded-xl" />
                  ) : (
                    <Store size={20} className="text-white" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-sm text-gray-900 truncate">{product.shop.name}</p>
                    {product.shop.is_verified && <BadgeCheck size={14} className="text-primary-600 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-gray-500">
                    ⭐ {product.shop.rating?.toFixed(1) ?? '0.0'} · {(product.shop as any).total_sold ?? 0} terjual · {shopFollowerCount} pengikut
                  </p>
                </div>
              </div>
              <span className="flex items-center gap-1 text-xs font-medium text-primary-600 flex-shrink-0">
                Kunjungi Toko <ChevronRight size={14} />
              </span>
            </button>
          </motion.div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-3xl p-6 mb-12">
          <div className="flex gap-6 border-b border-gray-100 mb-6">
            <button
              onClick={() => setActiveTab('description')}
              className={`pb-3 text-sm font-medium transition-colors relative ${
                activeTab === 'description' ? 'text-primary-600' : 'text-gray-500'
              }`}
            >
              Deskripsi
              {activeTab === 'description' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600"
                />
              )}
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`pb-3 text-sm font-medium transition-colors relative ${
                activeTab === 'reviews' ? 'text-primary-600' : 'text-gray-500'
              }`}
            >
              Ulasan ({reviews.length})
              {activeTab === 'reviews' && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600"
                />
              )}
            </button>
          </div>

          {activeTab === 'description' && (
            <div className="prose prose-sm max-w-none">
              <p className="text-gray-600 whitespace-pre-wrap">{product.description || 'Tidak ada deskripsi'}</p>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div>
              {user && (
                <div className="mb-6">
                  {!showReviewForm ? (
                    <button
                      onClick={() => setShowReviewForm(true)}
                      className="btn-primary"
                    >
                      Tulis Ulasan
                    </button>
                  ) : (
                    <div className="bg-gray-50 rounded-2xl p-4 mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm font-medium">Rating:</span>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => setNewReview(prev => ({ ...prev, rating: star }))}
                          >
                            <Star
                              size={20}
                              className={`${
                                star <= newReview.rating
                                  ? 'text-yellow-400 fill-yellow-400'
                                  : 'text-gray-300'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={newReview.comment}
                        onChange={(e) => setNewReview(prev => ({ ...prev, comment: e.target.value }))}
                        placeholder="Tulis ulasan Anda..."
                        className="input-field mb-3"
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSubmitReview}
                          className="btn-primary"
                        >
                          Kirim
                        </button>
                        <button
                          onClick={() => setShowReviewForm(false)}
                          className="btn-secondary"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-4">
                {reviews.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Belum ada ulasan</p>
                ) : (
                  reviews.map((review) => (
                    <div key={review.id} className="border-b border-gray-100 pb-4 last:border-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium text-sm flex-shrink-0">
                          {review.user.full_name?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">{review.user.full_name}</p>
                            {review.is_verified && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">
                                <BadgeCheck size={12} />
                                Pembeli Terverifikasi
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  size={12}
                                  className={i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
                                />
                              ))}
                            </div>
                            <span className="text-[11px] text-gray-400">
                              {new Date(review.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 ml-11">{review.comment}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Produk Lainnya</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {relatedProducts.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <ProductCard 
                    product={product} 
                    onClick={() => router.push(`/product/${product.id}`)}
                  />
                </motion.div>
              ))}
            </div>
          </section>
        )}
      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  )
}
