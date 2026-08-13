-- Perbaikan akses owner untuk API internal dan broadcast email.
-- Jalankan sekali di Supabase SQL Editor.

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(trim(role))
  from public.profiles
  where id = auth.uid()
  limit 1;
$$;

revoke all on function public.current_profile_role() from public;
grant execute on function public.current_profile_role() to authenticated;

-- Memastikan profile pengguna Auth yang belum mempunyai profile dibuat kembali.
-- Username memakai UUID agar tidak bentrok dengan username yang sudah ada.
insert into public.profiles (id, email, full_name, username)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
  coalesce(u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1)) || '-' || substr(u.id::text, 1, 8)
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null and u.email is not null
on conflict (id) do nothing;

-- Pastikan owner yang ada tercatat eksplisit dengan role yang dapat dipakai RLS.
update public.profiles
set role = lower(trim(role))
where role is not null and role <> lower(trim(role));
