-- Broadcast owner tanpa mengandalkan service-role key pada aplikasi.
-- Jalankan setelah 20260812_owner_access_and_broadcast_repair.sql.

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
