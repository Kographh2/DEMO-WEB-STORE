-- Migration: Add Digital Product Delivery Tracking and Seller Follow Features
-- Date: 2025-08-13
-- Description: This migration adds support for digital product delivery tracking, 
-- seller follow features, and improves order management.

-- The 'follows' table already exists in the schema for tracking user follows on sellers
-- The 'products' table has 'is_active' field for deactivating products
-- The 'orders' table has 'status' field with 'delivered' status for digital products

-- Add digital product delivery status support (already in place via product_type = 'digital')
-- Add order item tracking for digital products (order_items table already links products)

-- Verify follows table exists and has correct structure
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_name = 'follows'
) as follows_table_exists;

-- Verify products table has is_active field
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_name = 'products' AND column_name = 'is_active'
) as products_is_active_exists;

-- Verify products table has product_type field for digital vs physical
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_name = 'products' AND column_name = 'product_type'
) as products_product_type_exists;

-- Create index for faster follower queries
CREATE INDEX IF NOT EXISTS idx_follows_following_id 
ON public.follows(following_id);

CREATE INDEX IF NOT EXISTS idx_follows_follower_id 
ON public.follows(follower_id);

-- Create index for product type queries
CREATE INDEX IF NOT EXISTS idx_products_product_type 
ON public.products(product_type);

-- Create index for active products queries
CREATE INDEX IF NOT EXISTS idx_products_is_active 
ON public.products(is_active);

-- Create index for order item lookups
CREATE INDEX IF NOT EXISTS idx_order_items_order_id 
ON public.order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_product_id 
ON public.order_items(product_id);
