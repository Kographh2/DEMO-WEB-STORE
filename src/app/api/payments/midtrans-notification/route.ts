import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { MIDTRANS_SERVER_KEY } from '@/lib/midtrans-config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface MidtransNotification {
  transaction_id: string
  order_id: string
  payment_type: string
  transaction_status: string
  transaction_time: string
  transaction_amount: number
  currency: string
  gross_amount: number
  settlement_time?: string
  status_code: string
  signature_key: string
  bank?: string
  masked_card?: string
  card_type?: string
  [key: string]: unknown
}

/**
 * Verify Midtrans notification signature.
 *
 * SECURITY: Uses crypto.timingSafeEqual instead of `===` to compare the
 * computed hash against the signature Midtrans sent. A plain string
 * comparison short-circuits on the first mismatched byte, which leaks
 * timing information an attacker could use to guess a valid signature
 * byte-by-byte. timingSafeEqual always takes the same time regardless
 * of where the mismatch occurs.
 */
function verifyNotification(notification: Record<string, unknown>): boolean {
  const serverKey = MIDTRANS_SERVER_KEY

  const orderId = String(notification.order_id ?? '')
  const statusCode = String(notification.status_code ?? '')
  const grossAmount = String(notification.gross_amount ?? '')
  const signatureKey = String(notification.signature_key ?? '')

  if (!orderId || !statusCode || !grossAmount || !signatureKey || !serverKey) {
    return false
  }

  const data = orderId + statusCode + grossAmount + serverKey
  const expectedHash = crypto.createHash('sha512').update(data).digest('hex')

  const expectedBuffer = Buffer.from(expectedHash, 'hex')
  const providedBuffer = Buffer.from(signatureKey, 'hex')

  // timingSafeEqual throws if buffer lengths differ, so guard first —
  // a length mismatch just means the signature is invalid.
  if (expectedBuffer.length !== providedBuffer.length) {
    return false
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer)
}

/**
 * Handle different payment status from Midtrans
 */
async function handlePaymentStatus(notification: MidtransNotification) {
  const { order_id, transaction_status, transaction_id } = notification

  try {
    // Get order from database
    const { data: orderData, error: fetchError } = await supabase
      .from('orders')
      .select('id, status, payment_status, user_id, total_amount')
      .eq('id', order_id)
      .single()

    if (fetchError || !orderData) {
      console.error('Order not found:', order_id)
      return
    }

    const order = orderData as unknown as {
      id: string
      status: string
      payment_status: string
      user_id: string
      total_amount: number
    }

    // SECURITY: Defense in depth. Even though the signature already proves
    // the notification came from Midtrans with our server key, also check
    // that the amount Midtrans is reporting matches what we actually
    // charged for this order. Protects against integration bugs or a
    // mismatched order_id resolving to the wrong order.
    const notifiedAmount = Math.round(Number(notification.gross_amount))
    const expectedAmount = Math.round(order.total_amount)
    if (Number.isFinite(notifiedAmount) && notifiedAmount !== expectedAmount) {
      console.error(
        `Amount mismatch on notification for order ${order_id}: notified ${notifiedAmount}, expected ${expectedAmount}`
      )
      return
    }

    // Idempotency: if we already recorded this order as paid, don't
    // process a late/duplicate notification again (e.g. Midtrans retries
    // notifications until it gets a 200 OK).
    if (order.payment_status === 'paid' && transaction_status !== 'refund') {
      console.log(`Order ${order_id} already paid, ignoring duplicate notification`)
      return
    }

    // Map Midtrans's transaction_status to our schema's constrained enums:
    //   orders.status:         pending | paid | processing | shipped | delivered | cancelled
    //   orders.payment_status: pending | paid | failed | expired
    let paymentStatus: 'pending' | 'paid' | 'failed' | 'expired' = 'pending'
    let orderStatus: 'pending' | 'paid' | 'cancelled' | null = null

    if (transaction_status === 'capture' || transaction_status === 'settlement') {
      paymentStatus = 'paid'
      orderStatus = 'paid'
    } else if (transaction_status === 'deny' || transaction_status === 'cancel') {
      paymentStatus = 'failed'
      orderStatus = 'cancelled'
    } else if (transaction_status === 'expire') {
      paymentStatus = 'expired'
      orderStatus = 'cancelled'
    } else if (transaction_status === 'pending') {
      paymentStatus = 'pending'
      orderStatus = null // leave order.status untouched while awaiting payment
    } else if (transaction_status === 'refund' || transaction_status === 'partial_refund') {
      // No dedicated "refunded" state in the schema — treat as failed sale
      // and cancel the order, while the raw status is preserved in
      // payment_notifications for manual/admin follow-up.
      paymentStatus = 'failed'
      orderStatus = 'cancelled'
    }

    const updatePayload: Record<string, unknown> = {
      payment_status: paymentStatus,
      payment_confirmed_at: paymentStatus === 'paid' ? new Date().toISOString() : null,
    }
    if (orderStatus) {
      updatePayload.status = orderStatus
    }

    // Update order status
    const { error: updateError } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', order_id)

    if (updateError) {
      console.error('Error updating order:', updateError)
      return
    }

    // Log notification for audit trail
    try {
      await supabase
        .from('payment_notifications')
        .insert({
          order_id: order_id,
          transaction_id: transaction_id,
          status: transaction_status,
          response_data: notification,
        })
    } catch (err) {
      console.error('Error logging notification:', err)
    }

    console.log(`Order ${order_id} payment_status -> ${paymentStatus}${orderStatus ? `, status -> ${orderStatus}` : ''}`)
  } catch (error) {
    console.error('Error handling payment status:', error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const notification = await request.json() as Record<string, unknown>

    // Verify Midtrans signature
    if (!verifyNotification(notification)) {
      console.warn('Invalid Midtrans notification signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Process the notification
    await handlePaymentStatus(notification as MidtransNotification)

    // Return success response
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Notification handler error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'ok',
    message: 'Midtrans notification endpoint is ready'
  })
}
