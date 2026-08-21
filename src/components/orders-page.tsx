'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Package, Clock, CheckCircle, XCircle, Truck, AlertCircle } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { supabase } from '@/lib/supabase'
import { Order } from '@/types'
import { formatCurrency } from '@/lib/utils'

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      loadOrders()
    } else {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user && !loading) router.replace('/')
  }, [user, loading, router])

  // Same background reconciliation as the profile page's order tab —
  // keeps a Midtrans order from being stuck showing "Menunggu" forever
  // just because the buyer never revisited the dedicated pending page.
  useEffect(() => {
    const pendingMidtransOrders = orders.filter(
      (o) => o.payment_method === 'midtrans' && o.payment_status === 'pending'
    )
    if (pendingMidtransOrders.length === 0) return

    let cancelled = false
    const reconcile = async () => {
      for (const order of pendingMidtransOrders) {
        try {
          const res = await fetch(`/api/payments/snap?orderId=${order.id}`)
          if (!res.ok) continue
          const data = await res.json()
          if (!cancelled && (data.status === 'paid' || data.status === 'failed' || data.status === 'expired')) {
            loadOrders()
          }
        } catch {
          // Silent — best-effort background reconciliation.
        }
      }
    }
    reconcile()
    const interval = setInterval(reconcile, 8000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders.map((o) => `${o.id}:${o.payment_status}`).join(',')])

  const loadOrders = async () => {
    try {
      const { data } = await (supabase as any)
        .from('orders')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      
      setOrders((data as Order[]) || [])
    } catch (error) {
      console.error('Error loading orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'delivered':
        return {
          color: 'bg-green-100 text-green-700 border-green-300',
          icon: CheckCircle,
          label: 'Terkirim',
          bgColor: 'bg-green-50'
        }
      case 'shipped':
        return {
          color: 'bg-blue-100 text-blue-700 border-blue-300',
          icon: Truck,
          label: 'Dikirim',
          bgColor: 'bg-blue-50'
        }
      case 'processing':
        return {
          color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
          icon: Clock,
          label: 'Proses',
          bgColor: 'bg-yellow-50'
        }
      case 'paid':
        return {
          color: 'bg-purple-100 text-purple-700 border-purple-300',
          icon: Clock,
          label: 'Dibayar',
          bgColor: 'bg-purple-50'
        }
      case 'cancelled':
        return {
          color: 'bg-red-100 text-red-700 border-red-300',
          icon: XCircle,
          label: 'Dibatalkan',
          bgColor: 'bg-red-50'
        }
      case 'pending':
      default:
        return {
          color: 'bg-yellow-100 text-yellow-700 border-yellow-300',
          icon: AlertCircle,
          label: 'Menunggu',
          bgColor: 'bg-yellow-50'
        }
    }
  }

  if (!user) {
    return null
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Pesanan Saya</h1>
        </div>

        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Belum ada pesanan</p>
            </div>
          ) : (
            orders.map((order, index) => {
              const statusInfo = getStatusInfo(order.status)
              const IconComponent = statusInfo.icon
              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`rounded-2xl p-4 shadow-sm border border-gray-100 ${statusInfo.bgColor}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-full ${statusInfo.color} flex-shrink-0`}>
                      <IconComponent size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-semibold text-gray-900">Pesanan #{order.id.slice(0, 8).toUpperCase()}</p>
                        <span className={`text-xs px-3 py-1 rounded-full font-medium border ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-gray-600">
                        <div>
                          <p className="text-xs text-gray-500">Tanggal Pemesanan</p>
                          <p className="font-medium">{new Date(order.created_at).toLocaleDateString('id-ID')}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Total Pembayaran</p>
                          <p className="font-bold text-lg">{formatCurrency(order.total_amount)}</p>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        Metode: <span className="font-medium">{order.payment_method === 'midtrans' ? 'Midtrans' : 'COD'}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

