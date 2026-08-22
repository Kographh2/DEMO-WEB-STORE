import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  MIDTRANS_SERVER_KEY,
  MIDTRANS_CLIENT_KEY,
  MIDTRANS_SNAP_API_URL,
  MIDTRANS_CORE_API_URL,
  assertMidtransServerConfig,
  midtransAuthHeader,
  MidtransConfigError,
} from '@/lib/midtrans-config'

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

/**
 * Validates the transaction payload before it's ever sent to Midtrans.
 * Returns a human-readable reason string if invalid, or null if OK.
 * Catches the exact class of bug reported in the field: a product
 * displayed at one price but charged at another because two different
 * parts of the code computed the total from different sources.
 */
function validatePayload(
  grossAmount: number,
  itemDetails: PaymentRequest['itemDetails']
): string | null {
  if (!Number.isFinite(grossAmount) || Number.isNaN(grossAmount)) {
    return 'gross_amount is not a valid number'
  }
  if (grossAmount <= 0) {
    return 'gross_amount must be greater than 0'
  }
  if (!Array.isArray(itemDetails) || itemDetails.length === 0) {
    return 'item_details is empty'
  }

  let itemsSum = 0
  for (const item of itemDetails) {
    if (!Number.isFinite(item.price) || item.price < 0) {
      return `invalid price for item "${item.name}"`
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      return `invalid quantity for item "${item.name}"`
    }
    itemsSum += Math.round(item.price) * item.quantity
  }

  // Midtrans itself validates that gross_amount === sum(item price * qty),
  // and rejects the transaction otherwise. We check it here too so a
  // mismatch (e.g. tax/shipping not represented as its own line item)
  // surfaces as a clear 400 from OUR api instead of an opaque Midtrans
  // rejection several layers down.
  if (Math.abs(itemsSum - Math.round(grossAmount)) > 1) {
    return `item_details total (${itemsSum}) does not match gross_amount (${Math.round(grossAmount)})`
  }

  return null
}

export async function POST(request: NextRequest) {
  try {
    const body: PaymentRequest = await request.json()

    if (!body.orderId || !body.amount || !body.email) {
      return NextResponse.json(
        { error: 'Missing required fields', code: 'INVALID_REQUEST' },
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
        { error: 'Order not found', code: 'ORDER_NOT_FOUND' },
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
    // amount, reject the request — indicates tampering or a stale client
    // (e.g. cart total recalculated differently than what's stored on
    // the order — see getUnitPrice() in checkout-page.tsx, which is now
    // the single source of truth for per-item pricing on the frontend).
    const serverAmount = Math.round(order.total_amount)
    if (Math.round(body.amount) !== serverAmount) {
      console.warn(
        `Amount mismatch for order ${order.id}: client sent ${body.amount}, server has ${serverAmount}`
      )
      return NextResponse.json(
        { error: 'Amount mismatch. Please refresh and try again.', code: 'AMOUNT_MISMATCH' },
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
        assertMidtransServerConfig()
      } catch (configError) {
        if (configError instanceof MidtransConfigError) {
          // Clear, diagnosable error instead of letting a missing key
          // surface as a confusing downstream 401/502 from Midtrans.
          console.error('Midtrans configuration error:', configError.message)
          return NextResponse.json(
            { error: 'Midtrans server configuration is missing', code: configError.code },
            { status: 500 }
          )
        }
        throw configError
      }

      const validationError = validatePayload(serverAmount, body.itemDetails)
      if (validationError) {
        console.warn(`Payload validation failed for order ${order.id}: ${validationError}`)
        return NextResponse.json(
          { error: `Invalid payment payload: ${validationError}`, code: 'INVALID_PAYLOAD' },
          { status: 400 }
        )
      }

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

        const response = await fetch(`${MIDTRANS_SNAP_API_URL}/transactions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': midtransAuthHeader(),
            'User-Agent': 'KographStore/1.0',
          },
          body: JSON.stringify(snapRequest),
        })

        if (!response.ok) {
          // Log the REAL reason Midtrans rejected the request — status,
          // message, and full response body — server-side only. The
          // client only ever sees a generic message + stable error code,
          // never the Midtrans response contents or our credentials.
          let midtransErrorBody: unknown = null
          try {
            midtransErrorBody = await response.json()
          } catch {
            midtransErrorBody = await response.text().catch(() => '(unreadable body)')
          }
          console.error('Midtrans transaction creation failed:', {
            httpStatus: response.status,
            midtransResponse: midtransErrorBody,
            orderId: body.orderId,
          })

          // Midtrans auth failures (wrong key for the selected
          // sandbox/production endpoint) come back as 401/403 — surface
          // that distinctly so it's diagnosable from logs at a glance,
          // instead of everything collapsing into one generic 502.
          if (response.status === 401 || response.status === 403) {
            return NextResponse.json(
              { error: 'Payment gateway rejected our credentials', code: 'MIDTRANS_AUTH_ERROR' },
              { status: 500 }
            )
          }
          if (response.status >= 400 && response.status < 500) {
            return NextResponse.json(
              { error: 'Payment gateway rejected the transaction request', code: 'MIDTRANS_REQUEST_REJECTED' },
              { status: 400 }
            )
          }

          return NextResponse.json(
            { error: 'Failed to create payment transaction', code: 'MIDTRANS_UPSTREAM_ERROR' },
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
          clientKey: MIDTRANS_CLIENT_KEY,
          redirectUrl: snapData.redirect_url,
          orderId: body.orderId,
          transactionId: snapData.transaction_id,
        })
      } catch (error) {
        console.error('Unexpected error creating Midtrans transaction:', error)
        return NextResponse.json(
          { error: 'Failed to process payment', code: 'PAYMENT_PROCESSING_ERROR' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Invalid payment method', code: 'INVALID_PAYMENT_METHOD' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Unexpected API error in /api/payments/snap POST:', error)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
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
        { error: 'Order ID is required', code: 'INVALID_REQUEST' },
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
        { error: 'Order not found', code: 'ORDER_NOT_FOUND' },
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
        const statusResponse = await fetch(
          `${MIDTRANS_CORE_API_URL}/${order.transaction_id}/status`,
          {
            headers: {
              'Authorization': midtransAuthHeader(),
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
        } else {
          console.error('Midtrans status check failed:', {
            httpStatus: statusResponse.status,
            orderId,
          })
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
    console.error('Unexpected API error in /api/payments/snap GET:', error)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
