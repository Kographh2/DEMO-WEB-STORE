'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, CreditCard, Truck, ChevronRight, ArrowLeft } from 'lucide-react'
import { useCart } from '@/components/cart-provider'
import { useAuth } from '@/components/auth-provider'
import { supabase } from '@/lib/supabase'
import { formatCurrency, calculateTax } from '@/lib/utils'
import toast from 'react-hot-toast'

type PaymentMethod = 'cod' | 'midtrans'

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
            full_name: orderFullName,
            phone: orderPhone,
            email: orderEmail,
            address: shippingAddress.address,
            city: shippingAddress.city,
            postal_code: shippingAddress.postal_code,
          }
        : {
            full_name: orderFullName,
            phone: orderPhone,
            email: orderEmail,
          }

      const { data: order, error: orderError } = await (supabase as any)
        .from('orders')
        .insert({
          user_id: user.id,
          seller_id: sellerId,
          shop_id: items[0].product.shop_id,
          status: 'pending',
          payment_method: paymentMethod,
          payment_status: paymentMethod === 'cod' ? 'pending' : 'pending',
          subtotal: totalAmount,
          tax_amount: tax,
          shipping_cost: shipping,
          discount_amount: 0,
          total_amount: finalTotal,
          shipping_address: normalizedShippingAddress,
        })
        .select()
        .single()

      if (orderError) throw orderError

      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product.name,
        quantity: item.quantity,
        price: item.product.discount_price ?? item.product.price,
        subtotal: (item.product.discount_price ?? item.product.price) * item.quantity,
      }))

      const { error: itemsError } = await (supabase as any)
        .from('order_items')
        .insert(orderItems)

      if (itemsError) throw itemsError

      if (paymentMethod === 'midtrans') {
        const response = await fetch('/api/payments/snap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: order.id,
            grossAmount: Math.round(finalTotal),
            items: items.map(item => ({
              id: item.product_id,
              price: item.product.discount_price ?? item.product.price,
              quantity: item.quantity,
              name: item.product.name,
            })),
            taxAmount: tax,
            shippingAmount: shipping,
            customer: {
              fullName: normalizedShippingAddress.full_name,
              email: normalizedShippingAddress.email,
              phone: normalizedShippingAddress.phone,
              address: normalizedShippingAddress.address,
              city: normalizedShippingAddress.city,
              postalCode: normalizedShippingAddress.postal_code,
            },
          }),
        })
        const transaction = await response.json()
        if (!response.ok || !transaction.redirectUrl) throw new Error(transaction.error || 'Gagal membuat pembayaran')

        window.location.assign(transaction.redirectUrl)
        return
      } else {
        await clearCart()
        toast.success('Pesanan berhasil dibuat!')
        router.push('/orders')
      }
    } catch (error) {
      console.error('Checkout error:', error)
      toast.error('Gagal membuat pesanan')
    } finally {
      setLoading(false)
    }
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
          <h1 className="text-2xl font-bold text-gray-900">Checkout</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Shipping Address */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                  <MapPin size={20} className="text-primary-600" />
                </div>
                <h3 className="font-bold text-gray-900">
                  {requiredShipping ? 'Alamat Pengiriman' : 'Data Penerima Digital'}
                </h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    value={shippingAddress.full_name}
                    onChange={(e) => setShippingAddress(prev => ({ ...prev, full_name: e.target.value }))}
                    className="input-field"
                    placeholder={requiredShipping ? 'Nama penerima' : 'Nama pemilik akun / penerima'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nomor Telepon
                  </label>
                  <input
                    type="tel"
                    value={shippingAddress.phone}
                    onChange={(e) => setShippingAddress(prev => ({ ...prev, phone: e.target.value }))}
                    className="input-field"
                    placeholder="081234567890"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={shippingAddress.email || user?.email || ''}
                    onChange={(e) => setShippingAddress(prev => ({ ...prev, email: e.target.value }))}
                    className="input-field"
                    placeholder="nama@email.com"
                  />
                </div>

                {requiredShipping && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Alamat Lengkap
                      </label>
                      <textarea
                        value={shippingAddress.address}
                        onChange={(e) => setShippingAddress(prev => ({ ...prev, address: e.target.value }))}
                        className="input-field"
                        rows={3}
                        placeholder="Alamat lengkap, RT/RW, Kelurahan, Kecamatan"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Kota
                        </label>
                        <input
                          type="text"
                          value={shippingAddress.city}
                          onChange={(e) => setShippingAddress(prev => ({ ...prev, city: e.target.value }))}
                          className="input-field"
                          placeholder="Kota"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Kode Pos
                        </label>
                        <input
                          type="text"
                          value={shippingAddress.postal_code}
                          onChange={(e) => setShippingAddress(prev => ({ ...prev, postal_code: e.target.value }))}
                          className="input-field"
                          placeholder="12345"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                  <CreditCard size={20} className="text-primary-600" />
                </div>
                <h3 className="font-bold text-gray-900">Metode Pembayaran</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {!isDigitalOrder && (
                  <button
                    onClick={() => setPaymentMethod('cod')}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      paymentMethod === 'cod'
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Truck size={24} className={paymentMethod === 'cod' ? 'text-primary-600' : 'text-gray-400'} />
                      <div>
                        <p className="font-medium text-gray-900">Cash on Delivery</p>
                        <p className="text-xs text-gray-500">Bayar saat barang diterima</p>
                      </div>
                    </div>
                  </button>
                )}

                <button
                  onClick={() => setPaymentMethod('midtrans')}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    paymentMethod === 'midtrans'
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${isDigitalOrder ? 'sm:col-span-2' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard size={24} className={paymentMethod === 'midtrans' ? 'text-primary-600' : 'text-gray-400'} />
                    <div>
                      <p className="font-medium text-gray-900">Midtrans Snap</p>
                      <p className="text-xs text-gray-500">{isDigitalOrder ? 'Untuk produk digital, kirim otomatis ke email' : 'Transfer, E-wallet, dll'}</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 sticky top-4">
              <h3 className="font-bold text-gray-900 mb-4">Ringkasan Pesanan</h3>

              <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                {items.map((item) => {
                  const price = item.product.discount_price ?? item.product.price
                  return (
                    <div key={item.id} className="flex gap-3">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        {item.product.images?.[0] && (
                          <img
                            src={item.product.images[0]}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 line-clamp-1">
                          {item.product.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.quantity} x {formatCurrency(price)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="space-y-2 mb-4 pt-4 border-t border-gray-100">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span>{formatCurrency(totalAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Pajak (5%)</span>
                  <span>{formatCurrency(tax)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Ongkir</span>
                  <span>{shipping === 0 ? 'Gratis' : formatCurrency(shipping)}</span>
                </div>
                <div className="border-t border-gray-100 pt-2">
                  <div className="flex justify-between">
                    <span className="font-bold">Total</span>
                    <span className="font-bold text-lg text-primary-600">
                      {formatCurrency(finalTotal)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? 'Memproses...' : `Bayar ${formatCurrency(finalTotal)}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
