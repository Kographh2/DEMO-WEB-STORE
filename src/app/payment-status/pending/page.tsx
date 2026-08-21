'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Clock, AlertCircle, Home, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/auth-provider'
import toast from 'react-hot-toast'

interface PendingOrderDetails {
  order_id: string
  transaction_id: string
  total_amount: number
  status: string
  payment_status: string
  created_at: string
  expires_at: string | null
  payment_method: string
  customer_name: string
  email: string
}

interface ShippingAddressShape {
  full_name?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  postal_code?: string
}

function PaymentPendingContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, profile } = useAuth()
  const [orderDetails, setOrderDetails] = useState<PendingOrderDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [timeLeft, setTimeLeft] = useState<string>('')
  const orderId = searchParams.get('order_id')
  const transactionId = searchParams.get('transaction_id')

  useEffect(() => {
    if (!user) {
      router.push('/')
      return
    }

    const fetchOrderDetails = async () => {
      try {
        if (!orderId) {
          toast.error('Order ID tidak ditemukan')
          setLoading(false)
          return
        }

        const { data, error } = await (supabase as any)
          .from('orders')
          .select('id, transaction_id, total_amount, status, payment_status, payment_method, created_at, expires_at, shipping_address')
          .eq('id', orderId)
          .single()

        if (error) throw error
        if (!data) throw new Error('Order not found')

        const orderRow = data as unknown as {
          id: string
          transaction_id: string | null
          total_amount: number
          status: string
          payment_status: string
          payment_method: string
          created_at: string
          expires_at: string | null
          shipping_address: ShippingAddressShape | null
        }

        const contact = orderRow.shipping_address || {}

        setOrderDetails({
          order_id: orderRow.id,
          transaction_id: orderRow.transaction_id || transactionId || 'N/A',
          total_amount: orderRow.total_amount,
          status: orderRow.status,
          payment_status: orderRow.payment_status,
          payment_method: orderRow.payment_method,
          created_at: orderRow.created_at,
          expires_at: orderRow.expires_at,
          customer_name: contact.full_name || profile?.full_name || '-',
          email: contact.email || user?.email || '-',
        })

        // If payment already resolved by the time this page loads
        // (e.g. webhook beat the redirect), skip straight to the right page.
        if (orderRow.payment_status === 'paid') {
          router.replace(`/payment-status/success?order_id=${orderId}`)
        } else if (orderRow.payment_status === 'failed' || orderRow.payment_status === 'expired') {
          router.replace(`/payment-status/failed?order_id=${orderId}&reason=${orderRow.payment_status}`)
        }
      } catch (error) {
        console.error('Error fetching order:', error)
        toast.error('Gagal memuat detail pesanan')
      } finally {
        setLoading(false)
      }
    }

    fetchOrderDetails()
  }, [orderId, user, profile, router, transactionId])

  // Timer countdown
  useEffect(() => {
    if (!orderDetails?.expires_at) return

    const updateTimer = () => {
      const now = new Date().getTime()
      const expiry = new Date(orderDetails.expires_at as string).getTime()
      const diff = expiry - now

      if (diff <= 0) {
        setTimeLeft('Waktu pembayaran telah berakhir')
        return
      }

      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [orderDetails?.expires_at])

  // Real-time & polling status check: ask the server (which itself queries
  // Midtrans if needed) rather than reading `orders` directly, so the
  // authoritative status logic lives in one place (the API route).
  useEffect(() => {
    if (!orderId) return

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/payments/snap?orderId=${orderId}`)
        if (!response.ok) return
        const data = await response.json()

        if (data.status === 'paid') {
          toast.success('Pembayaran telah dikonfirmasi!')
          router.push(data.redirectUrl || `/payment-status/success?order_id=${orderId}`)
        } else if (data.status === 'failed' || data.status === 'expired') {
          toast.error('Pembayaran gagal atau kedaluwarsa')
          router.push(data.redirectUrl || `/payment-status/failed?order_id=${orderId}`)
        }
      } catch (error) {
        console.error('Error auto-checking status:', error)
      }
    }

    const interval = setInterval(checkStatus, 5000)
    return () => clearInterval(interval)
  }, [orderId, router])

  const handleRefreshStatus = async () => {
    setRefreshing(true)
    try {
      if (!orderId) return

      const response = await fetch(`/api/payments/snap?orderId=${orderId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check status')
      }

      if (data.status === 'paid') {
        toast.success('Pembayaran telah dikonfirmasi!')
        router.push(data.redirectUrl || `/payment-status/success?order_id=${orderId}`)
      } else if (data.status === 'failed' || data.status === 'expired') {
        toast.error('Pembayaran gagal')
        router.push(data.redirectUrl || `/payment-status/failed?order_id=${orderId}`)
      } else {
        toast.success('Status masih menunggu pembayaran')
      }
    } catch (error) {
      console.error('Error refreshing status:', error)
      toast.error('Gagal memperbarui status')
    } finally {
      setRefreshing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Memproses pesanan...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Pending Icon */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-100 rounded-full mb-4">
            <Clock className="w-12 h-12 text-amber-600 animate-pulse" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pembayaran Menunggu</h1>
          <p className="text-gray-600">Pesanan Anda sedang menunggu konfirmasi pembayaran</p>
        </div>

        {/* Order Details */}
        {orderDetails && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 space-y-4">
            <div className="border-b border-gray-100 pb-4">
              <p className="text-sm text-gray-500 mb-1">Nomor Pesanan</p>
              <p className="font-semibold text-gray-900 break-all">{orderDetails.order_id}</p>
            </div>

            <div className="border-b border-gray-100 pb-4">
              <p className="text-sm text-gray-500 mb-1">ID Transaksi</p>
              <p className="font-semibold text-gray-900 break-all">{orderDetails.transaction_id}</p>
            </div>

            <div className="border-b border-gray-100 pb-4">
              <p className="text-sm text-gray-500 mb-1">Jumlah Pembayaran</p>
              <p className="text-2xl font-bold text-amber-600">
                Rp{orderDetails.total_amount.toLocaleString('id-ID')}
              </p>
            </div>

            <div className="border-b border-gray-100 pb-4">
              <p className="text-sm text-gray-500 mb-1">Metode Pembayaran</p>
              <p className="font-semibold text-gray-900 capitalize">
                {orderDetails.payment_method}
              </p>
            </div>

            <div className="border-b border-gray-100 pb-4">
              <p className="text-sm text-gray-500 mb-1">Nama Pembeli</p>
              <p className="font-semibold text-gray-900">{orderDetails.customer_name}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-1">Email</p>
              <p className="font-semibold text-gray-900">{orderDetails.email}</p>
            </div>
          </div>
        )}

        {/* Countdown Timer */}
        {orderDetails?.expires_at && (
          <div className="bg-amber-50 border-2 border-amber-100 rounded-2xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900 text-sm">Sisa Waktu Pembayaran</p>
                <p className="text-2xl font-bold text-amber-600 mt-2 font-mono">
                  {timeLeft || 'Memproses...'}
                </p>
                <p className="text-xs text-amber-800 mt-2">
                  Selesaikan pembayaran sebelum waktu berakhir
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Information Box */}
        <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-primary-900 text-sm">Catatan Penting</p>
              <p className="text-sm text-primary-800 mt-2">
                Halaman ini otomatis memeriksa status pembayaran Anda setiap beberapa detik.
                Segera selesaikan pembayaran melalui metode yang telah dipilih. Pesanan akan
                otomatis dibatalkan jika pembayaran tidak selesai dalam waktu yang ditentukan.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleRefreshStatus}
            disabled={refreshing}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Memperbarui...' : 'Cek Status Pembayaran'}
          </button>

          <button
            onClick={() => router.push('/checkout')}
            className="btn-secondary w-full"
          >
            Kembali ke Checkout
          </button>

          <button
            onClick={() => router.push('/')}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            Kembali ke Beranda
          </button>
        </div>

        {/* Help Section */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            Butuh bantuan? Hubungi{' '}
            <a href="mailto:support@kographstore.com" className="text-primary-600 hover:underline font-semibold">
              support@kographstore.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

function PaymentPendingLoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Memuat halaman...</p>
      </div>
    </div>
  )
}

export default function PaymentPendingPage() {
  return (
    <Suspense fallback={<PaymentPendingLoadingFallback />}>
      <PaymentPendingContent />
    </Suspense>
  )
}
