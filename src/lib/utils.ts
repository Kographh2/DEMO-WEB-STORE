import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { supabase } from '@/lib/supabase'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Single source of truth for a product's actual charged unit price.
 * Every place in the app that displays or calculates a price MUST use
 * this — using `product.price` directly in one place and
 * `product.discount_price ?? product.price` in another is exactly how
 * a checkout can show one price for a line item ("Rp 150.000") while
 * charging a different, lower one for the actual subtotal/total sent
 * to Midtrans ("Rp 50.000").
 */
export function getUnitPrice(product: { price: number; discount_price?: number | null } | null | undefined): number {
  if (!product) return 0
  return product.discount_price ?? product.price
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function calculateTax(amount: number, taxRate = 0.05) {
  return Math.round(amount * taxRate)
}

export function calculateCommission(amount: number, platformFeeRate = 0.03) {
  return Math.round(amount * platformFeeRate)
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function generateOrderId() {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `ORD-${timestamp}-${random}`.toUpperCase()
}

/**
 * Uploads an avatar image to the `avatars` Supabase Storage bucket
 * under the current user's own folder (required by the bucket's RLS
 * policy: `(storage.foldername(name))[1] = auth.uid()`), and returns
 * the public URL to store on the profile.
 */
export async function uploadAvatar(file: File, userId: string): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'jpg'
  const filePath = `${userId}/avatar-${Date.now()}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true, cacheControl: '3600' })

  if (uploadError) {
    throw uploadError
  }

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
  return data.publicUrl
}
