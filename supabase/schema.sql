-- ============================================
-- KOGRAPH STORE - SUPABASE SCHEMA (FINAL)
-- ============================================

-- 1. Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. Drop existing tables (clean slate)
drop table if exists public.platform_settings cascade;
drop table if exists public.discounts cascade;
drop table if exists public.notifications cascade;
drop table if exists public.withdrawals cascade;
drop table if exists public.follows cascade;
drop table if exists public.shop_reviews cascade;
drop table if exists public.reviews cascade;
drop table if exists public.order_items cascade;
drop table if exists public.orders cascade;
drop table if exists public.cart_items cascade;
drop table if exists public.wishlist cascade;
drop table if exists public.products cascade;
drop table if exists public.shops cascade;
drop table if exists public.profiles cascade;

-- 3. Create profiles table
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text unique not null,
  full_name text not null default '',
  username text unique not null default '',
  avatar_url text,
  role text not null default 'customer' check (role in ('owner', 'admin', 'seller', 'customer')),
  is_verified boolean default false,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 4. Create shops table
create table public.shops (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text,
  logo_url text,
  banner_url text,
  is_verified boolean default false,
  rating numeric(3,2) default 0.00,
  total_reviews integer default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 5. Create products table
create table public.products (
  id uuid default gen_random_uuid() primary key,
  shop_id uuid references public.shops(id) on delete cascade not null,
  name text not null,
  description text,
  price numeric(12,2) not null,
  discount_price numeric(12,2),
  discount_percentage integer,
  stock integer not null default 0,
  images text[] default '{}',
  category text,
  is_active boolean default true,
  rating numeric(3,2) default 0.00,
  total_reviews integer default 0,
  total_sold integer default 0,
  weight numeric(8,2) default 0,
  product_type text not null default 'physical' check (product_type in ('physical', 'digital')),
  digital_delivery_content text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 6. Create cart_items table
create table public.cart_items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete cascade not null,
  quantity integer not null default 1,
  created_at timestamptz default now() not null,
  unique(user_id, product_id)
);

-- 7. Create orders table
create table public.orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  seller_id uuid references public.profiles(id) on delete cascade not null,
  shop_id uuid references public.shops(id) on delete cascade not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled')),
  payment_method text not null default 'cod' check (payment_method in ('cod', 'midtrans')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'expired')),
  subtotal numeric(12,2) not null,
  tax_amount numeric(12,2) default 0,
  shipping_cost numeric(12,2) default 0,
  discount_amount numeric(12,2) default 0,
  total_amount numeric(12,2) not null,
  shipping_address jsonb,
  tracking_number text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 8. Create order_items table
create table public.order_items (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete cascade not null,
  product_name text not null,
  quantity integer not null,
  price numeric(12,2) not null,
  subtotal numeric(12,2) not null,
  created_at timestamptz default now() not null
);

-- 9. Create reviews table
create table public.reviews (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  images text[] default '{}',
  is_verified boolean default false,
  created_at timestamptz default now() not null,
  unique(product_id, user_id)
);

-- 10. Create shop_reviews table
create table public.shop_reviews (
  id uuid default gen_random_uuid() primary key,
  shop_id uuid references public.shops(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  is_verified boolean default false,
  created_at timestamptz default now() not null,
  unique(shop_id, user_id)
);

-- 11. Create follows table
create table public.follows (
  id uuid default gen_random_uuid() primary key,
  follower_id uuid references public.profiles(id) on delete cascade not null,
  following_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique(follower_id, following_id)
);

-- 11b. Create wishlist table
create table public.wishlist (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  unique(user_id, product_id)
);

-- 12. Create withdrawals table
create table public.withdrawals (
  id uuid default gen_random_uuid() primary key,
  seller_id uuid references public.profiles(id) on delete cascade not null,
  amount numeric(12,2) not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'completed')),
  bank_name text not null,
  account_number text not null,
  account_name text not null,
  notes text,
  processed_by uuid references public.profiles(id),
  processed_at timestamptz,
  created_at timestamptz default now() not null
);

-- 13. Create notifications table
create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  message text not null,
  type text not null default 'system' check (type in ('order', 'payment', 'follow', 'review', 'system', 'withdrawal')),
  is_read boolean default false,
  data jsonb default '{}',
  created_at timestamptz default now() not null
);

-- 14. Create discounts table
create table public.discounts (
  id uuid default gen_random_uuid() primary key,
  shop_id uuid references public.shops(id) on delete cascade,
  code text unique not null,
  type text not null default 'percentage' check (type in ('percentage', 'fixed')),
  value numeric(12,2) not null,
  min_purchase numeric(12,2) default 0,
  max_discount numeric(12,2),
  is_active boolean default true,
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  usage_limit integer,
  used_count integer default 0,
  created_at timestamptz default now() not null
);

-- 15. Create platform_settings table
create table public.platform_settings (
  id uuid default gen_random_uuid() primary key,
  key text unique not null,
  value jsonb not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- 16. Enable RLS
alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.products enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.reviews enable row level security;
alter table public.shop_reviews enable row level security;
alter table public.follows enable row level security;
alter table public.withdrawals enable row level security;
alter table public.notifications enable row level security;
alter table public.discounts enable row level security;
alter table public.platform_settings enable row level security;
alter table public.wishlist enable row level security;

-- 17. Helper function to check admin status (avoid recursion)
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.profiles 
    where id = auth.uid() 
    and role in ('owner', 'admin')
  );
end;
$$ language plpgsql security definer;

create or replace function public.is_owner()
returns boolean as $$
begin
  return exists (select 1 from public.profiles where id = auth.uid() and role = 'owner');
