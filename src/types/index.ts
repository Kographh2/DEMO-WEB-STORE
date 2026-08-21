export interface Profile {
  id: string
  email: string
  full_name: string
  username: string
  avatar_url: string | null
  role: 'owner' | 'admin' | 'seller' | 'customer'
  is_verified: boolean
  created_at: string
  updated_at: string
}

export interface Shop {
  id: string
  owner_id: string
  name: string
  description: string
  logo_url: string | null
  banner_url: string | null
  is_verified: boolean
  auto_verified: boolean
  rating: number
  total_reviews: number
  total_sold: number
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  shop_id: string
  name: string
  description: string
  price: number
  discount_price: number | null
  discount_percentage: number | null
  stock: number
  images: string[]
  category: string
  is_active: boolean
  rating: number
  total_reviews: number
  total_sold: number
  weight: number
  product_type?: 'physical' | 'digital'
  digital_delivery_content?: string | null
  created_at: string
  updated_at: string
}

export interface CartItem {
  id: string
  user_id: string
  product_id: string
  quantity: number
  created_at: string
  product?: Product
}

export interface Order {
  id: string
  user_id: string
  seller_id: string
  shop_id: string
  status: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  payment_method: 'cod' | 'midtrans'
  payment_status: 'pending' | 'paid' | 'failed' | 'expired'
  subtotal: number
  tax_amount: number
  shipping_cost: number
  discount_amount: number
  total_amount: number
  shipping_address: any
  tracking_number: string | null
  transaction_id?: string | null
  snap_token?: string | null
  snap_redirect_url?: string | null
  payment_confirmed_at?: string | null
  expires_at?: string | null
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  product_name: string
  quantity: number
  price: number
  subtotal: number
  created_at: string
}

export interface Review {
  id: string
  product_id: string
  order_id: string | null
  user_id: string
  rating: number
  comment: string
  images: string[]
  is_verified: boolean
  created_at: string
  updated_at: string
}

export interface Follow {
  id: string
  follower_id: string
  following_id: string
  created_at: string
}

export interface Withdrawal {
  id: string
  seller_id: string
  amount: number
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  bank_name: string
  account_number: string
  account_name: string
  notes: string | null
  processed_by: string | null
  processed_at: string | null
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: 'order' | 'payment' | 'follow' | 'review' | 'system' | 'withdrawal'
  is_read: boolean
  data: any
  created_at: string
}

export interface Discount {
  id: string
  shop_id: string | null
  code: string
  type: 'percentage' | 'fixed'
  value: number
  min_purchase: number
  max_discount: number | null
  is_active: boolean
  valid_from: string
  valid_until: string
  usage_limit: number | null
  used_count: number
  created_at: string
}

export interface PlatformSetting {
  id: string
  key: string
  value: any
  created_at: string
  updated_at: string
}
