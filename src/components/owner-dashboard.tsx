'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { 
  Users, DollarSign, TrendingUp, ShoppingBag, Shield, 
  Plus, Settings, BarChart3, AlertTriangle, Store, Package,
  Edit, Trash2, Check, X, Mail
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/auth-provider'
import { Profile, Withdrawal, Shop } from '@/types'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function OwnerDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalSellers: 0,
    totalShops: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    pendingWithdrawals: 0,
  })
  const [users, setUsers] = useState<Profile[]>([])
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'shops' | 'withdrawals' | 'broadcast'>('overview')
  const [broadcast, setBroadcast] = useState({ subject: '', body: '' })
  const [sendingBroadcast, setSendingBroadcast] = useState(false)
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [verifyingShopId, setVerifyingShopId] = useState<string | null>(null)
  const router = useRouter()
  const { user, profile } = useAuth()

  useEffect(() => {
    if (!user || !profile || (profile.role !== 'owner' && profile.role !== 'admin')) {
      router.push('/')
      return
    }
    loadData()
  }, [user, profile, router])

  const loadData = async () => {
    try {
      const [usersRes, sellersRes, shopsRes, productsRes, ordersRes, withdrawalsRes] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact' }),
        supabase.from('profiles').select('*', { count: 'exact' }).eq('role', 'seller'),
        supabase.from('shops').select('*'),
        supabase.from('products').select('*', { count: 'exact' }),
        supabase.from('orders').select('total_amount', { count: 'exact' }),
        supabase.from('withdrawals').select('*').eq('status', 'pending'),
      ])

      setStats({
        totalUsers: usersRes.count || 0,
        totalSellers: sellersRes.count || 0,
        totalShops: shopsRes.count || 0,
        totalProducts: productsRes.count || 0,
        totalOrders: ordersRes.count || 0,
        totalRevenue: (ordersRes.data as any[])?.reduce((sum, order) => sum + order.total_amount, 0) || 0,
        pendingWithdrawals: (withdrawalsRes.data as any[])?.length || 0,
      })

      if (usersRes.data) {
        setUsers(usersRes.data as Profile[])
      }

      if (withdrawalsRes.data) {
        setWithdrawals(withdrawalsRes.data as Withdrawal[])
      }

      if (shopsRes.data) {
        setShops(shopsRes.data as Shop[])
      }
    } catch (error) {
      console.error('Error loading owner data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApproveWithdrawal = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('withdrawals')
        .update({ 
          status: 'approved', 
          processed_by: user?.id,
          processed_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error
      toast.success('Withdrawal berhasil disetujui')
      loadData()
    } catch (error) {
      console.error('Error approving withdrawal:', error)
      toast.error('Gagal menyetujui withdrawal')
    }
  }

  const handleRejectWithdrawal = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('withdrawals')
        .update({ 
          status: 'rejected', 
          processed_by: user?.id,
          processed_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error
      toast.success('Withdrawal berhasil ditolak')
      loadData()
    } catch (error) {
      console.error('Error rejecting withdrawal:', error)
      toast.error('Gagal menolak withdrawal')
    }
  }

  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await (supabase as any)
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)

      if (error) throw error
      toast.success('Role user berhasil diubah')
      loadData()
      setEditingUser(null)
    } catch (error) {
      console.error('Error updating user role:', error)
      toast.error('Gagal mengubah role user')
    }
  }

  // Manual verify/unverify toggle. Owners can always override — this
  // never conflicts with the automatic sales-threshold verification
  // trigger in the database, which only ever turns verification ON.
  const handleToggleShopVerification = async (shop: Shop) => {
    setVerifyingShopId(shop.id)
    try {
      const nextVerified = !shop.is_verified
      const { error } = await (supabase as any)
        .from('shops')
        .update({
          is_verified: nextVerified,
          // Unverifying always clears the auto-verified flag too, so a
          // shop the owner manually turned off doesn't display as
          // "auto-verified" the next time it happens to pass the sales
          // check (it will simply be silently re-verified by the
          // trigger if it still clears the threshold, but won't be
          // mislabeled as auto in the meantime).
          auto_verified: nextVerified ? shop.auto_verified : false,
        })
        .eq('id', shop.id)

      if (error) throw error
      toast.success(nextVerified ? 'Toko berhasil diverifikasi' : 'Verifikasi toko dibatalkan')
      setShops((prev) =>
        prev.map((s) => (s.id === shop.id ? { ...s, is_verified: nextVerified, auto_verified: nextVerified ? s.auto_verified : false } : s))
      )
    } catch (error) {
      console.error('Error toggling shop verification:', error)
      toast.error('Gagal mengubah status verifikasi toko')
    } finally {
      setVerifyingShopId(null)
    }
  }

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault()
    if (profile?.role !== 'owner') return toast.error('Broadcast hanya dapat dikirim oleh owner')
    setSendingBroadcast(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const response = await fetch('/api/owner/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }, body: JSON.stringify(broadcast) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      toast.success(`Broadcast dikirim ke ${result.sent} email`)
      setBroadcast({ subject: '', body: '' })
    } catch (error: any) { toast.error(error.message || 'Gagal mengirim broadcast') } finally { setSendingBroadcast(false) }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard Owner</h1>
            <p className="text-gray-600">Kelola seluruh platform Kograph Store</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => router.push('/settings')}
              className="btn-secondary flex items-center gap-2"
            >
              <Settings size={18} /> Pengaturan
            </button>
            <button 
              onClick={() => router.push('/settings?tab=add-seller')}
              className="btn-primary flex items-center gap-2"
            >
              <Plus size={18} /> Tambah Seller
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-gray-200 mb-8 overflow-x-auto">
          {[
            { id: 'overview', label: 'Ringkasan', icon: BarChart3 },
            { id: 'users', label: 'Pengguna', icon: Users, count: stats.totalUsers },
            { id: 'shops', label: 'Toko', icon: Store, count: stats.totalShops },
            { id: 'withdrawals', label: 'Pencairan', icon: DollarSign, badge: stats.pendingWithdrawals },
            ...(profile?.role === 'owner' ? [{ id: 'broadcast', label: 'Broadcast Email', icon: Mail }] : []),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 pb-4 text-sm font-medium transition-colors relative whitespace-nowrap ${
                activeTab === tab.id ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
              {tab.count !== undefined && (
                <span className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
                  {tab.count}
                </span>
              )}
              {tab.badge && tab.badge > 0 && (
                <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {tab.badge}
                </span>
              )}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600"
                />
              )}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Pengguna', value: stats.totalUsers, icon: Users, color: 'bg-blue-500' },
                { label: 'Total Seller', value: stats.totalSellers, icon: ShoppingBag, color: 'bg-green-500' },
                { label: 'Total Toko', value: stats.totalShops, icon: Store, color: 'bg-purple-500' },
                { label: 'Total Produk', value: stats.totalProducts, icon: Package, color: 'bg-orange-500' },
                { label: 'Total Pesanan', value: stats.totalOrders, icon: TrendingUp, color: 'bg-pink-500' },
                { label: 'Total Pendapatan', value: formatCurrency(stats.totalRevenue), icon: DollarSign, color: 'bg-yellow-500' },
                { label: 'Pencairan Pending', value: stats.pendingWithdrawals, icon: AlertTriangle, color: 'bg-red-500' },
              ].map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
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
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                    <th className="pb-3 pl-6 font-medium">User</th>
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Terdaftar</th>
                    <th className="pb-3 pr-6 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                      <td className="py-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium text-sm">
                            {user.full_name?.[0]?.toUpperCase() || 'U'}
                          </div>
                          <span className="font-medium text-sm">{user.full_name}</span>
                        </div>
                      </td>
                      <td className="py-4 text-sm text-gray-600">{user.email}</td>
                      <td className="py-4">
                        {editingUser === user.id ? (
                          <select
                            value={user.role}
                            onChange={(e) => handleUpdateUserRole(user.id, e.target.value)}
                            onBlur={() => setEditingUser(null)}
                            className="text-xs px-2 py-1 rounded-lg border border-gray-200"
                            autoFocus
                          >
                            <option value="customer">Customer</option>
                            <option value="seller">Seller</option>
                            <option value="admin">Admin</option>
                            <option value="owner">Owner</option>
                          </select>
                        ) : (
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            user.role === 'owner' ? 'bg-red-100 text-red-700' :
                            user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                            user.role === 'seller' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {user.role}
                          </span>
                        )}
                      </td>
                      <td className="py-4">
                        {user.is_verified ? (
                          <span className="text-green-600 flex items-center gap-1 text-sm">
                            <Shield size={14} /> Terverifikasi
                          </span>
                        ) : (
                          <span className="text-gray-500 text-sm">Belum terverifikasi</span>
                        )}
                      </td>
                      <td className="py-4 text-sm text-gray-600">
                        {new Date(user.created_at).toLocaleDateString('id-ID')}
                      </td>
                      <td className="py-4 pr-6">
                        <button
                          onClick={() => setEditingUser(user.id)}
                          className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                        >
                          Kelola
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'shops' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                    <th className="pb-3 pl-6 font-medium">Toko</th>
                    <th className="pb-3 font-medium">Owner</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Rating</th>
                    <th className="pb-3 font-medium">Terjual</th>
                    <th className="pb-3 font-medium">Dibuat</th>
                    <th className="pb-3 pr-6 font-medium text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {shops.map((shop) => (
                    <tr key={shop.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                      <td className="py-4 pl-6">
                        <span className="font-medium text-sm">{shop.name}</span>
                      </td>
                      <td className="py-4 text-sm text-gray-600">{shop.owner_id}</td>
                      <td className="py-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            shop.is_verified ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {shop.is_verified ? 'Terverifikasi' : 'Belum'}
                          </span>
                          {shop.is_verified && shop.auto_verified && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600 font-medium" title="Terverifikasi otomatis oleh sistem karena penjualan tinggi">
                              Auto
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 text-sm">⭐ {shop.rating.toFixed(1)} ({shop.total_reviews})</td>
                      <td className="py-4 text-sm text-gray-600">{shop.total_sold ?? 0}</td>
                      <td className="py-4 text-sm text-gray-600">
                        {new Date(shop.created_at).toLocaleDateString('id-ID')}
                      </td>
                      <td className="py-4 pr-6 text-right">
                        <button
                          onClick={() => handleToggleShopVerification(shop)}
                          disabled={verifyingShopId === shop.id}
                          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                            shop.is_verified
                              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              : 'bg-primary-600 text-white hover:bg-primary-700'
                          }`}
                        >
                          {verifyingShopId === shop.id
                            ? 'Memproses...'
                            : shop.is_verified
                              ? 'Batalkan Verifikasi'
                              : 'Verifikasi Manual'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'withdrawals' && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                    <th className="pb-3 pl-6 font-medium">Seller</th>
                    <th className="pb-3 font-medium">Bank</th>
                    <th className="pb-3 font-medium">Nominal</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Tanggal</th>
                    <th className="pb-3 pr-6 font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((withdrawal) => (
                    <tr key={withdrawal.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                      <td className="py-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium text-sm">
                            {withdrawal.seller_id[0].toUpperCase()}
                          </div>
                          <span className="font-medium text-sm">{withdrawal.seller_id}</span>
                        </div>
                      </td>
                      <td className="py-4 text-sm">
                        <div>
                          <p className="font-medium">{withdrawal.bank_name}</p>
                          <p className="text-gray-500 text-xs">{withdrawal.account_number}</p>
                        </div>
                      </td>
                      <td className="py-4 text-sm font-medium">{formatCurrency(withdrawal.amount)}</td>
                      <td className="py-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          withdrawal.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          withdrawal.status === 'approved' ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {withdrawal.status}
                        </span>
                      </td>
                      <td className="py-4 text-sm text-gray-600">
                        {new Date(withdrawal.created_at).toLocaleDateString('id-ID')}
                      </td>
                      <td className="py-4 pr-6">
                        {withdrawal.status === 'pending' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApproveWithdrawal(withdrawal.id)}
                              className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200"
                            >
                              Setujui
                            </button>
                            <button
                              onClick={() => handleRejectWithdrawal(withdrawal.id)}
                              className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200"
                            >
                              Tolak
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'broadcast' && profile?.role === 'owner' && (
          <div className="max-w-2xl bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex gap-3 mb-5"><div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center"><Mail size={20} /></div><div><h2 className="font-bold">Broadcast Email</h2><p className="text-sm text-gray-500">Kirim ke seluruh email yang terdaftar.</p></div></div>
            <form onSubmit={handleBroadcast} className="space-y-4"><input className="input-field" value={broadcast.subject} onChange={e => setBroadcast(v => ({ ...v, subject: e.target.value }))} placeholder="Subjek email" required /><textarea className="input-field min-h-48" value={broadcast.body} onChange={e => setBroadcast(v => ({ ...v, body: e.target.value }))} placeholder="Isi email" required /><button className="btn-primary flex items-center gap-2" disabled={sendingBroadcast}><Mail size={18}/>{sendingBroadcast ? 'Mengirim…' : 'Kirim broadcast'}</button></form>
          </div>
        )}
      </div>
    </div>
  )
}
