import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface PaymentRequest {
  orderId: string
  amount: number
  email: string
  phone: string
  customerName: string
  paymentMethod: 'midtrans' | 'cod'
  itemDetails: Array<{
    id: string
    price: number
    quantity: number
    name: string
  }>
  shippingAddress?: {
    full_name: string
    phone: string
    email: string
    address: string
    city: string
    postal_code: string
  }
}

interface OrderRow {
  id: string
  status: string
  payment_status: string
  total_amount: number
  user_id: string
}

// Midtrans API configuration
const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || ''
const MIDTRANS_API_URL = process.env.MIDTRANS_SANDBOX === 'true'
  ? 'https://app.sandbox.midtrans.com/snap/v1'
  : 'https://app.midtrans.com/snap/v1'

const MIDTRANS_STATUS_API_URL = process.env.MIDTRANS_SANDBOX === 'true'
  ? 'https://api.sandbox.midtrans.com/v2'
  : 'https://api.midtrans.com/v2'

export async function POST(request: NextRequest) {
  try {
    const body: PaymentRequest = await request.json()

    if (!body.orderId || !body.amount || !body.email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // SECURITY: Never trust the amount sent from the client. Always fetch
    // the authoritative total from the database and use that for the
    // actual charge — this prevents a tampered request from paying less
    // than the real order total.
    const { data: existingOrder, error: orderFetchError } = await supabase
      .from('orders')
      .select('id, status, payment_status, total_amount, user_id')
      .eq('id', body.orderId)
      .single()

    if (orderFetchError || !existingOrder) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    const order = existingOrder as unknown as OrderRow

    // Idempotency: don't recreate a Midtrans transaction for an order
    // that's already been paid or already has a payment in progress.
    if (order.payment_status === 'paid') {
      return NextResponse.json({
        success: true,
        status: 'paid',
        orderId: order.id,
        message: 'Order already paid',
        redirectUrl: `/payment-status/success?order_id=${order.id}`,
      })
    }

    // Server-side amount is authoritative. If the client sent a mismatched
    // amount, reject the request — indicates tampering or a stale client.
    const serverAmount = Math.round(order.total_amount)
    if (Math.round(body.amount) !== serverAmount) {
      console.warn(
        `Amount mismatch for order ${order.id}: client sent ${body.amount}, server has ${serverAmount}`
      )
      return NextResponse.json(
        { error: 'Amount mismatch. Please refresh and try again.' },
        { status: 400 }
      )
    }

    // COD orders don't go through a payment gateway — they're created
    // directly by the checkout page and confirmed manually by the seller.
    // This branch exists only as a safe no-op in case it's ever called.
    if (body.paymentMethod === 'cod') {
      return NextResponse.json({
        success: true,
        status: order.status,
        orderId: order.id,
        message: 'COD orders do not require online payment processing',
        redirectUrl: `/payment-status/success?order_id=${order.id}&method=cod`,
      })
    }

    // For Midtrans payment
    if (body.paymentMethod === 'midtrans') {
      try {
        const snapRequest = {
          transaction_details: {
            order_id: body.orderId,
            gross_amount: serverAmount,
          },
          customer_details: {
            first_name: body.customerName,
            email: body.email,
            phone: body.phone,
            billing_address: body.shippingAddress ? {
              first_name: body.shippingAddress.full_name,
              phone: body.shippingAddress.phone,
              address: body.shippingAddress.address,
              city: body.shippingAddress.city,
              postal_code: body.shippingAddress.postal_code,
              country_code: 'IDN',
            } : undefined,
            shipping_address: body.shippingAddress ? {
              first_name: body.shippingAddress.full_name,
              phone: body.shippingAddress.phone,
              address: body.shippingAddress.address,
              city: body.shippingAddress.city,
              postal_code: body.shippingAddress.postal_code,
              country_code: 'IDN',
            } : undefined,
          },
          item_details: body.itemDetails.map(item => ({
            id: item.id,
            price: Math.round(item.price),
            quantity: item.quantity,
            name: item.name.slice(0, 50),
          })),
          callbacks: {
            finish: `${process.env.NEXT_PUBLIC_APP_URL}/payment-status/success?order_id=${body.orderId}`,
            error: `${process.env.NEXT_PUBLIC_APP_URL}/payment-status/failed?order_id=${body.orderId}`,
            pending: `${process.env.NEXT_PUBLIC_APP_URL}/payment-status/pending?order_id=${body.orderId}`,
          },
          expiry: {
            unit: 'minutes',
            length: 15,
          },
        }

        const auth = Buffer.from(`${MIDTRANS_SERVER_KEY}:`).toString('base64')
        const response = await fetch(`${MIDTRANS_API_URL}/transactions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`,
            'User-Agent': 'KographStore/1.0',
          },
          body: JSON.stringify(snapRequest),
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('Midtrans API error:', errorText)
          return NextResponse.json(
            { error: 'Failed to create payment transaction' },
            { status: 502 }
          )
        }

        const snapData = await response.json()

        // Order stays status='pending', payment_status='pending' — we just
        // record the transaction so we (and the webhook) can track it.
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            transaction_id: snapData.transaction_id || null,
            snap_token: snapData.token || null,
            snap_redirect_url: snapData.redirect_url || null,
            expires_at: new Date(Date.now() + 15 * 60000).toISOString(),
          })
          .eq('id', body.orderId)

        if (updateError) {
          console.error('Error saving transaction reference:', updateError)
        }

        return NextResponse.json({
          success: true,
          status: 'pending',
          token: snapData.token,
          redirectUrl: snapData.redirect_url,
          orderId: body.orderId,
          transactionId: snapData.transaction_id,
        })
      } catch (error) {
        console.error('Error processing Midtrans payment:', error)
        return NextResponse.json(
          {
            error: 'Failed to process payment',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Invalid payment method' },
      { status: 400 }
    )
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Polling endpoint to check payment status in near-real-time from the
// pending page, in addition to the Midtrans webhook.
export async function GET(request: NextRequest) {
  try {
    const orderId = request.nextUrl.searchParams.get('orderId')

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      )
    }

    const { data: existingOrder, error } = await supabase
      .from('orders')
      .select('id, status, payment_status, transaction_id')
      .eq('id', orderId)
      .single()

    if (error || !existingOrder) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    const order = existingOrder as unknown as {
      id: string
      status: string
      payment_status: string
      transaction_id: string | null
    }

    if (order.payment_status === 'paid') {
      return NextResponse.json({
        status: 'paid',
        orderId: order.id,
        redirectUrl: `/payment-status/success?order_id=${orderId}`,
      })
    }

    if (order.payment_status === 'failed' || order.payment_status === 'expired') {
      return NextResponse.json({
        status: order.payment_status,
        orderId: order.id,
        redirectUrl: `/payment-status/failed?order_id=${orderId}&reason=${order.payment_status}`,
      })
    }

    // Still pending — actively check with Midtrans in case the webhook
    // hasn't arrived yet (e.g. local dev without a public webhook URL).
    if (order.payment_status === 'pending' && order.transaction_id && MIDTRANS_SERVER_KEY) {
      try {
        const auth = Buffer.from(`${MIDTRANS_SERVER_KEY}:`).toString('base64')
        const statusResponse = await fetch(
          `${MIDTRANS_STATUS_API_URL}/${order.transaction_id}/status`,
          {
            headers: {
              'Authorization': `Basic ${auth}`,
              'User-Agent': 'KographStore/1.0',
            },
          }
        )

        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          const transactionStatus = statusData.transaction_status as string

          let newPaymentStatus: string | null = null
          let newStatus: string | null = null

          if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
            newPaymentStatus = 'paid'
            newStatus = 'paid'
          } else if (transactionStatus === 'deny' || transactionStatus === 'cancel') {
            newPaymentStatus = 'failed'
            newStatus = 'cancelled'
          } else if (transactionStatus === 'expire') {
            newPaymentStatus = 'expired'
            newStatus = 'cancelled'
          }

          if (newPaymentStatus && newPaymentStatus !== order.payment_status) {
            await supabase
              .from('orders')
              .update({
                payment_status: newPaymentStatus,
                status: newStatus ?? order.status,
                payment_confirmed_at: newPaymentStatus === 'paid' ? new Date().toISOString() : null,
              })
              .eq('id', orderId)

            if (newPaymentStatus === 'paid') {
              return NextResponse.json({
                status: 'paid',
                orderId,
                redirectUrl: `/payment-status/success?order_id=${orderId}`,
              })
            }
            if (newPaymentStatus === 'failed' || newPaymentStatus === 'expired') {
              return NextResponse.json({
                status: newPaymentStatus,
                orderId,
                redirectUrl: `/payment-status/failed?order_id=${orderId}&reason=${newPaymentStatus}`,
              })
            }
          }
        }
      } catch (statusCheckError) {
        console.error('Error checking Midtrans status:', statusCheckError)
        // Fall through and just report the current DB status below.
      }
    }

    return NextResponse.json({
      status: order.payment_status,
      orderId: order.id,
    })
  } catch (error) {
    console.error('GET API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
