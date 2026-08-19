'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, CreditCard, Truck, ChevronRight, ArrowLeft, Loader } from 'lucide-react'
import { useCart } from '@/components/cart-provider'
import { useAuth } from '@/components/auth-provider'
import { supabase } from '@/lib/supabase'
import { formatCurrency, calculateTax } from '@/lib/utils'
import toast from 'react-hot-toast'

type PaymentMethod = 'cod' | 'midtrans'

declare global {
  interface Window {
    snap: {
      pay: (token: string, options: Record<string, unknown>) => void
    }
  }
}

export default function CheckoutPage() {
  const [step, setStep] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod')
  const [loading, setLoading] = useState(false)
  const [shippingAddress, setShippingAddress] = useState({
    full_name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    postal_code: '',
  })

  const router = useRouter()
  const { items, totalAmount, clearCart } = useCart()
  const { user, profile } = useAuth()

  const isDigitalOrder = items.some((item) => item.product?.product_type === 'digital' || item.product?.digital_delivery_content)
  const requiredShipping = !isDigitalOrder
  const tax = calculateTax(totalAmount)
  const shipping = requiredShipping && totalAmount > 100000 ? 0 : requiredShipping ? 15000 : 0
  const finalTotal = totalAmount + tax + shipping

  // Load Midtrans Snap library
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://app.sandbox.midtrans.com/snap/snap.js'
    script.setAttribute('data-client-key', process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || '')
    document.body.appendChild(script)
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script)
      }
    }
  }, [])

  useEffect(() => {
    if (!user) {
      router.push('/')
    }
  }, [user, router])

  if (!user || items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Keranjang kosong</p>
          <button
            onClick={() => router.push('/')}
            className="btn-primary"
          >
            Belanja Sekarang
          </button>
        </div>
      </div>
    )
  }

  const handlePlaceOrder = async () => {
    setLoading(true)

    try {
      if (!items || items.length === 0) {
        toast.error('Keranjang kosong')
        return
      }

      const orderEmail = shippingAddress.email || user.email || ''
      const orderFullName = shippingAddress.full_name || profile?.full_name || ''
      const orderPhone = shippingAddress.phone || ''

      if (!orderFullName.trim() || !orderPhone.trim() || !orderEmail.trim()) {
        toast.error(requiredShipping ? 'Lengkapi nama, telepon, dan email pengiriman terlebih dahulu' : 'Lengkapi nama, telepon, dan email penerima terlebih dahulu')
        return
      }

      if (requiredShipping && (
        !shippingAddress.address.trim() ||
        !shippingAddress.city.trim() ||
        !shippingAddress.postal_code.trim()
      )) {
        toast.error('Lengkapi alamat pengiriman lengkap terlebih dahulu')
        return
      }

      const shopIds = new Set(items.map((item) => item.product?.shop_id))
      if (shopIds.size !== 1) {
        toast.error('Checkout saat ini hanya untuk produk dari satu toko. Pisahkan pesanan per toko.')
        return
      }

      const sellerId = items[0].product?.shop?.owner_id

      if (!sellerId) {
        toast.error('Gagal memuat data seller. Silakan coba lagi.')
        return
      }

      const normalizedShippingAddress = requiredShipping
        ? {
            full_name: shippingAddress.full_name.trim(),
            phone: shippingAddress.phone.trim(),
            email: shippingAddress.email.trim(),
            address: shippingAddress.address.trim(),
            city: shippingAddress.city.trim(),
            postal_code: shippingAddress.postal_code.trim(),
          }
        : {
            full_name: orderFullName.trim(),
            phone: orderPhone.trim(),
            email: orderEmail.trim(),
            address: '',
            city: '',
            postal_code: '',
          }

      // Create order in database
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          seller_id: sellerId,
          status: 'pending',
          payment_method: paymentMethod,
          total_amount: finalTotal,
          subtotal: totalAmount,
          tax_amount: tax,
          shipping_amount: shipping,
          customer_name: normalizedShippingAddress.full_name,
          customer_email: normalizedShippingAddress.email,
          customer_phone: normalizedShippingAddress.phone,
          shipping_address: requiredShipping ? normalizedShippingAddress : null,
          items: items.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.product?.price,
            name: item.product?.name,
          })),
        })
        .select('id')
        .single()

      if (orderError) {
        console.error('Error creating order:', orderError)
        toast.error('Gagal membuat pesanan')
        return
      }

      const orderId = order.id

      // Process payment
      const paymentResponse = await fetch('/api/payments/snap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          amount: finalTotal,
          email: normalizedShippingAddress.email,
          phone: normalizedShippingAddress.phone,
          customerName: normalizedShippingAddress.full_name,
          paymentMethod,
          itemDetails: items.map((item) => ({
            id: item.product_id,
            price: item.product?.price || 0,
            quantity: item.quantity,
            name: item.product?.name || 'Product',
          })),
          shippingAddress: requiredShipping ? normalizedShippingAddress : undefined,
        }),
      })

      const paymentData = await paymentResponse.json()

      if (!paymentResponse.ok) {
        console.error('Payment error:', paymentData)
        toast.error(paymentData.error || 'Gagal memproses pembayaran')
        return
      }

      // Handle payment based on method
      if (paymentMethod === 'cod') {
        clearCart()
        toast.success('Pesanan berhasil dibuat! Silakan lanjutkan dengan pembayaran di tempat.')
        router.push(`/payment-status/success?order_id=${orderId}`)
      } else if (paymentMethod === 'midtrans') {
        if (paymentData.token && window.snap) {
          // Open Midtrans Snap modal
          window.snap.pay(paymentData.token, {
            onSuccess: function (result) {
              clearCart()
              router.push(`/payment-status/success?order_id=${orderId}&transaction_id=${result.transaction_id}`)
            },
            onPending: function (result) {
              router.push(`/payment-status/pending?order_id=${orderId}&transaction_id=${result.transaction_id}`)
            },
            onError: function (result) {
              router.push(`/payment-status/failed?order_id=${orderId}&reason=${result.status_code}`)
            },
            onClose: function () {
              toast.error('Pembayaran dibatalkan')
            },
          })
        } else {
          toast.error('Gagal memproses pembayaran. Silakan coba lagi.')
        }
      }
    } catch (error) {
      console.error('Checkout error:', error)
      toast.error('Terjadi kesalahan saat checkout')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-200 rounded-lg transition"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-3xl font-bold">Checkout</h1>
        </div>

        {/* Steps Indicator */}
        <div className="mb-8">
          <div className="flex items-center gap-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    s <= step ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  {s}
                </div>
                {s < 3 && (
                  <div
                    className={`h-1 w-12 ${s < step ? 'bg-green-600' : 'bg-gray-300'}`}
                  ></div>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-sm text-gray-600">
            <span>Alamat</span>
            <span>Metode Pembayaran</span>
            <span>Konfirmasi</span>
          </div>
        </div>

        {/* Step 1: Shipping Address */}
        {step === 1 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <MapPin className="w-6 h-6" />
              Alamat Pengiriman
            </h2>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Nama Lengkap"
                value={shippingAddress.full_name}
                onChange={(e) => setShippingAddress({ ...shippingAddress, full_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
              />
              <input
                type="email"
                placeholder="Email"
                value={shippingAddress.email}
                onChange={(e) => setShippingAddress({ ...shippingAddress, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
              />
              <input
                type="tel"
                placeholder="Nomor Telepon"
                value={shippingAddress.phone}
                onChange={(e) => setShippingAddress({ ...shippingAddress, phone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
              />

              {requiredShipping && (
                <>
                  <textarea
                    placeholder="Alamat Lengkap"
                    value={shippingAddress.address}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, address: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                  <input
                    type="text"
                    placeholder="Kota"
                    value={shippingAddress.city}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                  <input
                    type="text"
                    placeholder="Kode Pos"
                    value={shippingAddress.postal_code}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, postal_code: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </>
              )}
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
            >
              Lanjutkan <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Step 2: Payment Method */}
        {step === 2 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <CreditCard className="w-6 h-6" />
              Metode Pembayaran
            </h2>

            <div className="space-y-4 mb-6">
              <label className="border-2 border-gray-300 rounded-lg p-4 cursor-pointer hover:border-green-600 transition" style={{ borderColor: paymentMethod === 'cod' ? '#16a34a' : '#d1d5db' }}>
                <input
                  type="radio"
                  name="payment"
                  value="cod"
                  checked={paymentMethod === 'cod'}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="mr-3"
                />
                <span className="font-semibold">Bayar di Tempat (COD)</span>
                <p className="text-sm text-gray-600 mt-2">Pembayaran saat barang sampai di tangan Anda</p>
              </label>

              <label className="border-2 border-gray-300 rounded-lg p-4 cursor-pointer hover:border-green-600 transition" style={{ borderColor: paymentMethod === 'midtrans' ? '#16a34a' : '#d1d5db' }}>
                <input
                  type="radio"
                  name="payment"
                  value="midtrans"
                  checked={paymentMethod === 'midtrans'}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="mr-3"
                />
                <span className="font-semibold">Pembayaran Online (Midtrans)</span>
                <p className="text-sm text-gray-600 mt-2">Transfer bank, e-wallet, atau kartu kredit</p>
              </label>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 font-bold py-3 rounded-lg"
              >
                Kembali
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
              >
                Lanjutkan <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-2xl font-bold mb-6">Konfirmasi Pesanan</h2>

            {/* Items Summary */}
            <div className="border-b border-gray-200 pb-6 mb-6">
              <h3 className="font-bold mb-4">Produk Pesanan:</h3>
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.product_id} className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{item.product?.name}</p>
                      <p className="text-sm text-gray-600">Jumlah: {item.quantity}</p>
                    </div>
                    <p className="font-semibold">
                      {formatCurrency(item.product?.price ? item.product.price * item.quantity : 0)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Address Summary */}
            <div className="border-b border-gray-200 pb-6 mb-6">
              <h3 className="font-bold mb-2">Alamat Pengiriman:</h3>
              <div className="text-sm text-gray-700">
                <p>{shippingAddress.full_name}</p>
                <p>{shippingAddress.phone}</p>
                {requiredShipping && (
                  <>
                    <p>{shippingAddress.address}</p>
                    <p>{shippingAddress.city}, {shippingAddress.postal_code}</p>
                  </>
                )}
              </div>
            </div>

            {/* Price Summary */}
            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Pajak (10%)</span>
                <span>{formatCurrency(tax)}</span>
              </div>
              {requiredShipping && (
                <div className="flex justify-between">
                  <span>Ongkir</span>
                  <span>{shipping === 0 ? 'Gratis' : formatCurrency(shipping)}</span>
                </div>
              )}
              <div className="border-t border-gray-300 pt-3 flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-green-600">{formatCurrency(finalTotal)}</span>
              </div>
            </div>

            {/* Payment Method Display */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600">Metode Pembayaran:</p>
              <p className="font-semibold">
                {paymentMethod === 'cod' ? 'Bayar di Tempat (COD)' : 'Pembayaran Online (Midtrans)'}
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep(2)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 font-bold py-3 rounded-lg"
              >
                Kembali
              </button>
              <button
                onClick={handlePlaceOrder}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
              >
                {loading && <Loader className="w-5 h-5 animate-spin" />}
                {loading ? 'Memproses...' : 'Pesanan Sekarang'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
