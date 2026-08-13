'use client'

import { useEffect } from 'react'

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(
        (registration) => {
          console.log('SW registered: ', registration)
        },
        (error) => {
          console.log('SW registration failed: ', error)
        }
      )
    })
  }
}

export function usePushNotifications() {
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          console.log('Notification permission granted.')
        }
      })
    }
  }, [])
}

export function showLocalNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/logo.webp',
      badge: '/logo.webp',
      tag: 'kograph-notification',
    })
  }
}
