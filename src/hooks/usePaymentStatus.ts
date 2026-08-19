import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface PaymentStatus {
  status: 'pending' | 'confirmed' | 'failed' | 'pending_payment'
  orderId: string
  transactionId?: string
  lastChecked: Date
}

export function usePaymentStatus(orderId: string | null) {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const checkStatus = useCallback(async () => {
    if (!orderId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Check status from API
      const response = await fetch(`/api/payments/snap?orderId=${orderId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch payment status')
      }

      setPaymentStatus({
        status: data.status,
        orderId: data.orderId,
        transactionId: data.transactionId,
        lastChecked: new Date(),
      })

      return data.status
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      setLoading(false)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    checkStatus()

    // Poll for status updates every 5 seconds
    const interval = setInterval(checkStatus, 5000)

    return () => clearInterval(interval)
  }, [checkStatus])

  return { paymentStatus, loading, error, refetch: checkStatus }
}

// Real-time subscription to order status changes
export function useOrderStatusSubscription(orderId: string | null) {
  const [orderStatus, setOrderStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!orderId) return

    const subscription = supabase
      .from('orders')
      .on('*', (payload) => {
        if (payload.new && payload.new.id === orderId) {
          setOrderStatus(payload.new.status)
        }
      })
      .subscribe()

    return () => {
      supabase.removeSubscription(subscription)
    }
  }, [orderId])

  return orderStatus
}
