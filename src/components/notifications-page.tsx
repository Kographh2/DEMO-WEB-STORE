'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bell, Check, Package, CreditCard, Users, Star, DollarSign } from 'lucide-react'
import { useNotifications } from '@/components/notification-provider'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/auth-provider'
import { Notification } from '@/types'
import { formatDate } from '@/lib/utils'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<(Notification & { read?: boolean })[]>([])
  const [loading, setLoading] = useState(true)
  const { markAsRead, markAllAsRead } = useNotifications()
  const { user } = useAuth()

  useEffect(() => {
    loadNotifications()
  }, [])

  const loadNotifications = async () => {
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user?.id || '')
        .order('created_at', { ascending: false })
      
      setNotifications(data as any[] || [])
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order': return <Package size={20} className="text-blue-600" />
      case 'payment': return <CreditCard size={20} className="text-green-600" />
      case 'follow': return <Users size={20} className="text-purple-600" />
      case 'review': return <Star size={20} className="text-yellow-600" />
      case 'withdrawal': return <DollarSign size={20} className="text-orange-600" />
      default: return <Bell size={20} className="text-gray-600" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Notifikasi</h1>
          {notifications.some(n => !n.is_read) && (
            <button
              onClick={markAllAsRead}
              className="text-sm text-primary-600 font-medium hover:text-primary-700"
            >
              Tandai semua dibaca
            </button>
          )}
        </div>

        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">Tidak ada notifikasi</p>
            </div>
          ) : (
            notifications.map((notification, index) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => !notification.is_read && markAsRead(notification.id)}
                className={`bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-start gap-4 cursor-pointer transition-colors ${
                  !notification.is_read ? 'border-primary-200 bg-primary-50/30' : ''
                }`}
              >
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                  {getNotificationIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-medium text-gray-900 text-sm">{notification.title}</h3>
                      <p className="text-sm text-gray-600 mt-0.5">{notification.message}</p>
                      <p className="text-xs text-gray-400 mt-1">{formatDate(notification.created_at)}</p>
                    </div>
                    {!notification.is_read && (
                      <div className="w-2 h-2 bg-primary-600 rounded-full flex-shrink-0 mt-1" />
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
