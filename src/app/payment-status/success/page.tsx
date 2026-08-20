'use client'

import { useEffect, useState } from 'react'
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

export default function PaymentSuccessPage() {
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
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Memproses hasil pembayaran...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Success Icon */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pembayaran Berhasil!</h1>
          <p className="text-gray-600">Pesanan Anda telah dikonfirmasi dan sedang diproses</p>
        </div>

        {/* Order Details */}
        {orderDetails && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6 space-y-4">
            <div className="border-b border-gray-200 pb-4">
              <p className="text-sm text-gray-500 mb-1">Nomor Pesanan</p>
              <p className="font-semibold text-gray-900 break-all">{orderDetails.order_id}</p>
            </div>

            <div className="border-b border-gray-200 pb-4">
              <p className="text-sm text-gray-500 mb-1">ID Transaksi</p>
              <p className="font-semibold text-gray-900 break-all">{orderDetails.transaction_id}</p>
            </div>

            <div className="border-b border-gray-200 pb-4">
              <p className="text-sm text-gray-500 mb-1">Total Pembayaran</p>
              <p className="text-2xl font-bold text-green-600">
                Rp{orderDetails.total_amount.toLocaleString('id-ID')}
              </p>
            </div>

            <div className="border-b border-gray-200 pb-4">
              <p className="text-sm text-gray-500 mb-1">Nama Pembeli</p>
              <p className="font-semibold text-gray-900">{orderDetails.customer_name}</p>
            </div>

            <div className="border-b border-gray-200 pb-4">
              <p className="text-sm text-gray-500 mb-1">Email</p>
              <p className="font-semibold text-gray-900">{orderDetails.email}</p>
            </div>

            <div className="border-b border-gray-200 pb-4">
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
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-900 text-sm">Status Pesanan</p>
              <p className="text-sm text-blue-800 mt-1">
                Pesanan Anda sedang diproses oleh penjual. Anda akan menerima notifikasi saat pesanan dikirim.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={handleDownloadInvoice}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            Unduh Invoice
          </button>

          <button
            onClick={() => router.push('/orders')}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
          >
            <Clock className="w-5 h-5" />
            Lihat Status Pesanan
          </button>

          <button
            onClick={() => router.push('/')}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            Kembali ke Beranda
          </button>
        </div>

        {/* Help Section */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            Butuh bantuan? Hubungi{' '}
            <a href="mailto:support@kographstore.com" className="text-green-600 hover:underline font-semibold">
              support@kographstore.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
