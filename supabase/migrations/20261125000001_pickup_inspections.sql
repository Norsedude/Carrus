-- F6 Pickup condition check (US-C-05, US-P-05, US-P-06; test cases TC-PC01 to TC-PC04).
--
-- 1. The partner confirms the vehicle is clean and the fuel level is Full
--    (booking state confirmed -> ready_for_pickup).
-- 2. The customer records exterior damage, fuel level and cleanliness with one
--    photo per category and acknowledges the record
--    (ready_for_pickup -> active).
--
-- Photos are stored in a private bucket that only trusted server code can read
-- or write. Pages show them through short-lived signed URLs, and only after
-- row-level security has confirmed that the viewer may see the booking.
-- The return inspection (F7) reuses these tables with stage = 'return'.

-- ------------------------------------------------------------ preparation
alter table public.bookings
  add column ready_at timestamptz,
  add column ready_by uuid references auth.users (id);

-- ------------------------------------------------------------ inspections
create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  stage text not null check (stage in ('pickup', 'return')),
  performed_by uuid not null references auth.users (id),
  performed_role text not null check (performed_role in ('customer', 'partner')),
  exterior_damage text not null check (exterior_damage in ('None', 'Minor', 'Major')),
  fuel_level text not null check (fuel_level in ('Full', '3/4', '1/2', '1/4', 'Empty')),
  cleanliness text not null check (cleanliness in ('Clean', 'Light dirt', 'Dirty')),
  acknowledged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- One record per stage: a saved inspection is never overwritten.
  unique (booking_id, stage)
);

create table public.inspection_photos (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  category text not null check (category in ('exterior', 'fuel_gauge', 'interior')),
  storage_path text not null unique,
  content_type text not null check (content_type in ('image/jpeg', 'image/png')),
  -- 10 MB = 10 * 1024 * 1024 bytes (OPEN_QUESTIONS Q-08).
  size_bytes int not null check (size_bytes between 1 and 10485760),
  uploaded_at timestamptz not null default now(),
  unique (inspection_id, category)
);
create index inspection_photos_inspection_idx on public.inspection_photos (inspection_id);

-- Private bucket: no storage.objects policies are added, so browsers cannot
-- read or write it directly. The bucket also enforces the type and size rules.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inspection-photos', 'inspection-photos', false, 10485760, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- -------------------------------------------------------------- functions

-- TC-PC01. The partner marks a confirmed reservation ready for pickup after
-- confirming the vehicle is clean and fully fueled. Runs as the signed-in
-- partner; ownership is checked here, not trusted from the caller.
create function public.mark_ready_for_pickup(_booking uuid, _vehicle_clean boolean, _fuel_full boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  b public.bookings;
begin
  select * into b from public.bookings where id = _booking for update;
  if not found or not private.owns_verified_partner(b.partner_id) then
    raise exception 'Reservation not found' using errcode = 'P0002';
  end if;
  if b.state <> 'confirmed' then
    raise exception 'Only a confirmed reservation can be marked ready for pickup' using errcode = '22023';
  end if;
  if not coalesce(_vehicle_clean, false) or not coalesce(_fuel_full, false) then
    raise exception 'Confirm that the vehicle is clean and the fuel level is Full' using errcode = '22023';
  end if;
  update public.bookings
    set state = 'ready_for_pickup', ready_at = now(), ready_by = uid, updated_at = now()
    where id = _booking;
  insert into public.audit_events (actor_id, action, target_type, target_id, reason)
  values (uid, 'booking.ready_for_pickup', 'booking', _booking::text, 'Vehicle clean; fuel level Full');
end;
$$;
revoke execute on function public.mark_ready_for_pickup(uuid, boolean, boolean) from public, anon;
grant execute on function public.mark_ready_for_pickup(uuid, boolean, boolean) to authenticated;

-- TC-PC02 to TC-PC04. Saves the customer's pickup condition check. Server-only:
-- the app authenticates the customer, validates and uploads the three photos,
-- then calls this with the customer's id. Every photo must already exist in the
-- bucket under this booking's folder, so a caller cannot attach someone else's
-- files. Nothing is saved unless all three categories are present.
create function public.record_pickup_inspection(
  _actor uuid,
  _booking uuid,
  _exterior_damage text,
  _fuel_level text,
  _cleanliness text,
  _photos jsonb
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  b public.bookings;
  insp uuid;
  photo jsonb;
  missing text[];
begin
  select * into b from public.bookings where id = _booking for update;
  if not found or b.customer_id <> _actor then
    raise exception 'Reservation not found' using errcode = 'P0002';
  end if;
  if b.state <> 'ready_for_pickup' then
    raise exception 'This reservation is not ready for pickup' using errcode = '22023';
  end if;
  if jsonb_typeof(_photos) is distinct from 'array' then
    raise exception 'Add a photo for each category' using errcode = '22023';
  end if;
  select array_agg(c) into missing
  from unnest(array['exterior', 'fuel_gauge', 'interior']) as c
  where not exists (select 1 from jsonb_array_elements(_photos) x where x ->> 'category' = c);
  if missing is not null or jsonb_array_length(_photos) <> 3 then
    raise exception 'Add a photo for each category' using errcode = '22023';
  end if;
  for photo in select value from jsonb_array_elements(_photos) loop
    if coalesce(photo ->> 'path', '') not like _booking::text || '/pickup/%'
       or not exists (select 1 from storage.objects o
                      where o.bucket_id = 'inspection-photos' and o.name = photo ->> 'path') then
      raise exception 'Photo upload not found' using errcode = '22023';
    end if;
  end loop;

  insert into public.inspections
    (booking_id, stage, performed_by, performed_role, exterior_damage, fuel_level, cleanliness)
  values (_booking, 'pickup', _actor, 'customer', _exterior_damage, _fuel_level, _cleanliness)
  returning id into insp;

  insert into public.inspection_photos (inspection_id, category, storage_path, content_type, size_bytes)
  select insp, x ->> 'category', x ->> 'path', x ->> 'contentType', (x ->> 'sizeBytes')::int
  from jsonb_array_elements(_photos) x;

  update public.bookings set state = 'active', updated_at = now() where id = _booking;
  insert into public.audit_events (actor_id, action, target_type, target_id, reason)
  values (_actor, 'booking.pickup_inspection', 'booking', _booking::text, null);
  return insp;
end;
$$;
revoke execute on function public.record_pickup_inspection(uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.record_pickup_inspection(uuid, uuid, text, text, text, jsonb) to service_role;

-- ------------------------------------------------------------------- RLS
alter table public.inspections enable row level security;
alter table public.inspection_photos enable row level security;

-- New tables would otherwise inherit Supabase's default grants.
revoke all on public.inspections, public.inspection_photos from anon, authenticated;
grant select on public.inspections, public.inspection_photos to authenticated;
grant all on public.inspections, public.inspection_photos to service_role;

-- Visible to the booking's customer, its partner and admins: the bookings
-- policy already limits which bookings the subquery can see.
create policy "booking parties and admin see inspections" on public.inspections for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id));
create policy "booking parties and admin see inspection photos" on public.inspection_photos for select to authenticated
  using (exists (select 1 from public.inspections i where i.id = inspection_id));
