import midtransClient from 'midtrans-client'

const snap = new midtransClient.Snap({
  isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
  clientKey: process.env.MIDTRANS_CLIENT_KEY!,
})

export interface MidtransTransactionParams {
  transaction_details: {
    order_id: string
    gross_amount: number
  }
  customer_details: {
    first_name: string
    last_name: string
    email: string
    phone: string
    billing_address?: {
      first_name: string
      last_name: string
      email: string
      phone: string
      address: string
      city: string
      postal_code: string
      country_code: string
    }
    shipping_address?: {
      first_name: string
      last_name: string
      email: string
      phone: string
      address: string
      city: string
      postal_code: string
      country_code: string
    }
  }
  item_details?: Array<{
    id: string
    price: number
    quantity: number
    name: string
  }>
  enabled_payments?: string[]
  callbacks?: {
    finish?: string
    error?: string
    pending?: string
  }
}

export async function createMidtransTransaction(params: MidtransTransactionParams) {
  try {
    const transaction = await snap.createTransaction(params)
    return transaction
  } catch (error) {
    console.error('Midtrans transaction error:', error)
    throw error
  }
}

export function getMidtransClientKey() {
  return process.env.MIDTRANS_CLIENT_KEY
}

export function isMidtransProduction() {
  return process.env.MIDTRANS_IS_PRODUCTION === 'true'
}
