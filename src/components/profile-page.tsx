'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { 
  User, Settings, ShoppingBag, Heart, LogOut, ChevronRight,
  Shield, Bell, Globe, Moon, HelpCircle, FileText, Edit,
  Camera
} from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import AuthModal from '@/components/auth-modal'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { Order } from '@/types'
import toast from 'react-hot-toast'

export default function ProfilePage() {
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [activeTab, setActiveTab] = useState<'orders' | 'settings'>('orders')
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editUsername, setEditUsername] = useState('')
  const router = useRouter()
  const { user, profile, loading, signOut, updateProfile } = useAuth()

  useEffect(() => {
    if (profile) {
      setEditName(profile.full_name)
      setEditUsername(profile.username)
    }
  }, [profile])

  useEffect(() => {
    if (user && !profile && !loading) {
      const timer = setTimeout(() => {
        window.location.reload()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [user, profile, loading])

  useEffect(() => {
    if (user) {
      loadOrders()
    }
  }, [user])

  const loadOrders = async () => {
    try {
      const { data } = await (supabase as any)
        .from('orders')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(10)
      
      setOrders((data as Order[]) || [])
    } catch (error) {
      console.error('Error loading orders:', error)
    }
  }

  const handleSaveProfile = async () => {
    try {
      await updateProfile({ full_name: editName, username: editUsername })
      toast.success('Profil berhasil diperbarui')
      setIsEditing(false)
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error('Gagal memperbarui profil')
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push('/')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Masuk untuk Melanjutkan</h2>
          <p className="text-gray-600 mb-6">Lihat profil dan riwayat pesanan Anda</p>
          <button
            onClick={() => setShowAuthModal(true)}
            className="btn-primary"
          >
            Masuk / Daftar
          </button>
        </div>
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Gagal memuat profil. Silakan coba lagi.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="btn-primary"
          >
            Refresh
          </button>
        </div>
      </div>
    )
  }

  const menuItems = [
    { icon: ShoppingBag, label: 'Pesanan Saya', href: '/orders' },
    { icon: Heart, label: 'Wishlist', href: '/wishlist' },
    { icon: Bell, label: 'Notifikasi', href: '/notifications' },
    { icon: HelpCircle, label: 'Bantuan', href: '/help' },
    { icon: FileText, label: 'Syarat & Ketentuan', href: '/terms' },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-700'
      case 'shipped': return 'bg-blue-100 text-blue-700'
      case 'processing': return 'bg-yellow-100 text-yellow-700'
      case 'paid': return 'bg-purple-100 text-purple-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-red-100 text-red-700'
      case 'admin': return 'bg-purple-100 text-purple-700'
      case 'seller': return 'bg-blue-100 text-blue-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Profile Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-6"
        >
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-2xl font-bold relative">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Profile"
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                profile.full_name?.[0]?.toUpperCase() || 'U'
              )}
              <button className="absolute bottom-0 right-0 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
                <Camera size={12} className="text-white" />
              </button>
            </div>
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="input-field"
                    placeholder="Nama lengkap"
                  />
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="input-field"
                    placeholder="Username"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveProfile}
                      className="btn-primary text-sm py-1.5 px-3"
                    >
                      Simpan
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false)
                        setEditName(profile.full_name)
                        setEditUsername(profile.username)
                      }}
                      className="btn-secondary text-sm py-1.5 px-3"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-gray-900">{profile.full_name}</h2>
                    {profile.is_verified && (
                      <Shield size={18} className="text-primary-600" />
                    )}
                    <button
                      onClick={() => setIsEditing(true)}
                      className="p-1 hover:bg-gray-100 rounded-full"
                    >
                      <Edit size={14} className="text-gray-400" />
                    </button>
                  </div>
                  <p className="text-gray-600">@{profile.username}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${getRoleBadgeColor(profile.role)}`}>
                      {profile.role}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-6 border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('orders')}
            className={`pb-4 text-sm font-medium transition-colors relative ${
              activeTab === 'orders' ? 'text-primary-600' : 'text-gray-500'
            }`}
          >
            Pesanan Saya
            {activeTab === 'orders' && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600"
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-4 text-sm font-medium transition-colors relative ${
              activeTab === 'settings' ? 'text-primary-600' : 'text-gray-500'
            }`}
          >
            Pengaturan
            {activeTab === 'settings' && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600"
              />
            )}
          </button>
        </div>

        {activeTab === 'orders' && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center">
                <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">Belum ada pesanan</p>
              </div>
            ) : (
              orders.map((order) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-500">
                      {new Date(order.created_at).toLocaleDateString('id-ID')}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Pesanan #{order.id.slice(0, 8)}</p>
                      <p className="text-xs text-gray-500">{order.payment_method.toUpperCase()}</p>
                    </div>
                    <p className="font-bold text-sm">{formatCurrency(order.total_amount)}</p>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4">
            {menuItems.map((item, index) => (
              <motion.button
                key={item.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => item.href && router.push(item.href)}
                className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <item.icon size={20} className="text-primary-600" />
                  </div>
                  <span className="font-medium text-gray-900">{item.label}</span>
                </div>
                 <div className="flex items-center gap-2">
                  <ChevronRight size={18} className="text-gray-400" />
                </div>
              </motion.button>
            ))}

            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: menuItems.length * 0.05 }}
              onClick={handleSignOut}
              className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 hover:bg-red-50 transition-colors text-red-600"
            >
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <LogOut size={20} />
              </div>
              <span className="font-medium">Keluar</span>
            </motion.button>
          </div>
        )}
      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  )
}
