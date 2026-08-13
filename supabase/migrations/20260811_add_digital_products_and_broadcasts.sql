-- Kograph Store: fitur produk digital, pengiriman email, dan broadcast owner.
-- Aman untuk database yang sudah memakai supabase/schema.sql; tidak menghapus tabel/data.

alter table public.products
  add column if not exists product_type text not null default 'physical'
    check (product_type in ('physical', 'digital')),
  add column if not exists digital_delivery_content text;

alter table public.orders
  add column if not exists fulfillment_type text not null default 'physical'
    check (fulfillment_type in ('physical', 'digital')),
  add column if not exists recipient_email text,
  add column if not exists recipient_phone text,
  add column if not exists digital_delivery_status text not null default 'not_required'
    check (digital_delivery_status in ('not_required', 'pending', 'sent', 'failed')),
  add column if not exists digital_delivered_at timestamptz;

create table if not exists public.email_broadcasts (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  subject text not null check (char_length(subject) between 1 and 200),
  body text not null check (char_length(body) between 1 and 20000),
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent', 'failed')),
  recipient_count integer not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_products_product_type on public.products(product_type);
create index if not exists idx_orders_digital_delivery on public.orders(digital_delivery_status)
  where fulfillment_type = 'digital';

alter table public.email_broadcasts enable row level security;

create policy "Owners can view email broadcasts"
  on public.email_broadcasts for select using (public.is_owner());
create policy "Owners can create email broadcasts"
  on public.email_broadcasts for insert with check (public.is_owner() and created_by = auth.uid());
create policy "Owners can update email broadcasts"
  on public.email_broadcasts for update using (public.is_owner()) with check (public.is_owner());

-- Bucket private: file produk digital tidak dapat diakses tanpa URL bertanda tangan.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'digital-products', 'digital-products', false, 52428800,
  array['application/pdf', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream']
)
on conflict (id) do update set public = false;

create policy "Sellers upload own digital files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'digital-products'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Sellers manage own digital files"
  on storage.objects for all to authenticated
  using (bucket_id = 'digital-products' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'digital-products' and (storage.foldername(name))[1] = auth.uid()::text);

-- File perlu dikirim oleh API server setelah webhook Midtrans valid.
-- Jangan membuat kebijakan SELECT publik untuk bucket ini.
