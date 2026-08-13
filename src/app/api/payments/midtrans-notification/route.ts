import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const serverKey = process.env.MIDTRANS_SERVER_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serverKey || !supabaseUrl || !serviceRoleKey) return new NextResponse('Server belum dikonfigurasi', { status: 503 })

  try {
    const payload = await request.json()
    const { order_id, status_code, gross_amount, signature_key, transaction_status, fraud_status } = payload
    const signature = createHash('sha512').update(`${order_id}${status_code}${gross_amount}${serverKey}`).digest('hex')
    if (!order_id || signature !== signature_key) return new NextResponse('Signature tidak valid', { status: 403 })

    const paid = transaction_status === 'settlement' || (transaction_status === 'capture' && fraud_status === 'accept')
    const paymentStatus = paid ? 'paid' : transaction_status === 'expire' ? 'expired' : transaction_status === 'deny' || transaction_status === 'cancel' ? 'failed' : 'pending'
    const orderStatus = paid ? 'paid' : 'pending'
    const admin = createClient(supabaseUrl, serviceRoleKey)
    const { data: order, error } = await admin
      .from('orders')
      .update({ payment_status: paymentStatus, status: orderStatus, updated_at: new Date().toISOString() })
      .eq('id', order_id)
      .select('id, user_id, seller_id, total_amount, shop_id')
      .single()
    if (error) throw error

    if (paid && order) {
      // Send notifications
      await admin.from('notifications').insert([
        { user_id: order.user_id, title: 'Pembayaran diterima', message: `Pembayaran pesanan #${order.id.slice(0, 8)} telah diterima.`, type: 'payment', data: { order_id: order.id } },
        { user_id: order.seller_id, title: 'Pesanan baru', message: `Pesanan #${order.id.slice(0, 8)} sudah dibayar dan siap diproses.`, type: 'order', data: { order_id: order.id } },
      ])

      // Check if order contains digital products and send them automatically
      const { data: orderItems } = await admin
        .from('order_items')
        .select('*, product:products(product_type)')
        .eq('order_id', order.id)

      const hasDigitalProducts = orderItems?.some((item: any) => item.product?.product_type === 'digital')

      if (hasDigitalProducts) {
        try {
          // Call the send-digital endpoint to send digital products via email
          await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/products/send-digital`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: order.id }),
          })
        } catch (emailError) {
          console.error('Error sending digital products via email:', emailError)
          // Don't fail the webhook if email sending fails
        }
      }
    }
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Midtrans notification error:', error)
    return new NextResponse('Webhook gagal diproses', { status: 500 })
  }
}
