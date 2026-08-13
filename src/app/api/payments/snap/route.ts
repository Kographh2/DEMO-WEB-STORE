import { NextRequest, NextResponse } from 'next/server'
import midtransClient from 'midtrans-client'

export const runtime = 'nodejs'

type SnapItem = { id: string; name: string; price: number; quantity: number }

export async function POST(request: NextRequest) {
  const serverKey = process.env.MIDTRANS_SERVER_KEY
  const clientKey = process.env.MIDTRANS_CLIENT_KEY
  if (!serverKey || !clientKey) {
    return NextResponse.json({ error: 'Konfigurasi Midtrans belum lengkap.' }, { status: 503 })
  }

  try {
    const body = await request.json()
    const { orderId, grossAmount, items, customer, taxAmount = 0, shippingAmount = 0 } = body as {
      orderId?: string
      grossAmount?: number
      items?: SnapItem[]
      taxAmount?: number
      shippingAmount?: number
      customer?: { fullName?: string; email?: string; phone?: string; address?: string; city?: string; postalCode?: string }
    }
    if (!orderId || typeof grossAmount !== 'number' || !Number.isInteger(grossAmount) || grossAmount < 1 || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Data pembayaran tidak valid.' }, { status: 400 })
    }

    const extraItems = [
      taxAmount > 0 ? { id: 'tax', name: 'Pajak', price: Math.round(taxAmount), quantity: 1 } : null,
      shippingAmount > 0 ? { id: 'shipping', name: 'Ongkos kirim', price: Math.round(shippingAmount), quantity: 1 } : null,
    ].filter(Boolean)
    const lineItems = [...items.map((item) => ({
      id: String(item.id).slice(0, 50), name: String(item.name).slice(0, 50), price: Math.round(item.price), quantity: Math.max(1, Math.floor(item.quantity)),
    })), ...extraItems] as SnapItem[]
    const itemTotal = lineItems.reduce((total, item) => total + item.price * item.quantity, 0)
    if (itemTotal !== grossAmount) return NextResponse.json({ error: 'Total pembayaran tidak konsisten.' }, { status: 400 })
    const snap = new midtransClient.Snap({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      serverKey,
      clientKey,
    })
    const transaction = await snap.createTransaction({
      transaction_details: { order_id: orderId, gross_amount: grossAmount },
      item_details: lineItems,
      callbacks: {
        finish: `${(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')}/orders`,
        error: `${(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')}/orders`,
        pending: `${(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')}/orders`,
      },
      customer_details: {
        first_name: customer?.fullName || 'Pelanggan',
        email: customer?.email || undefined,
        phone: customer?.phone || undefined,
        shipping_address: customer?.address ? {
          first_name: customer?.fullName || 'Pelanggan',
          address: customer.address,
          city: customer.city || '',
          postal_code: customer.postalCode || '',
          country_code: 'IDN',
        } : undefined,
      },
    })
    return NextResponse.json({ token: transaction.token, redirectUrl: transaction.redirect_url })
  } catch (error) {
    console.error('Midtrans Snap error:', error)
    return NextResponse.json({ error: 'Gagal membuat transaksi Midtrans.' }, { status: 502 })
  }
}
