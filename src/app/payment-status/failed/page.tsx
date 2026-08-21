'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { XCircle, AlertCircle, Home, RotateCcw } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'

interface FailureDetails {
  reason?: string
  amount?: string
  timestamp?: string
}

function PaymentFailedContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [failureDetails, setFailureDetails] = useState<FailureDetails>({})

  useEffect(() => {
    if (!user) {
      router.push('/')
      return
    }

    // Get failure details from URL params
    const reason = searchParams.get('reason') || 'Pembayaran dibatalkan'
    const amount = searchParams.get('amount') || '0'

    setFailureDetails({
      reason,
      amount,
      timestamp: new Date().toLocaleString('id-ID'),
    })
  }, [user, router, searchParams])

  const failureReasons: Record<string, string> = {
    'insufficient_funds': 'Saldo tidak mencukupi',
    'card_expired': 'Kartu kredit sudah kadaluarsa',
    'invalid_card': 'Data kartu tidak valid',
    'timeout': 'Transaksi melebihi waktu tunggu',
    'cancelled': 'Pembayaran dibatalkan oleh pengguna',
    'fraud_detected': 'Transaksi terdeteksi sebagai mencurigakan',
    'authentication_failed': 'Verifikasi autentikasi gagal',
    'bank_declined': 'Bank menolak transaksi',
  }

  const getReasonDisplay = (code: string) => {
    return failureReasons[code] || code
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Failed Icon */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-4">
            <XCircle className="w-12 h-12 text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pembayaran Gagal</h1>
          <p className="text-gray-600">Transaksi Anda tidak dapat diproses</p>
        </div>

        {/* Failure Details */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 space-y-4">
          {failureDetails.reason && (
            <div className="border-b border-gray-100 pb-4">
              <p className="text-sm text-gray-500 mb-1">Alasan Kegagalan</p>
              <p className="font-semibold text-red-600">
                {getReasonDisplay(failureDetails.reason)}
              </p>
            </div>
          )}

          {failureDetails.amount && failureDetails.amount !== '0' && (
            <div className="border-b border-gray-100 pb-4">
              <p className="text-sm text-gray-500 mb-1">Jumlah Transaksi</p>
              <p className="text-2xl font-bold text-gray-900">
                Rp{parseInt(failureDetails.amount).toLocaleString('id-ID')}
              </p>
            </div>
          )}

          {failureDetails.timestamp && (
            <div>
              <p className="text-sm text-gray-500 mb-1">Waktu Kegagalan</p>
              <p className="font-semibold text-gray-900">
                {failureDetails.timestamp}
              </p>
            </div>
          )}
        </div>

        {/* Warning Box */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-900 text-sm">Apa yang harus dilakukan?</p>
              <ul className="text-sm text-yellow-800 mt-2 space-y-1 list-disc list-inside">
                <li>Periksa kembali data kartu atau metode pembayaran Anda</li>
                <li>Pastikan saldo atau limit kartu mencukupi</li>
                <li>Hubungi bank Anda jika masih mengalami kendala</li>
                <li>Coba gunakan metode pembayaran lain</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => router.push('/checkout')}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            Coba Pembayaran Lagi
          </button>

          <button
            onClick={() => router.push('/cart')}
            className="btn-secondary w-full"
          >
            Kembali ke Keranjang
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
          <p className="text-sm text-gray-600 mb-2">
            Masih mengalami masalah? Hubungi kami untuk bantuan
          </p>
          <div className="space-y-1">
            <p>
              <a href="mailto:support@kographstore.com" className="text-primary-600 hover:underline font-semibold">
                support@kographstore.com
              </a>
            </p>
            <p>
              <a href="https://wa.me/62xxxxxxxxxx" className="text-primary-600 hover:underline font-semibold">
                WhatsApp Support
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function PaymentFailedLoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Memuat halaman...</p>
      </div>
    </div>
  )
}

export default function PaymentFailedPage() {
  return (
    <Suspense fallback={<PaymentFailedLoadingFallback />}>
      <PaymentFailedContent />
    </Suspense>
  )
}
