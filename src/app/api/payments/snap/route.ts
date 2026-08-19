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

// Midtrans API configuration
const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || ''
const MIDTRANS_CLIENT_KEY = process.env.MIDTRANS_CLIENT_KEY || ''
const MIDTRANS_API_URL = process.env.MIDTRANS_SANDBOX === 'true' 
  ? 'https://app.sandbox.midtrans.com/snap/v1'
  : 'https://app.midtrans.com/snap/v1'

export async function POST(request: NextRequest) {
  try {
    const body: PaymentRequest = await request.json()

    if (!body.orderId || !body.amount || !body.email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // For COD payment, update order status directly
    if (body.paymentMethod === 'cod') {
      try {
        const { error } = await supabase
          .from('orders')
          .update({
            status: 'confirmed',
            payment_method: 'cod',
            payment_confirmed_at: new Date().toISOString(),
            transaction_id: `COD-${body.orderId}-${Date.now()}`,
          })
          .eq('id', body.orderId)

        if (error) throw error

        return NextResponse.json({
          success: true,
          status: 'confirmed',
          orderId: body.orderId,
          message: 'Order confirmed with COD payment',
          redirectUrl: `/payment-status/success?order_id=${body.orderId}`,
        })
      } catch (error) {
        console.error('Error updating COD order:', error)
        return NextResponse.json(
          { error: 'Failed to process COD payment' },
          { status: 500 }
        )
      }
    }

    // For Midtrans payment
    if (body.paymentMethod === 'midtrans') {
      try {
        // Prepare Midtrans request
        const snapRequest = {
          transaction_details: {
            order_id: body.orderId,
            gross_amount: body.amount,
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
            name: item.name,
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

        // Call Midtrans API
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
          const error = await response.text()
          console.error('Midtrans API error:', error)
          throw new Error(`Midtrans API error: ${response.status}`)
        }

        const snapData = await response.json()

        // Update order status to pending in database
        await supabase
          .from('orders')
          .update({
            status: 'pending_payment',
            payment_method: 'midtrans',
            transaction_id: snapData.transaction_id || '',
            snap_token: snapData.token || '',
            snap_redirect_url: snapData.redirect_url || '',
            expires_at: new Date(Date.now() + 15 * 60000).toISOString(),
          })
          .eq('id', body.orderId)

        return NextResponse.json({
          success: true,
          status: 'pending_payment',
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
            details: error instanceof Error ? error.message : 'Unknown error'
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

// Polling endpoint to check payment status
export async function GET(request: NextRequest) {
  try {
    const orderId = request.nextUrl.searchParams.get('orderId')

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      )
    }

    // Get order from database
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, status, transaction_id, snap_token')
      .eq('id', orderId)
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // If payment is already confirmed, return success
    if (order.status === 'confirmed') {
      return NextResponse.json({
        status: 'confirmed',
        orderId: order.id,
        redirectUrl: `/payment-status/success?order_id=${orderId}`,
      })
    }

    // If it's pending, check with Midtrans
    if (order.status === 'pending_payment' && order.transaction_id) {
      try {
        const auth = Buffer.from(`${MIDTRANS_SERVER_KEY}:`).toString('base64')
        const response = await fetch(
          `${MIDTRANS_API_URL}/transactions/${order.transaction_id}/status`,
          {
            headers: {
              'Authorization': `Basic ${auth}`,
              'User-Agent': 'KographStore/1.0',
            },
          }
        )

        if (response.ok) {
          const statusData = await response.json()

          // Update order status based on Midtrans response
          let orderStatus = 'pending_payment'
          if (statusData.transaction_status === 'settlement' || statusData.transaction_status === 'capture') {
            orderStatus = 'confirmed'
          } else if (statusData.transaction_status === 'deny' || statusData.transaction_status === 'cancel' || statusData.transaction_status === 'expire') {
            orderStatus = 'failed'
          }

          if (orderStatus !== order.status) {
            await supabase
              .from('orders')
              .update({
                status: orderStatus,
                payment_status: statusData.transaction_status,
                payment_confirmed_at: orderStatus === 'confirmed' ? new Date().toISOString() : null,
              })
              .eq('id', orderId)
          }

          return NextResponse.json({
            status: orderStatus,
            midtransStatus: statusData.transaction_status,
            orderId: order.id,
          })
        }
      } catch (error) {
        console.error('Error checking Midtrans status:', error)
      }
    }

    return NextResponse.json({
      status: order.status,
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
