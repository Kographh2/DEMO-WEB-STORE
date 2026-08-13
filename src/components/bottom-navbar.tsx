'use client'

import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Home, Search, ShoppingCart, User, Store, Shield, BarChart3 } from 'lucide-react'
import { useCart } from '@/components/cart-provider'
import { useAuth } from '@/components/auth-provider'

function getNavItems(role?: string) {
  const items = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/search', icon: Search, label: 'Search' },
    { href: '/cart', icon: ShoppingCart, label: 'Cart', showBadge: true },
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

export default function BottomNavbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { totalItems } = useCart()
  const { profile } = useAuth()

  const shouldShowNavbar = () => {
    if (pathname === '/login' || pathname === '/register') return false
    if (pathname.startsWith('/auth/')) return false
    return true
  }

  if (!shouldShowNavbar()) return null

  const navItems = getNavItems(profile?.role)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden">
      <div className="liquid-glass pb-safe">
        <div className="flex items-center justify-around py-2 px-4 max-w-lg mx-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/' && pathname.startsWith(item.href))
            
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className="relative flex flex-col items-center gap-0.5 p-2 rounded-xl transition-colors"
              >
                <div className="relative">
                  <item.icon
                    size={24}
                    className={`transition-colors duration-200 ${
                      isActive ? 'text-primary-600' : 'text-gray-400'
                    }`}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  {item.showBadge && totalItems > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1.5 -right-2 bg-primary-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
                    >
                      {totalItems > 99 ? '99+' : totalItems}
                    </motion.span>
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium transition-colors duration-200 ${
                    isActive ? 'text-primary-600' : 'text-gray-400'
                  }`}
                >
                  {item.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="navbar-indicator"
                    className="absolute -top-1 w-1 h-1 bg-primary-600 rounded-full"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
