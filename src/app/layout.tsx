import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import LoadingScreen from '@/components/loading-screen'
import BottomNavbar from '@/components/bottom-navbar'
import DesktopNavbar from '@/components/desktop-navbar'
import ServiceWorkerRegistration from '@/components/service-worker-registration'

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#3b82f6',
}

export const metadata: Metadata = {
  title: 'Kograph Store - Toko Online Minimalis',
  description: 'Platform jual beli online dengan sistem toko dan seller',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Kograph Store',
  },
  formatDetection: {
    telephone: false,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id">
      <body className={inter.className}>
        <ServiceWorkerRegistration />
        <Providers>
          <LoadingScreen />
          <DesktopNavbar />
          <main className="min-h-screen bg-gray-50 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0 lg:pt-16">
            {children}
          </main>
          <BottomNavbar />
        </Providers>
      </body>
    </html>
  )
}