end;
$$ language plpgsql security definer;

-- 18. RLS Policies for profiles
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Admins can view all profiles" on public.profiles for select using (public.is_admin());
create policy "Admins can update all profiles" on public.profiles for update using (public.is_admin());

-- 19. RLS Policies for shops
create policy "Anyone can view shops" on public.shops for select using (true);
create policy "Shop owners can update own shop" on public.shops for update using (auth.uid() = owner_id);
create policy "Users can create shop" on public.shops for insert with check (auth.uid() = owner_id);

-- 20. RLS Policies for products
create policy "Anyone can view active products" on public.products for select using (is_active = true);
create policy "Shop owners can manage own products" on public.products for all using (
  exists (select 1 from public.shops where id = shop_id and owner_id = auth.uid())
);

-- 21. RLS Policies for cart_items
create policy "Users can manage own cart" on public.cart_items for all using (auth.uid() = user_id);

-- 22. RLS Policies for orders
create policy "Users can view own orders" on public.orders for select using (auth.uid() = user_id);
create policy "Sellers can view shop orders" on public.orders for select using (
  exists (select 1 from public.shops where id = shop_id and owner_id = auth.uid())
);
create policy "Users can create orders" on public.orders for insert with check (auth.uid() = user_id);
create policy "Sellers can update shop orders" on public.orders for update using (
  exists (select 1 from public.shops where id = shop_id and owner_id = auth.uid())
) with check (
  exists (select 1 from public.shops where id = shop_id and owner_id = auth.uid())
);
create policy "Admins can manage orders" on public.orders for all using (public.is_admin()) with check (public.is_admin());

-- 23. RLS Policies for order_items
create policy "Users can view own order items" on public.order_items for select using (
  exists (select 1 from public.orders where id = order_id and user_id = auth.uid())
);
create policy "Users can create order items" on public.order_items for insert with check (
  exists (select 1 from public.orders where id = order_id and user_id = auth.uid())
);
create policy "Sellers can view shop order items" on public.order_items for select using (
  exists (
    select 1 from public.orders o join public.shops s on s.id = o.shop_id
    where o.id = order_id and s.owner_id = auth.uid()
  )
);

-- 24. RLS Policies for reviews
create policy "Anyone can view reviews" on public.reviews for select using (true);
create policy "Users can create reviews" on public.reviews for insert with check (auth.uid() = user_id);
create policy "Users can update own reviews" on public.reviews for update using (auth.uid() = user_id);

-- 25. RLS Policies for shop_reviews
create policy "Anyone can view shop reviews" on public.shop_reviews for select using (true);
create policy "Users can create shop reviews" on public.shop_reviews for insert with check (auth.uid() = user_id);

-- 26. RLS Policies for follows
create policy "Users can view follows" on public.follows for select using (true);
create policy "Users can manage own follows" on public.follows for all using (auth.uid() = follower_id);

-- 27. RLS Policies for withdrawals
create policy "Admins can view withdrawals" on public.withdrawals for select using (public.is_admin());
create policy "Sellers can view own withdrawals" on public.withdrawals for select using (auth.uid() = seller_id);
create policy "Sellers can create withdrawals" on public.withdrawals for insert with check (auth.uid() = seller_id);
create policy "Admins can update withdrawals" on public.withdrawals for update using (public.is_admin()) with check (public.is_admin());

-- 27b. RLS Policies for wishlist
create policy "Users can view own wishlist" on public.wishlist for select using (auth.uid() = user_id);
create policy "Users can manage own wishlist" on public.wishlist for all using (auth.uid() = user_id);

-- 28. RLS Policies for notifications
create policy "Users can view own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "Users can update own notifications" on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 29. RLS Policies for discounts
create policy "Anyone can view active discounts" on public.discounts for select using (is_active = true);
create policy "Shop owners can manage own discounts" on public.discounts for all using (
  exists (select 1 from public.shops where id = shop_id and owner_id = auth.uid())
);

-- 30. RLS Policies for platform_settings
create policy "Anyone can view platform settings" on public.platform_settings for select using (true);
create policy "Owner can manage platform settings" on public.platform_settings for all using (public.is_owner()) with check (public.is_owner());

-- 31. Create indexes
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_shops_owner_id on public.shops(owner_id);
create index if not exists idx_products_shop_id on public.products(shop_id);
create index if not exists idx_products_category on public.products(category);
create index if not exists idx_cart_items_user_id on public.cart_items(user_id);
create index if not exists idx_orders_user_id on public.orders(user_id);
create index if not exists idx_orders_seller_id on public.orders(seller_id);
create index if not exists idx_reviews_product_id on public.reviews(product_id);
create index if not exists idx_follows_follower_id on public.follows(follower_id);
create index if not exists idx_follows_following_id on public.follows(following_id);
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_withdrawals_seller_id on public.withdrawals(seller_id);
create index if not exists idx_discounts_shop_id on public.discounts(shop_id);
create index if not exists idx_wishlist_user_id on public.wishlist(user_id);

-- 32. Create function to handle new user registration
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)) || '-' || substr(new.id::text, 1, 8)
  );
  return new;
end;
$$ language plpgsql security definer;

-- 33. Create trigger for new user
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 34. Insert default platform settings
insert into public.platform_settings (key, value) values
  ('platform_name', '"Kograph Store"'),
  ('platform_fee_percentage', '3'),
  ('tax_percentage', '5'),
  ('currency', '"IDR"'),
  ('default_shipping_cost', '15000'),
  ('free_shipping_threshold', '100000')
on conflict (key) do nothing;
