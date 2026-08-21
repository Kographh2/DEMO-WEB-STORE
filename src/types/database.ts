export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
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
        Insert: {
          id?: string
          email: string
          full_name: string
          username: string
          avatar_url?: string | null
          role?: 'owner' | 'admin' | 'seller' | 'customer'
          is_verified?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          username?: string
          avatar_url?: string | null
          role?: 'owner' | 'admin' | 'seller' | 'customer'
          is_verified?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      shops: {
        Row: {
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
        Insert: {
          id?: string
          owner_id: string
          name: string
          description?: string
          logo_url?: string | null
          banner_url?: string | null
          is_verified?: boolean
          auto_verified?: boolean
          rating?: number
          total_reviews?: number
          total_sold?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          description?: string
          logo_url?: string | null
          banner_url?: string | null
          is_verified?: boolean
          auto_verified?: boolean
          rating?: number
          total_reviews?: number
          total_sold?: number
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
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
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          shop_id: string
          name: string
          description?: string
          price: number
          discount_price?: number | null
          discount_percentage?: number | null
          stock?: number
          images?: string[]
          category?: string
          is_active?: boolean
          rating?: number
          total_reviews?: number
          total_sold?: number
          weight?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          shop_id?: string
          name?: string
          description?: string
          price?: number
          discount_price?: number | null
          discount_percentage?: number | null
          stock?: number
          images?: string[]
          category?: string
          is_active?: boolean
          rating?: number
          total_reviews?: number
          total_sold?: number
          weight?: number
          created_at?: string
          updated_at?: string
        }
      }
      follows: {
        Row: {
          id: string
          follower_id: string
          following_id: string
          created_at: string
        }
        Insert: {
          id?: string
          follower_id: string
          following_id: string
          created_at?: string
        }
        Update: {
          id?: string
          follower_id?: string
          following_id?: string
          created_at?: string
        }
      }
      orders: {
        Row: {
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
          shipping_address: Json
          tracking_number: string | null
          transaction_id: string | null
          snap_token: string | null
          snap_redirect_url: string | null
          payment_confirmed_at: string | null
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          seller_id: string
          shop_id: string
          status?: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
          payment_method?: 'cod' | 'midtrans'
          payment_status?: 'pending' | 'paid' | 'failed' | 'expired'
          subtotal: number
          tax_amount?: number
          shipping_cost?: number
          discount_amount?: number
          total_amount: number
          shipping_address: Json
          tracking_number?: string | null
          transaction_id?: string | null
          snap_token?: string | null
          snap_redirect_url?: string | null
          payment_confirmed_at?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          seller_id?: string
          shop_id?: string
          status?: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
          payment_method?: 'cod' | 'midtrans'
          payment_status?: 'pending' | 'paid' | 'failed' | 'expired'
          subtotal?: number
          tax_amount?: number
          shipping_cost?: number
          discount_amount?: number
          total_amount?: number
          shipping_address?: Json
          tracking_number?: string | null
          transaction_id?: string | null
          snap_token?: string | null
          snap_redirect_url?: string | null
          payment_confirmed_at?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          price: number
          subtotal: number
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          price: number
          subtotal: number
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          price?: number
          subtotal?: number
          created_at?: string
        }
      }
      payment_notifications: {
        Row: {
          id: string
          order_id: string
          transaction_id: string
          status: string
          response_data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          transaction_id: string
          status: string
          response_data?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          transaction_id?: string
          status?: string
          response_data?: Json | null
          created_at?: string
        }
      }
    }
    Views: {}
    Functions: {}
  }
}
