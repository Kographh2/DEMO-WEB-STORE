'use client'

import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { Home, Search, ShoppingCart, User, Store, Shield, BarChart3 } from 'lucide-react'
import { useCart } from '@/components/cart-provider'
import { useAuth } from '@/components/auth-provider'

function getNavItems(role?: string) {
  const items = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/search', icon: Search, label: 'Search' },
    { href: '/cart', icon: ShoppingCart, label: 'Cart' },
  ]

  if (role === 'owner') {
    items.push({ href: '/owner', icon: BarChart3, label: 'Dashboard' })
  } else if (role === 'admin') {
    items.push({ href: '/owner', icon: Shield, label: 'Admin' })
  } else if (role === 'seller') {
    items.push({ href: '/seller', icon: Store, label: 'Seller' })
  }

  items.push({ href: '/profile', icon: User, label: 'Profile' })

  return items
}

export default function DesktopNavbar() {
  const pathname = usePathname()
  const { totalItems } = useCart()
  const { profile } = useAuth()

  const navItems = getNavItems(profile?.role)

  return (
    <nav className="hidden lg:block fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.webp"
              alt="Kograph Store"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="font-bold text-gray-900">Kograph Store</span>
          </Link>

          <div className="flex items-center gap-8">
            {navItems.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/' && pathname.startsWith(item.href))
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    isActive ? 'text-primary-600' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <item.icon size={18} />
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.href === '/cart' && totalItems > 0 && (
                    <span className="bg-primary-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {totalItems}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}
