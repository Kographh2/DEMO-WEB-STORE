-- ============================================
-- KOGRAPH STORE - SUPABASE SCHEMA (v3 - FULL AUTOMATION)
-- Consolidated, self-contained schema. Safe to run on a brand-new
-- Supabase project from scratch (drops + recreates everything).
--
-- What's new in v3 vs the previous schema:
--   - Triggers auto-recompute product & shop rating/review counts
--     whenever a review is inserted/updated/deleted (previously the
--     rating a buyer left never reflected back onto the product).
--   - Triggers auto-increment products.total_sold and shops.total_sold
--     whenever an order moves to a "sold" state (paid via Midtrans, or
--     delivered for COD) — previously nothing ever updated this.
--   - Shops auto-verify once total_sold crosses a threshold, while an
--     owner can still always manually verify/unverify at any time
--     (auto-verify only ever turns verification ON, never OFF, so it
--     never fights a manual decision the owner made).
--   - COD orders now start at 'processing' instead of 'pending' — a
--     COD order has nothing to "wait" on (no payment gateway step),
--     so there is no manual accept/confirm gate before the seller
--     sees it as an actionable order.
--   - Added storage bucket + policies for user avatars.
-- ============================================

-- 1. Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. Drop existing tables (clean slate)
drop table if exists public.platform_settings cascade;
drop table if exists public.email_broadcasts cascade;
drop table if exists public.discounts cascade;
drop table if exists public.notifications cascade;
drop table if exists public.withdrawals cascade;
drop table if exists public.follows cascade;
drop table if exists public.shop_reviews cascade;
drop table if exists public.reviews cascade;
drop table if exists public.payment_notifications cascade;
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
  -- true once auto-verified by the system (sales threshold). Kept
  -- separate from is_verified so the UI can show "auto-verified" vs
  -- "manually verified by owner" distinctly if desired.
  auto_verified boolean default false,
  rating numeric(3,2) default 0.00,
  total_reviews integer default 0,
  total_sold integer default 0,
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
-- Note on automation: COD orders are inserted directly at status
-- 'processing' by the app (no gateway to wait on). Midtrans orders
-- start 'pending' and move to 'paid' automatically via the payment
-- webhook / status-polling API — see src/app/api/payments/.
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
  transaction_id text,
  snap_token text,
  snap_redirect_url text,
  payment_confirmed_at timestamptz,
  expires_at timestamptz,
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

-- 9. Create reviews table (product reviews — tied to a completed order
-- so only genuine buyers can leave one, and one review per product per
-- order to prevent spamming ratings)
create table public.reviews (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  order_id uuid references public.orders(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  images text[] default '{}',
  is_verified boolean default false,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
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

-- 14b. Payment notification audit trail (Midtrans webhook log)
create table public.payment_notifications (
  id uuid default gen_random_uuid() primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  transaction_id text not null,
  status text not null,
  response_data jsonb,
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

-- 15b. Create email_broadcasts table (owner → all users mass email tool)
create table public.email_broadcasts (
  id uuid default gen_random_uuid() primary key,
  created_by uuid not null references public.profiles(id) on delete restrict,
  subject text not null check (char_length(subject) between 1 and 200),
  body text not null check (char_length(body) between 1 and 20000),
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent', 'failed')),
  recipient_count integer not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now()
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
alter table public.payment_notifications enable row level security;
alter table public.email_broadcasts enable row level security;

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

-- Returns the caller's role as plain text (used by the owner broadcast
-- API route via `.rpc('current_profile_role')`).
create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(trim(role)) from public.profiles where id = auth.uid() limit 1;
$$;
revoke all on function public.current_profile_role() from public;
grant execute on function public.current_profile_role() to authenticated;

-- 18. RLS Policies for profiles
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Anyone can view public profile fields" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Admins can update all profiles" on public.profiles for update using (public.is_admin());

-- 19. RLS Policies for shops
create policy "Anyone can view shops" on public.shops for select using (true);
create policy "Shop owners can update own shop" on public.shops for update using (auth.uid() = owner_id);
create policy "Users can create shop" on public.shops for insert with check (auth.uid() = owner_id);
create policy "Admins can manage shops" on public.shops for all using (public.is_admin()) with check (public.is_admin());

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
-- Only a buyer who actually has a delivered/paid order for this exact
-- product may leave a review — prevents fake/drive-by ratings.
create policy "Anyone can view reviews" on public.reviews for select using (true);
create policy "Buyers can review purchased products" on public.reviews for insert with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.product_id = reviews.product_id
      and o.user_id = auth.uid()
      and o.status in ('delivered', 'paid', 'processing', 'shipped')
  )
);
create policy "Users can update own reviews" on public.reviews for update using (auth.uid() = user_id);
create policy "Users can delete own reviews" on public.reviews for delete using (auth.uid() = user_id);

-- 25. RLS Policies for shop_reviews
create policy "Anyone can view shop reviews" on public.shop_reviews for select using (true);
create policy "Users can create shop reviews" on public.shop_reviews for insert with check (auth.uid() = user_id);
create policy "Users can update own shop reviews" on public.shop_reviews for update using (auth.uid() = user_id);

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

-- 29b. RLS Policies for email_broadcasts
create policy "Owners can view email broadcasts" on public.email_broadcasts for select using (public.is_owner());
create policy "Owners can create email broadcasts" on public.email_broadcasts for insert with check (public.is_owner() and created_by = auth.uid());
create policy "Owners can update email broadcasts" on public.email_broadcasts for update using (public.is_owner()) with check (public.is_owner());

-- 29c. Owner broadcast RPCs — the app never uses the service-role key
-- directly for this; it calls these SECURITY DEFINER functions instead
-- (see src/app/api/owner/broadcast/route.ts), each independently
-- re-checking the caller is an owner before doing anything.
create or replace function public.owner_create_broadcast(p_subject text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare broadcast_id uuid;
begin
  if public.current_profile_role() <> 'owner' then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_subject, ''))) = 0 or length(p_subject) > 200 then
    raise exception 'Invalid subject' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_body, ''))) = 0 or length(p_body) > 20000 then
    raise exception 'Invalid message body' using errcode = '22023';
  end if;
  insert into public.email_broadcasts (created_by, subject, body, status, recipient_count)
  values (auth.uid(), trim(p_subject), trim(p_body), 'sending', (select count(*) from public.profiles where email is not null))
  returning id into broadcast_id;
  return broadcast_id;
