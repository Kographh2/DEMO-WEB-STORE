'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function ServiceWorkerRegistration() {
  const pathname = usePathname()

  useEffect(() => {
    if ('serviceWorker' in navigator && pathname !== '/login' && pathname !== '/register') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('SW registered: ', registration)
        })
        .catch((error) => {
          console.log('SW registration failed: ', error)
        })
    }
  }, [pathname])

  return null
}
