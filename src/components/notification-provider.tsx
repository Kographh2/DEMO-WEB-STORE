'use client'

import { createContext, useContext, useEffect, ReactNode } from 'react'
import { toast } from 'react-hot-toast'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Notification } from '@/types'
import { useAuth } from '@/components/auth-provider'

interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  isLoading: boolean
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userId = user?.id ?? null

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      if (!userId) return []
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)
      return data as Notification[]
    },
    enabled: !!userId,
  })

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any)
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return
      await (supabase as any)
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const unreadCount = notifications.filter(n => !n.is_read).length

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notification = payload.new as Notification
          queryClient.setQueryData<Notification[]>(['notifications', userId], (old) => {
            return old ? [notification, ...old] : [notification]
          })
          
          toast(notification.message, {
            icon: getNotificationIcon(notification.type),
            style: {
              background: '#1e293b',
              color: '#fff',
              borderRadius: '12px',
            },
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, queryClient])

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead: markAsReadMutation.mutate,
        markAllAsRead: markAllAsReadMutation.mutate,
        isLoading,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'order':
      return '📦'
    case 'payment':
      return '💳'
    case 'follow':
      return '👥'
    case 'review':
      return '⭐'
    case 'withdrawal':
      return '💰'
    default:
      return '🔔'
  }
}