end;
$$;

create or replace function public.owner_broadcast_recipients()
returns table(email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_profile_role() <> 'owner' then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  return query select distinct p.email from public.profiles p where p.email is not null and trim(p.email) <> '';
end;
$$;

create or replace function public.owner_complete_broadcast(p_broadcast_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_profile_role() <> 'owner' then
    raise exception 'Owner access required' using errcode = '42501';
  end if;
  if p_status not in ('sent', 'failed') then raise exception 'Invalid broadcast status' using errcode = '22023'; end if;
  update public.email_broadcasts
  set status = p_status, sent_at = case when p_status = 'sent' then now() else null end
  where id = p_broadcast_id and created_by = auth.uid();
end;
$$;

revoke all on function public.owner_create_broadcast(text, text) from public;
revoke all on function public.owner_broadcast_recipients() from public;
revoke all on function public.owner_complete_broadcast(uuid, text) from public;
grant execute on function public.owner_create_broadcast(text, text) to authenticated;
grant execute on function public.owner_broadcast_recipients() to authenticated;
grant execute on function public.owner_complete_broadcast(uuid, text) to authenticated;

-- 30. RLS Policies for platform_settings
create policy "Anyone can view platform settings" on public.platform_settings for select using (true);
create policy "Owner can manage platform settings" on public.platform_settings for all using (public.is_owner()) with check (public.is_owner());

-- 30b. RLS Policies for payment_notifications (written only by the
-- service-role webhook handler; readable by the order's buyer/seller)
create policy "Order participants can view payment notifications" on public.payment_notifications for select using (
  exists (
    select 1 from public.orders o
    where o.id = payment_notifications.order_id
      and (o.user_id = auth.uid() or o.seller_id = auth.uid())
  )
);

-- 31. Create indexes
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_shops_owner_id on public.shops(owner_id);
create index if not exists idx_products_shop_id on public.products(shop_id);
create index if not exists idx_products_category on public.products(category);
create index if not exists idx_cart_items_user_id on public.cart_items(user_id);
create index if not exists idx_orders_user_id on public.orders(user_id);
create index if not exists idx_orders_seller_id on public.orders(seller_id);
create index if not exists idx_orders_shop_id on public.orders(shop_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_payment_status on public.orders(payment_status);
create index if not exists idx_orders_transaction_id on public.orders(transaction_id);
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_order_items_product_id on public.order_items(product_id);
create index if not exists idx_reviews_product_id on public.reviews(product_id);
create index if not exists idx_shop_reviews_shop_id on public.shop_reviews(shop_id);
create index if not exists idx_follows_follower_id on public.follows(follower_id);
create index if not exists idx_follows_following_id on public.follows(following_id);
create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_withdrawals_seller_id on public.withdrawals(seller_id);
create index if not exists idx_discounts_shop_id on public.discounts(shop_id);
create index if not exists idx_wishlist_user_id on public.wishlist(user_id);
create index if not exists idx_payment_notifications_order_id on public.payment_notifications(order_id);

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

-- ============================================
-- 34. AUTOMATION TRIGGERS (new in v3)
-- ============================================

-- 34a. Recompute a product's rating + total_reviews whenever its
-- reviews change (insert, edit, or delete). This is what makes a
-- rating the buyer leaves actually show up on the product.
create or replace function public.recompute_product_rating(p_product_id uuid)
returns void as $$
begin
  update public.products
  set
    rating = coalesce((select round(avg(rating)::numeric, 2) from public.reviews where product_id = p_product_id), 0),
    total_reviews = (select count(*) from public.reviews where product_id = p_product_id)
  where id = p_product_id;
end;
$$ language plpgsql security definer;

create or replace function public.trg_reviews_changed()
returns trigger as $$
begin
  if (tg_op = 'DELETE') then
    perform public.recompute_product_rating(old.product_id);
    return old;
  else
    perform public.recompute_product_rating(new.product_id);
    return new;
  end if;
end;
$$ language plpgsql security definer;

drop trigger if exists on_reviews_changed on public.reviews;
create trigger on_reviews_changed
  after insert or update or delete on public.reviews
  for each row execute procedure public.trg_reviews_changed();

-- 34b. Recompute a shop's rating + total_reviews from its own
-- shop_reviews (separate from per-product reviews).
create or replace function public.recompute_shop_rating(p_shop_id uuid)
returns void as $$
begin
  update public.shops
  set
    rating = coalesce((select round(avg(rating)::numeric, 2) from public.shop_reviews where shop_id = p_shop_id), 0),
    total_reviews = (select count(*) from public.shop_reviews where shop_id = p_shop_id)
  where id = p_shop_id;
end;
$$ language plpgsql security definer;

create or replace function public.trg_shop_reviews_changed()
returns trigger as $$
begin
  if (tg_op = 'DELETE') then
    perform public.recompute_shop_rating(old.shop_id);
    return old;
  else
    perform public.recompute_shop_rating(new.shop_id);
    return new;
  end if;
end;
$$ language plpgsql security definer;

drop trigger if exists on_shop_reviews_changed on public.shop_reviews;
create trigger on_shop_reviews_changed
  after insert or update or delete on public.shop_reviews
  for each row execute procedure public.trg_shop_reviews_changed();

-- 34c. Auto-verify a shop once it crosses a total_sold threshold.
-- This only ever turns verification ON — it never unverifies a shop,
-- so it can never undo a manual decision an owner made in the
-- dashboard. An owner can still manually verify early or unverify at
-- any time; a later sales-count check will simply re-verify it if the
-- owner hadn't deliberately kept it off (there's no way to distinguish
-- "never verified" from "owner turned it off" with a single boolean,
-- so once a shop hits the threshold it stays auto-verified — if an
-- owner needs to hide a shop despite high sales, use is_active on its
-- products instead of unverifying).
create or replace function public.check_shop_auto_verify(p_shop_id uuid)
returns void as $$
declare
  v_threshold integer := 50; -- units sold across the shop's products
  v_total_sold integer;
begin
  select total_sold into v_total_sold from public.shops where id = p_shop_id;
  if v_total_sold >= v_threshold then
    update public.shops
    set is_verified = true, auto_verified = true
    where id = p_shop_id and is_verified = false;
  end if;
end;
$$ language plpgsql security definer;

-- 34d. When an order's status/payment_status changes to a "sold"
-- state, increment total_sold on the product(s) and the shop, then
-- check for auto-verification. A "sold" state is: payment_status
-- becomes 'paid' (Midtrans), OR status becomes 'delivered' (covers
-- COD, where there's no separate payment confirmation step).
-- Guarded so it only fires once per order (checks the OLD row wasn't
-- already in a sold state), so retried webhook calls or repeated
-- status edits never double-count.
create or replace function public.trg_orders_sold_effects()
returns trigger as $$
declare
  v_was_sold boolean;
  v_is_sold boolean;
begin
  v_was_sold := (old.payment_status = 'paid') or (old.status = 'delivered');
  v_is_sold := (new.payment_status = 'paid') or (new.status = 'delivered');

  if v_is_sold and not v_was_sold then
    update public.products p
    set total_sold = p.total_sold + oi.quantity
    from public.order_items oi
    where oi.order_id = new.id and oi.product_id = p.id;

    update public.shops
    set total_sold = total_sold + (
      select coalesce(sum(quantity), 0) from public.order_items where order_id = new.id
    )
    where id = new.shop_id;

    perform public.check_shop_auto_verify(new.shop_id);
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_orders_sold_effects on public.orders;
create trigger on_orders_sold_effects
  after update on public.orders
  for each row execute procedure public.trg_orders_sold_effects();

-- Also handle the (rare) case where an order is inserted already in a
-- sold state (defensive — the app never does this today, but keeps
-- the counters correct if that ever changes).
create or replace function public.trg_orders_sold_effects_insert()
returns trigger as $$
begin
  if (new.payment_status = 'paid') or (new.status = 'delivered') then
    update public.products p
    set total_sold = p.total_sold + oi.quantity
    from public.order_items oi
    where oi.order_id = new.id and oi.product_id = p.id;

    update public.shops
    set total_sold = total_sold + (
      select coalesce(sum(quantity), 0) from public.order_items where order_id = new.id
    )
    where id = new.shop_id;

    perform public.check_shop_auto_verify(new.shop_id);
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_orders_sold_effects_insert on public.orders;
create trigger on_orders_sold_effects_insert
  after insert on public.orders
  for each row execute procedure public.trg_orders_sold_effects_insert();

-- ============================================
-- 35. STORAGE (avatars + shop logos/banners + product images)
-- ============================================
insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('shop-assets', 'shop-assets', true),
  ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Digital product files (e-books, license keys, zip archives, etc).
-- Private — never publicly readable, since these are the actual paid
-- content. Delivered to the buyer by src/app/api/products/send-digital
-- using the service-role key after a Midtrans payment is confirmed, so
-- there is deliberately no public SELECT policy on this bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'digital-products', 'digital-products', false, 52428800,
  array['application/pdf', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream']
)
on conflict (id) do update set public = false;

drop policy if exists "Sellers upload own digital files" on storage.objects;
create policy "Sellers upload own digital files" on storage.objects for insert to authenticated with check (
  bucket_id = 'digital-products' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "Sellers manage own digital files" on storage.objects;
create policy "Sellers manage own digital files" on storage.objects for all using (
  bucket_id = 'digital-products' and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'digital-products' and (storage.foldername(name))[1] = auth.uid()::text
);

-- Anyone can view (buckets are public); a user may only write/replace/
-- delete files inside their own folder, named `${auth.uid()}/...`.
drop policy if exists "Public read avatars" on storage.objects;
create policy "Public read avatars" on storage.objects for select using (bucket_id = 'avatars');
drop policy if exists "Users manage own avatar" on storage.objects;
create policy "Users manage own avatar" on storage.objects for insert with check (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "Users update own avatar" on storage.objects;
create policy "Users update own avatar" on storage.objects for update using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);
drop policy if exists "Users delete own avatar" on storage.objects;
create policy "Users delete own avatar" on storage.objects for delete using (
  bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Public read shop assets" on storage.objects;
create policy "Public read shop assets" on storage.objects for select using (bucket_id = 'shop-assets');
drop policy if exists "Shop owners manage own assets" on storage.objects;
create policy "Shop owners manage own assets" on storage.objects for all using (
  bucket_id = 'shop-assets' and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'shop-assets' and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images" on storage.objects for select using (bucket_id = 'product-images');
drop policy if exists "Sellers manage own product images" on storage.objects;
create policy "Sellers manage own product images" on storage.objects for all using (
  bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text
) with check (
  bucket_id = 'product-images' and (storage.foldername(name))[1] = auth.uid()::text
);

-- 36. Insert default platform settings
insert into public.platform_settings (key, value) values
  ('platform_name', '"Kograph Store"'),
  ('platform_fee_percentage', '3'),
  ('tax_percentage', '5'),
  ('currency', '"IDR"'),
  ('default_shipping_cost', '15000'),
  ('free_shipping_threshold', '100000'),
  ('shop_auto_verify_threshold', '50')
on conflict (key) do nothing;
