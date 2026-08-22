'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  MapPin, CreditCard, Truck, ChevronRight, ArrowLeft, Loader,
  Zap, Package, CheckCircle2, ShieldCheck,
} from 'lucide-react'
import { useCart } from '@/components/cart-provider'
import { useAuth } from '@/components/auth-provider'
import { supabase } from '@/lib/supabase'
import { formatCurrency, calculateTax, getUnitPrice } from '@/lib/utils'
import toast from 'react-hot-toast'

type PaymentMethod = 'cod' | 'midtrans'

interface MidtransSnapResult {
  order_id?: string
  transaction_id?: string
  status_code?: string
  transaction_status?: string
  [key: string]: unknown
}

interface MidtransSnapOptions {
  onSuccess?: (result: MidtransSnapResult) => void
  onPending?: (result: MidtransSnapResult) => void
  onError?: (result: MidtransSnapResult) => void
  onClose?: () => void
}

declare global {
  interface Window {
    snap: {
      pay: (token: string, options: MidtransSnapOptions) => void
    }
  }
}

const steps = ['Alamat', 'Pembayaran', 'Konfirmasi']

export default function CheckoutPage() {
  const [step, setStep] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('midtrans')
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

  const isDigitalOrder = items.every((item) => item.product?.product_type === 'digital' || item.product?.digital_delivery_content)
  const hasMixedTypes = !isDigitalOrder && items.some((item) => item.product?.product_type === 'digital' || item.product?.digital_delivery_content)
  const requiredShipping = !isDigitalOrder
  const tax = calculateTax(totalAmount)
  const shipping = requiredShipping && totalAmount > 100000 ? 0 : requiredShipping ? 15000 : 0
  const finalTotal = totalAmount + tax + shipping

  // Digital-only orders can't be paid COD (nothing to collect cash on
  // delivery for), so force Midtrans and never show COD as an option.
  useEffect(() => {
    if (isDigitalOrder && paymentMethod === 'cod') {
      setPaymentMethod('midtrans')
    }
  }, [isDigitalOrder, paymentMethod])

  // Load Midtrans Snap library. The client key + correct snap.js URL
  // (sandbox vs production) are fetched from our own API instead of
  // relying on NEXT_PUBLIC_MIDTRANS_CLIENT_KEY being inlined at build
  // time — see src/app/api/payments/client-config/route.ts for why.
  useEffect(() => {
    let script: HTMLScriptElement | null = null

    fetch('/api/payments/client-config')
      .then((res) => res.json())
      .then((config) => {
        if (!config.clientKey) {
          console.error('Midtrans client configuration is missing:', config.error)
          return
        }
        script = document.createElement('script')
        script.src = config.snapJsUrl
        script.setAttribute('data-client-key', config.clientKey)
        document.body.appendChild(script)
      })
      .catch((err) => console.error('Failed to load Midtrans client config:', err))

    return () => {
      if (script && document.body.contains(script)) {
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
          <button onClick={() => router.push('/')} className="btn-primary">
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

      const shopId = items[0].product?.shop_id
      const sellerId = items[0].product?.shop?.owner_id

      if (!shopId || !sellerId) {
        toast.error('Gagal memuat data toko. Silakan coba lagi.')
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

      // Create order in database.
      // COD orders start life at 'processing' (not 'pending') — there
      // is no payment gateway step to wait on for COD, so the seller
      // sees it straight away as an actionable order to prepare. Midtrans
      // orders start 'pending'/'pending' and move to 'paid' automatically
      // once payment clears (webhook + status polling handle that).
      const { data: insertedOrder, error: orderError } = await (supabase as any)
        .from('orders')
        .insert({
          user_id: user.id,
          seller_id: sellerId,
          shop_id: shopId,
          payment_method: paymentMethod,
          status: paymentMethod === 'cod' ? 'processing' : 'pending',
          subtotal: totalAmount,
          tax_amount: tax,
          shipping_cost: shipping,
          total_amount: finalTotal,
          shipping_address: normalizedShippingAddress,
        })
        .select('id')
        .single()

      if (orderError || !insertedOrder) {
        console.error('Error creating order:', orderError)
        toast.error('Gagal membuat pesanan')
        return
      }

      const orderId = insertedOrder.id

      const orderItemsPayload = items.map((item) => {
        const unitPrice = getUnitPrice(item.product)
        return {
          order_id: orderId,
          product_id: item.product_id,
          product_name: item.product?.name || 'Produk',
          quantity: item.quantity,
          price: unitPrice,
          subtotal: unitPrice * item.quantity,
        }
      })

      const { error: itemsError } = await (supabase as any).from('order_items').insert(orderItemsPayload)
      if (itemsError) {
        console.error('Error creating order items:', itemsError)
      }

      if (paymentMethod === 'cod') {
        clearCart()
        toast.success('Pesanan berhasil dibuat! Penjual akan segera menyiapkan barangmu.')
        router.push(`/payment-status/success?order_id=${orderId}&method=cod`)
        return
      }

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
          itemDetails: orderItemsPayload.map((item) => ({
            id: item.product_id,
            price: item.price,
            quantity: item.quantity,
            name: item.product_name,
          })),
          shippingAddress: requiredShipping ? normalizedShippingAddress : undefined,
        }),
      })

      const paymentData = await paymentResponse.json()

      if (!paymentResponse.ok) {
        console.error('Payment error:', paymentData)
        // A config-related error is our fault, not something a retry
        // fixes — tell the user plainly instead of implying they did
        // something wrong.
        if (paymentData.code === 'MIDTRANS_CONFIG_MISSING' || paymentData.code === 'MIDTRANS_AUTH_ERROR') {
          toast.error('Pembayaran online sedang bermasalah di sisi kami. Silakan coba lagi nanti atau gunakan metode lain.')
        } else {
          toast.error(paymentData.error || 'Gagal memproses pembayaran')
        }
        return
      }

      if (paymentData.token && window.snap) {
        window.snap.pay(paymentData.token, {
          onSuccess: (result) => {
            clearCart()
            router.push(`/payment-status/success?order_id=${orderId}&transaction_id=${result.transaction_id ?? ''}`)
          },
          onPending: (result) => {
            clearCart()
            router.push(`/payment-status/pending?order_id=${orderId}&transaction_id=${result.transaction_id ?? ''}`)
          },
          onError: (result) => {
            router.push(`/payment-status/failed?order_id=${orderId}&reason=${result.status_code ?? 'unknown'}`)
          },
          onClose: () => {
            toast.error('Pembayaran belum selesai. Anda dapat melanjutkan dari halaman status pesanan.')
            router.push(`/payment-status/pending?order_id=${orderId}`)
          },
        })
      } else {
        toast.error('Gagal memproses pembayaran. Silakan coba lagi.')
      }
    } catch (error) {
      console.error('Checkout error:', error)
      toast.error('Terjadi kesalahan saat checkout')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="max-w-lg mx-auto px-4 pt-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Checkout</h1>
        </div>

        {/* Order type banner — makes it unmistakable whether this is a
            digital or physical order, since the flow differs (no
            address/COD for digital). */}
        <div className={`flex items-center gap-3 rounded-2xl p-4 mb-6 border ${
          isDigitalOrder
            ? 'bg-primary-50 border-primary-100'
            : 'bg-orange-50 border-orange-100'
        }`}>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isDigitalOrder ? 'bg-primary-600' : 'bg-orange-500'
          }`}>
            {isDigitalOrder ? <Zap size={20} className="text-white" /> : <Truck size={20} className="text-white" />}
          </div>
          <div>
            <p className={`font-semibold text-sm ${isDigitalOrder ? 'text-primary-700' : 'text-orange-700'}`}>
              {isDigitalOrder ? 'Pesanan Produk Digital' : hasMixedTypes ? 'Pesanan Campuran (Fisik & Digital)' : 'Pesanan Produk Fisik'}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              {isDigitalOrder
                ? 'Dikirim otomatis ke akunmu setelah pembayaran berhasil — tanpa alamat, tanpa ongkir.'
                : 'Butuh alamat pengiriman. Bisa dibayar COD atau online.'}
            </p>
          </div>
        </div>

        {/* Steps Indicator */}
        <div className="mb-6">
          <div className="flex items-center">
            {steps.map((label, i) => {
              const s = i + 1
              return (
                <div key={label} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                        s <= step ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {s < step ? <CheckCircle2 size={16} /> : s}
                    </div>
                    <span className={`text-[11px] font-medium ${s <= step ? 'text-primary-600' : 'text-gray-400'}`}>
                      {label}
                    </span>
                  </div>
                  {s < steps.length && (
                    <div className={`flex-1 h-0.5 mx-1 mb-4 ${s < step ? 'bg-primary-600' : 'bg-gray-200'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Shipping / Contact */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6"
            >
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-900">
                <MapPin size={20} className="text-primary-600" />
                {requiredShipping ? 'Alamat Pengiriman' : 'Data Penerima'}
              </h2>

              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Nama Lengkap"
                  value={shippingAddress.full_name}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, full_name: e.target.value })}
                  className="input-field"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={shippingAddress.email}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, email: e.target.value })}
                  className="input-field"
                />
                <input
                  type="tel"
                  placeholder="Nomor Telepon"
                  value={shippingAddress.phone}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, phone: e.target.value })}
                  className="input-field"
                />

                {requiredShipping && (
                  <>
                    <textarea
                      placeholder="Alamat Lengkap"
                      value={shippingAddress.address}
                      onChange={(e) => setShippingAddress({ ...shippingAddress, address: e.target.value })}
                      rows={3}
                      className="input-field"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Kota"
                        value={shippingAddress.city}
                        onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                        className="input-field"
                      />
                      <input
                        type="text"
                        placeholder="Kode Pos"
                        value={shippingAddress.postal_code}
                        onChange={(e) => setShippingAddress({ ...shippingAddress, postal_code: e.target.value })}
                        className="input-field"
                      />
                    </div>
                  </>
                )}

                {!requiredShipping && (
                  <div className="flex items-start gap-2 bg-primary-50 rounded-xl p-3 text-xs text-primary-700">
                    <Zap size={14} className="flex-shrink-0 mt-0.5" />
                    Produk digital akan dikirim otomatis ke email/akunmu setelah pembayaran berhasil.
                  </div>
                )}
              </div>

              <button onClick={() => setStep(2)} className="btn-primary w-full mt-5 flex items-center justify-center gap-2">
                Lanjutkan <ChevronRight size={18} />
              </button>
            </motion.div>
          )}

          {/* Step 2: Payment Method */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6"
            >
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-900">
                <CreditCard size={20} className="text-primary-600" />
                Metode Pembayaran
              </h2>

              <div className="space-y-3 mb-6">
                {!isDigitalOrder && (
                  <label
                    className={`block rounded-2xl p-4 cursor-pointer border-2 transition-colors ${
                      paymentMethod === 'cod' ? 'border-primary-600 bg-primary-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="payment"
                        value="cod"
                        checked={paymentMethod === 'cod'}
                        onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                        className="accent-primary-600 w-4 h-4"
                      />
                      <Package size={18} className="text-gray-500" />
                      <div>
                        <span className="font-semibold text-sm text-gray-900">Bayar di Tempat (COD)</span>
                        <p className="text-xs text-gray-500 mt-0.5">Bayar tunai saat barang sampai</p>
                      </div>
                    </div>
                  </label>
                )}

                <label
                  className={`block rounded-2xl p-4 cursor-pointer border-2 transition-colors ${
                    paymentMethod === 'midtrans' ? 'border-primary-600 bg-primary-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="payment"
                      value="midtrans"
                      checked={paymentMethod === 'midtrans'}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                      className="accent-primary-600 w-4 h-4"
                    />
                    <ShieldCheck size={18} className="text-gray-500" />
                    <div>
                      <span className="font-semibold text-sm text-gray-900">Pembayaran Online</span>
                      <p className="text-xs text-gray-500 mt-0.5">Transfer bank, e-wallet, QRIS, atau kartu — diproses otomatis & real-time</p>
                    </div>
                  </div>
                </label>

                {isDigitalOrder && (
                  <p className="text-xs text-gray-500 px-1">
                    COD tidak tersedia untuk produk digital karena tidak ada barang fisik yang diantar.
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="btn-secondary flex-1">
                  Kembali
                </button>
                <button onClick={() => setStep(3)} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  Lanjutkan <ChevronRight size={18} />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Confirmation */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6"
            >
              <h2 className="text-lg font-bold mb-4 text-gray-900">Konfirmasi Pesanan</h2>

              <div className="border-b border-gray-100 pb-4 mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Produk Pesanan</h3>
                <div className="space-y-3">
                  {items.map((item) => {
                    const unitPrice = getUnitPrice(item.product)
                    const hasDiscount = !!item.product?.discount_price && item.product.discount_price < item.product.price
                    return (
                      <div key={item.product_id} className="flex justify-between items-start text-sm">
                        <div>
                          <p className="font-medium text-gray-900">{item.product?.name}</p>
                          <p className="text-xs text-gray-500">Jumlah: {item.quantity}</p>
                        </div>
                        <div className="text-right">
                          {hasDiscount && (
                            <p className="text-xs text-gray-400 line-through">
                              {formatCurrency((item.product?.price ?? 0) * item.quantity)}
                            </p>
                          )}
                          <p className="font-semibold text-gray-900">
                            {formatCurrency(unitPrice * item.quantity)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="border-b border-gray-100 pb-4 mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  {requiredShipping ? 'Alamat Pengiriman' : 'Data Penerima'}
                </h3>
                <div className="text-sm text-gray-600">
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

              <div className="space-y-2 mb-4 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{formatCurrency(totalAmount)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Pajak (10%)</span>
                  <span>{formatCurrency(tax)}</span>
                </div>
                {requiredShipping && (
                  <div className="flex justify-between text-gray-600">
                    <span>Ongkir</span>
                    <span>{shipping === 0 ? 'Gratis' : formatCurrency(shipping)}</span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-base text-gray-900">
                  <span>Total</span>
                  <span className="text-primary-600">{formatCurrency(finalTotal)}</span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 mb-5">
                <p className="text-xs text-gray-500">Metode Pembayaran</p>
                <p className="font-semibold text-sm text-gray-900">
                  {paymentMethod === 'cod' ? 'Bayar di Tempat (COD)' : 'Pembayaran Online'}
                </p>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="btn-secondary flex-1">
                  Kembali
                </button>
                <button
                  onClick={handlePlaceOrder}
                  disabled={loading}
                  className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading && <Loader size={18} className="animate-spin" />}
                  {loading ? 'Memproses...' : 'Pesan Sekarang'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
