'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { 
  Package, TrendingUp, DollarSign, Star, Plus, Settings, 
  BarChart3, Users, ShoppingBag, ArrowUpRight,
  Store, Edit, Trash2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/auth-provider'
import { Shop, Product, Order } from '@/types'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function SellerDashboard() {
  const [shop, setShop] = useState<Shop | null>(null)
  const [products, setProducts] = useState<(Product & { shop: Shop })[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    avgRating: 0,
  })
  const [loading, setLoading] = useState(true)
  const [showCreateShop, setShowCreateShop] = useState(false)
  const [shopName, setShopName] = useState('')
  const [shopDescription, setShopDescription] = useState('')
  const router = useRouter()
  const { user, profile } = useAuth()

  useEffect(() => {
    if (!user || !profile) {
      router.push('/')
      return
    }

    if (profile.role !== 'seller' && profile.role !== 'admin' && profile.role !== 'owner') {
      router.push('/')
      return
    }

    loadData()
  }, [user, profile, router])

  const loadData = async () => {
    try {
      const { data: shopData } = await (supabase as any)
        .from('shops')
        .select('*')
        .eq('owner_id', user!.id)
        .single()

      if (shopData) {
        setShop(shopData)

        const { data: productsData } = await (supabase as any)
          .from('products')
          .select('*')
          .eq('shop_id', shopData.id)
          .order('created_at', { ascending: false })

        setProducts((productsData as any[]) || [])

        const { data: ordersData } = await (supabase as any)
          .from('orders')
          .select('*')
          .eq('shop_id', shopData.id)
          .order('created_at', { ascending: false })
          .limit(10)

        setOrders(ordersData || [])

        setStats({
          totalProducts: (productsData as any[])?.length || 0,
          totalOrders: (ordersData as any[])?.length || 0,
          totalRevenue: (ordersData as any[])?.reduce((sum: number, order: any) => 
            sum + (order.status === 'delivered' ? order.total_amount : 0), 0) || 0,
          avgRating: (shopData as any).rating || 0,
        })
      }
    } catch (error) {
      console.error('Error loading seller data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data, error } = await (supabase as any)
        .from('shops')
        .insert({
          owner_id: user!.id,
          name: shopName,
          description: shopDescription,
        })
        .select()
        .single()

      if (error) throw error
      
      setShop(data)
      setShowCreateShop(false)
      setShopName('')
      setShopDescription('')
      toast.success('Toko berhasil dibuat!')
      loadData()
    } catch (error) {
      console.error('Error creating shop:', error)
      toast.error('Gagal membuat toko')
    } finally {
      setLoading(false)
    }
  }

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    try {
      const { error } = await (supabase as any)
        .from('orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', orderId)

      if (error) throw error

      setOrders((current) =>
        current.map((order) =>
          order.id === orderId ? { ...order, status } : order
        )
      )

      toast.success('Status pesanan berhasil diperbarui')
    } catch (error) {
      console.error('Update order status error:', error)
      toast.error('Gagal memperbarui status pesanan')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Belum Ada Toko</h2>
          <p className="text-gray-600 mb-6">Buat toko Anda untuk mulai berjualan di Kograph Store</p>
          <button
            onClick={() => setShowCreateShop(true)}
            className="btn-primary flex items-center gap-2 mx-auto"
          >
            <Plus size={18} /> Buat Toko
          </button>

          {showCreateShop && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-left"
            >
              <h3 className="font-bold text-gray-900 mb-4">Buat Toko Baru</h3>
              <form onSubmit={handleCreateShop} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Toko
                  </label>
                  <input
                    type="text"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    className="input-field"
                    placeholder="Nama toko Anda"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Deskripsi
                  </label>
                  <textarea
                    value={shopDescription}
                    onChange={(e) => setShopDescription(e.target.value)}
                    className="input-field"
                    rows={3}
                    placeholder="Deskripsi toko Anda"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateShop(false)}
                    className="btn-secondary flex-1"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary flex-1"
                  >
                    {loading ? 'Membuat...' : 'Buat Toko'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{shop.name}</h1>
            <p className="text-gray-600">Dashboard Seller</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => router.push('/settings')}
              className="p-2 rounded-full bg-white border border-gray-200 hover:bg-gray-50"
            >
              <Settings size={20} className="text-gray-600" />
            </button>
            <button 
              onClick={() => router.push('/product/create')}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={18} /> Tambah Produk
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Produk', value: stats.totalProducts, icon: Package, color: 'bg-blue-500' },
            { label: 'Pesanan', value: stats.totalOrders, icon: ShoppingBag, color: 'bg-green-500' },
            { label: 'Pendapatan', value: formatCurrency(stats.totalRevenue), icon: DollarSign, color: 'bg-yellow-500' },
            { label: 'Rating', value: stats.avgRating.toFixed(1), icon: Star, color: 'bg-purple-500' },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
            >
              <div className={`w-10 h-10 ${stat.color} rounded-xl flex items-center justify-center mb-3`}>
                <stat.icon size={20} className="text-white" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-600">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900">Pesanan Terbaru</h3>
            <button 
              onClick={() => router.push('/seller/orders')}
              className="text-sm text-primary-600 font-medium"
            >
              Lihat Semua
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="pb-3 font-medium">ID Pesanan</th>
                  <th className="pb-3 font-medium">Pelanggan</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Total</th>
                  <th className="pb-3 font-medium">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      Belum ada pesanan
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.id} className="border-b border-gray-50 last:border-0">
                      <td className="py-3 text-sm font-medium">{order.id.slice(0, 8)}</td>
                      <td className="py-3 text-sm text-gray-600">
                        {(order.shipping_address?.full_name || order.user_id.slice(0, 8) + '...')}
                      </td>
                      <td className="py-3">
                        <select
                          value={order.status}
                          onChange={(e) => updateOrderStatus(order.id, e.target.value as Order['status'])}
                          className="text-xs px-2 py-1 rounded-full border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="pending">Pending</option>
                          <option value="paid">Paid</option>
                          <option value="processing">Processing</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="py-3 text-sm font-medium">{formatCurrency(order.total_amount)}</td>
                      <td className="py-3 text-sm text-gray-600">
                        {new Date(order.created_at).toLocaleDateString('id-ID')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Products */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900">Produk Saya</h3>
            <button 
              onClick={() => router.push('/product/create')}
              className="text-sm text-primary-600 font-medium"
            >
              Lihat Semua
            </button>
          </div>
          {products.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">Belum ada produk</p>
              <button
                onClick={() => router.push('/product/create')}
                className="btn-primary"
              >
                Tambah Produk
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {products.slice(0, 5).map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative"
                >
                  <div 
                    className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => router.push(`/product/${product.id}`)}
                  >
                    <div className="aspect-square bg-gray-100 relative">
                      {product.images?.[0] && (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="font-medium text-gray-900 text-sm line-clamp-2 mb-1">
                        {product.name}
                      </h3>
                      <p className="font-bold text-gray-900 text-sm">
                        {formatCurrency(product.discount_price ?? product.price)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(`/product/${product.id}/edit`)
                    }}
                    className="absolute top-2 right-2 bg-white border border-gray-200 rounded-full p-2 shadow-sm hover:bg-gray-50"
                    aria-label={`Edit ${product.name}`}
                  >
                    <Edit size={14} className="text-gray-700" />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
