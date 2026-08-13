'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { CartItem, Product, Shop } from '@/types'
import { useAuth } from '@/components/auth-provider'
import toast from 'react-hot-toast'

interface CartContextType {
  items: (CartItem & { product: Product & { shop: Shop } })[]
  totalItems: number
  totalAmount: number
  isLoading: boolean
  addToCart: (data: { productId: string; quantity?: number }) => void
  removeFromCart: (productId: string) => void
  updateQuantity: (data: { productId: string; quantity: number }) => void
  clearCart: () => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const userId = user?.id ?? null

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['cart', userId],
    queryFn: async () => {
      if (!userId) return []
      const { data } = await supabase
        .from('cart_items')
        .select(`
          *,
          product:products(
            *,
            shop:shops(id, name, owner_id)
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      
      return data as any[]
    },
    enabled: !!userId,
  })

  const addToCartMutation = useMutation({
    mutationFn: async ({ productId, quantity = 1 }: { productId: string; quantity?: number }) => {
      if (!userId) throw new Error('Not authenticated')

      const { data: existing } = await (supabase as any)
        .from('cart_items')
        .select('*')
        .eq('user_id', userId)
        .eq('product_id', productId)
        .single()

      if (existing) {
        const { data, error } = await (supabase as any)
          .from('cart_items')
          .update({ quantity: (existing as any).quantity + quantity })
          .eq('id', (existing as any).id)
          .select()
          .single()
        
        if (error) throw error
        return data
      } else {
        const { data, error } = await (supabase as any)
          .from('cart_items')
          .insert({ user_id: userId, product_id: productId, quantity })
          .select()
          .single()
        
        if (error) throw error
        return data
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] })
      toast.success('Added to cart')
    },
    onError: () => {
      toast.error('Failed to add to cart')
    },
  })

  const removeFromCartMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!userId) throw new Error('Not authenticated')
      const { error } = await (supabase as any)
        .from('cart_items')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', productId)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] })
      toast.success('Removed from cart')
    },
  })

  const updateQuantityMutation = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: string; quantity: number }) => {
      if (!userId) throw new Error('Not authenticated')
      const { data, error } = await (supabase as any)
        .from('cart_items')
        .update({ quantity })
        .eq('user_id', userId)
        .eq('product_id', productId)
        .select()
        .single()
      
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
  })

  const clearCartMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not authenticated')
      const { error } = await (supabase as any)
        .from('cart_items')
        .delete()
        .eq('user_id', userId)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
  })

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
  const totalAmount = items.reduce((sum, item) => {
    const price = item.product.discount_price ?? item.product.price
    return sum + (price * item.quantity)
  }, 0)

  return (
    <CartContext.Provider
      value={{
        items,
        totalItems,
        totalAmount,
        isLoading,
        addToCart: addToCartMutation.mutate,
        removeFromCart: removeFromCartMutation.mutate,
        updateQuantity: updateQuantityMutation.mutate,
        clearCart: clearCartMutation.mutate,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
