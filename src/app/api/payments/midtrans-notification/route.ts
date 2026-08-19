import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

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
 * Verify Midtrans notification signature
 */
function verifyNotification(notification: Record<string, unknown>): boolean {
  const serverKey = process.env.MIDTRANS_SERVER_KEY || ''
  
  const orderId = notification.order_id as string
  const statusCode = notification.status_code as string
  const grossAmount = notification.gross_amount as number
  const signatureKey = notification.signature_key as string

  const data = orderId + statusCode + grossAmount + serverKey
  const hash = crypto.createHash('sha512').update(data).digest('hex')

  return hash === signatureKey
}

/**
 * Handle different payment status from Midtrans
 */
async function handlePaymentStatus(notification: MidtransNotification) {
  const { order_id, transaction_status, transaction_id } = notification

  // Get order from database
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, status, user_id')
    .eq('id', order_id)
    .single()

  if (fetchError || !order) {
    console.error('Order not found:', order_id)
    return
  }

  // Determine order status based on transaction status
  let orderStatus = 'pending'
  
  if (
    transaction_status === 'capture' ||
    transaction_status === 'settlement'
  ) {
    orderStatus = 'confirmed'
  } else if (
    transaction_status === 'deny' ||
    transaction_status === 'cancel' ||
    transaction_status === 'expire'
  ) {
    orderStatus = 'failed'
  } else if (transaction_status === 'pending') {
    orderStatus = 'pending_payment'
  } else if (transaction_status === 'refund') {
    orderStatus = 'refunded'
  }

  // Update order status
  const { error: updateError } = await supabase
    .from('orders')
    .update({
      status: orderStatus,
      payment_status: transaction_status,
      payment_confirmed_at: (orderStatus === 'confirmed') 
        ? new Date().toISOString() 
        : null,
    })
    .eq('id', order_id)

  if (updateError) {
    console.error('Error updating order:', updateError)
    return
  }

  // Log notification for audit trail
  await supabase
    .from('payment_notifications')
    .insert({
      order_id: order_id,
      transaction_id: transaction_id,
      status: transaction_status,
      response_data: notification,
    })
    .catch(err => console.error('Error logging notification:', err))

  console.log(`Order ${order_id} updated to status: ${orderStatus}`)

  // Here you could add additional business logic:
  // - Send notifications to user
  // - Update inventory
  // - Send notification to seller
  // - Trigger email confirmations
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
