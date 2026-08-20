import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface PaymentStatus {
  status: 'pending' | 'paid' | 'failed' | 'expired'
  orderId: string
  redirectUrl?: string
  lastChecked: Date
}

/**
 * Polls the payment status API for a given order. The API itself checks
 * Midtrans directly if the webhook hasn't updated the order yet, so this
 * is a reliable fallback even in local dev where webhooks can't reach us.
 */
export function usePaymentStatus(orderId: string | null, intervalMs: number = 5000) {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const checkStatus = useCallback(async () => {
    if (!orderId) {
      setLoading(false)
      return
    }

    try {
      setError(null)

      const response = await fetch(`/api/payments/snap?orderId=${orderId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch payment status')
      }

      setPaymentStatus({
        status: data.status,
        orderId: data.orderId,
        redirectUrl: data.redirectUrl,
        lastChecked: new Date(),
      })

      return data.status as string
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    checkStatus()

    if (!orderId) return

    const interval = setInterval(checkStatus, intervalMs)
    return () => clearInterval(interval)
  }, [checkStatus, orderId, intervalMs])

  return { paymentStatus, loading, error, refetch: checkStatus }
}

/**
 * Real-time subscription to order status changes using the Supabase
 * Realtime v2 API (`.channel(...).on('postgres_changes', ...)`).
 *
 * Requires the `orders` table to have Realtime enabled in the Supabase
 * dashboard (Database → Replication) — otherwise this simply never fires
 * and the polling in usePaymentStatus() above is the fallback.
 */
export function useOrderStatusSubscription(orderId: string | null) {
  const [orderStatus, setOrderStatus] = useState<string | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!orderId) return

    const channel = supabase
      .channel(`order-status-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const newRow = payload.new as { status?: string; payment_status?: string }
          if (newRow.status) setOrderStatus(newRow.status)
          if (newRow.payment_status) setPaymentStatus(newRow.payment_status)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orderId])

  return { orderStatus, paymentStatus }
}
