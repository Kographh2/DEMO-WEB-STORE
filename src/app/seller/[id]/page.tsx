'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Star, Heart, Share2, UserPlus, UserCheck, MapPin, Package, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/auth-provider'
import { formatCurrency } from '@/lib/utils'
import ProductCard from '@/components/product-card'
import toast from 'react-hot-toast'

export default function SellerProfilePage() {
  const params = useParams()
  const sellerId = params.id as string
  const router = useRouter()
  const { user } = useAuth()

  const [shop, setShop] = useState<any>(null)
  const [seller, setSeller] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])
  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)

  useEffect(() => {
    loadSellerProfile()
  }, [sellerId])

  const loadSellerProfile = async () => {
    try {
      // Load seller profile
      const { data: sellerData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', sellerId)
        .single()

      if (!sellerData) {
        router.push('/')
        return
      }

      setSeller(sellerData)

      // Load shop
      const { data: shopData } = await (supabase as any)
        .from('shops')
        .select('*')
        .eq('owner_id', sellerId)
        .single()

      if (shopData) {
        setShop(shopData)

        // Load products
        const { data: productsData } = await (supabase as any)
          .from('products')
          .select('*')
          .eq('shop_id', shopData.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })

        setProducts(productsData || [])
      }

      // Load follower count
      const { count } = await supabase
        .from('follows')
        .select('*', { count: 'exact' })
        .eq('following_id', sellerId)

      setFollowerCount(count || 0)

      // Check if current user is following
      if (user) {
        const { data: followData } = await supabase
          .from('follows')
          .select('*')
          .eq('follower_id', user.id)
          .eq('following_id', sellerId)
          .single()

        setIsFollowing(!!followData)
      }
    } catch (error) {
      console.error('Error loading seller profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFollowToggle = async () => {
    if (!user) {
      toast.error('Silakan login terlebih dahulu')
      return
    }

    setFollowLoading(true)
    try {
      if (isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', sellerId)

        if (error) throw error
        setIsFollowing(false)
        setFollowerCount(followerCount - 1)
        toast.success('Berhenti mengikuti seller')
      } else {
        // Follow
        const { error } = await (supabase as any)
          .from('follows')
          .insert({
            follower_id: user.id,
            following_id: sellerId,
          })

        if (error) throw error
        setIsFollowing(true)
        setFollowerCount(followerCount + 1)
        toast.success('Berhasil mengikuti seller')
      }
    } catch (error) {
      console.error('Follow error:', error)
      toast.error('Gagal mengubah status mengikuti')
    } finally {
      setFollowLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!shop || !seller) {
    return null
  }

  const isOwnShop = user?.id === sellerId

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-100">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{shop.name}</h1>
        </div>
      </div>

      {/* Banner and Profile */}
      <div className="bg-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-start gap-6">
            {/* Logo */}
            <div className="w-24 h-24 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center flex-shrink-0">
              {shop.logo_url ? (
                <img src={shop.logo_url} alt={shop.name} className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <Package size={40} className="text-white" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{shop.name}</h1>
                  <p className="text-gray-600 mb-4">{shop.description || 'Toko online terpercaya'}</p>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <Star size={18} className="text-yellow-400 fill-yellow-400" />
                      <span className="font-semibold">{shop.rating || 0}</span>
                    </div>
                    <div className="text-gray-600">
                      <span className="font-semibold">{shop.total_reviews || 0}</span> Ulasan
                    </div>
                    <div className="text-gray-600">
                      <span className="font-semibold">{shop.total_sold ?? 0}</span> Terjual
                    </div>
                    <div className="text-gray-600">
                      <span className="font-semibold">{followerCount}</span> Pengikut
                    </div>
                  </div>

                  {shop.is_verified && (
                    <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">
                      <CheckCircle2 size={16} />
                      Toko Terverifikasi
                    </div>
                  )}
                </div>

                {!isOwnShop && (
                  <button
                    onClick={handleFollowToggle}
                    disabled={followLoading}
                    className={`px-6 py-2 rounded-lg font-semibold flex items-center gap-2 transition-all ${
                      isFollowing
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-primary-600 text-white hover:bg-primary-700'
                    }`}
                  >
                    {isFollowing ? (
                      <>
                        <UserCheck size={18} />
                        Sedang Diikuti
                      </>
                    ) : (
                      <>
                        <UserPlus size={18} />
                        Ikuti
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Produk Toko <span className="text-gray-400 font-normal text-lg">({products.length})</span>
        </h2>
        {products.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">Belum ada produk</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CheckCircle({ size, className }: { size: number; className: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
  )
}
