'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle, Download, Home, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/auth-provider'
import toast from 'react-hot-toast'

interface OrderDetails {
  order_id: string
  transaction_id: string
  total_amount: number
  status: string
  payment_status: string
  created_at: string
  seller_name: string
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

function PaymentSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, profile } = useAuth()
  const [orderDetails, setOrderDetails] = useState<OrderDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const orderId = searchParams.get('order_id')
  const transactionId = searchParams.get('transaction_id')
  const isCod = searchParams.get('method') === 'cod'

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
          .select('id, transaction_id, total_amount, status, payment_status, created_at, shop_id, shipping_address, shop:shops(name)')
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
          created_at: string
          shipping_address: ShippingAddressShape | null
          shop: { name: string } | { name: string }[] | null
        }

        const shopData = Array.isArray(orderRow.shop) ? orderRow.shop[0] : orderRow.shop
        const contact = orderRow.shipping_address || {}

        setOrderDetails({
          order_id: orderRow.id,
          transaction_id: orderRow.transaction_id || transactionId || 'N/A',
          total_amount: orderRow.total_amount,
          status: orderRow.status,
          payment_status: orderRow.payment_status,
          created_at: orderRow.created_at,
          seller_name: shopData?.name || 'Unknown',
          customer_name: contact.full_name || profile?.full_name || '-',
          email: contact.email || user?.email || '-',
        })
      } catch (error) {
        console.error('Error fetching order:', error)
        toast.error('Gagal memuat detail pesanan')
      } finally {
        setLoading(false)
      }
    }

    fetchOrderDetails()
  }, [orderId, user, router, transactionId])

  const handleDownloadInvoice = async () => {
    try {
      // In real scenario, this would call an API to generate PDF invoice
      toast.success('Invoice sedang diunduh...')
      // TODO: Implement actual invoice download
    } catch (error) {
      console.error('Error downloading invoice:', error)
      toast.error('Gagal mengunduh invoice')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Memproses hasil pembayaran...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Success Icon */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-100 rounded-full mb-4">
            <CheckCircle className="w-12 h-12 text-primary-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pembayaran Berhasil!</h1>
          <p className="text-gray-600">Pesanan Anda telah dikonfirmasi dan sedang diproses</p>
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
              <p className="text-sm text-gray-500 mb-1">Total Pembayaran</p>
              <p className="text-2xl font-bold text-primary-600">
                Rp{orderDetails.total_amount.toLocaleString('id-ID')}
              </p>
            </div>

            <div className="border-b border-gray-100 pb-4">
              <p className="text-sm text-gray-500 mb-1">Nama Pembeli</p>
              <p className="font-semibold text-gray-900">{orderDetails.customer_name}</p>
            </div>

            <div className="border-b border-gray-100 pb-4">
              <p className="text-sm text-gray-500 mb-1">Email</p>
              <p className="font-semibold text-gray-900">{orderDetails.email}</p>
            </div>

            <div className="border-b border-gray-100 pb-4">
              <p className="text-sm text-gray-500 mb-1">Toko Penjual</p>
              <p className="font-semibold text-gray-900">{orderDetails.seller_name}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-1">Waktu Transaksi</p>
              <p className="font-semibold text-gray-900">
                {new Date(orderDetails.created_at).toLocaleString('id-ID')}
              </p>
            </div>
          </div>
        )}

        {/* Status Info */}
        <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-primary-900 text-sm">Status Pesanan</p>
              <p className="text-sm text-primary-800 mt-1">
                {isCod
                  ? 'Pesanan Anda sedang disiapkan oleh penjual untuk dikirim. Siapkan pembayaran tunai saat barang tiba.'
                  : 'Pesanan Anda sedang diproses oleh penjual. Anda akan menerima notifikasi saat pesanan dikirim.'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleDownloadInvoice}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <Download size={18} />
            Unduh Invoice
          </button>

          <button
            onClick={() => router.push('/orders')}
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            <Clock size={18} />
            Lihat Status Pesanan
          </button>

          <button
            onClick={() => router.push('/')}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Home size={18} />
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

function PaymentSuccessLoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Memuat halaman...</p>
      </div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<PaymentSuccessLoadingFallback />}>
      <PaymentSuccessContent />
    </Suspense>
  )
}
