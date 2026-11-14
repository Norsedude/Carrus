-- Carrus foundation schema (Milestone A + booking slice).
-- Conventions: money = integer cents; time = timestamptz (UTC) with the
-- location time zone stored on the vehicle; no client writes to privileged
-- state (roles, verification, quotes, payments, booking transitions).

create extension if not exists btree_gist with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, anon, service_role;

-- ---------------------------------------------------------------- identity
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  phone text check (phone is null or char_length(phone) <= 32),
  account_status text not null default 'active'
    check (account_status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('customer', 'partner', 'admin')),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- True when the caller is trusted server code (service role or a direct
-- database session such as migrations/seeds), never an end-user JWT.
create function private.is_service() returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce(auth.role(), '') = 'service_role'
      or current_user in ('postgres', 'supabase_admin');
$$;

create function private.has_role(_role text) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = (select auth.uid()) and r.role = _role
  );
$$;
grant execute on function private.has_role(text) to authenticated, anon, service_role;
grant execute on function private.is_service() to authenticated, anon, service_role;

create function private.handle_new_user() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80));
  -- Registration grants customer capabilities only.
  insert into public.user_roles (user_id, role) values (new.id, 'customer');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------- supply
create table public.partners (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users (id) on delete restrict,
  kind text not null check (kind in ('individual', 'company')),
  display_name text not null check (char_length(display_name) between 2 and 80),
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Private application details: owner and admins only.
create table public.partner_applications (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null unique references public.partners (id) on delete cascade,
  contact_email text not null,
  contact_phone text,
  fleet_size int not null default 1 check (fleet_size between 1 and 10000),
  notes text check (notes is null or char_length(notes) <= 2000),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer_id uuid references auth.users (id),
  decision_reason text
);

create table public.providers (
  id uuid primary key default gen_random_uuid(),
  adapter_key text not null unique,
  name text not null,
  enabled boolean not null default true,
  capability text not null check (capability in ('native_booking', 'redirect')),
  is_mock boolean not null default false
);

-- Immutable, versioned pricing rules. formula:
--   { "flatFees": [{ "code", "label", "cents" }], "protectionCents": int, "taxRateBps": int }
create table public.pricing_policies (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  version int not null check (version > 0),
  label text not null,
  formula jsonb not null,
  active_from timestamptz not null default now(),
  unique (key, version)
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  public_code text not null unique,
  partner_id uuid not null references public.partners (id) on delete restrict,
  provider_id uuid not null references public.providers (id),
  make text not null check (char_length(make) between 1 and 40),
  model text not null check (char_length(model) between 1 and 40),
  year int not null check (year between 1980 and 2100),
  color text not null default '' check (char_length(color) <= 30),
  vehicle_type text not null
    check (vehicle_type in ('Sedan', 'SUV', 'Minivan', 'Van', 'Truck')),
  seats int not null check (seats between 1 and 15),
  transmission text not null default 'Automatic'
    check (transmission in ('Automatic', 'Manual')),
  description text not null default '' check (char_length(description) <= 2000),
  location_label text not null,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  time_zone text not null default 'America/Los_Angeles',
  daily_rate_cents int not null check (daily_rate_cents > 0),
  pricing_policy_id uuid not null references public.pricing_policies (id),
  booking_mode text not null default 'instant'
    check (booking_mode in ('instant', 'request')),
  cancellation_policy text not null default 'free_24h'
    check (cancellation_policy in ('free_24h')),
  lifecycle_status text not null default 'draft'
    check (lifecycle_status in ('draft', 'pending_review', 'published', 'paused', 'archived')),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vehicles_partner_idx on public.vehicles (partner_id);
create index vehicles_status_idx on public.vehicles (lifecycle_status);

create table public.vehicle_photos (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  storage_path text not null,
  position int not null default 0,
  is_primary boolean not null default false
);
create unique index vehicle_photos_one_primary
  on public.vehicle_photos (vehicle_id) where is_primary;

create table public.availability_windows (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  check (end_at > start_at)
);
create index availability_windows_vehicle_idx on public.availability_windows (vehicle_id);

-- Guard listing fields a partner must not control.
create function private.vehicles_guard() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if private.is_service() or private.has_role('admin') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.approved_at := null;
    if new.lifecycle_status not in ('draft', 'pending_review') then
      raise exception 'New listings start as draft or pending_review'
        using errcode = '42501';
    end if;
    return new;
  end if;
  if new.partner_id <> old.partner_id
     or new.provider_id <> old.provider_id
     or new.public_code <> old.public_code
     or new.approved_at is distinct from old.approved_at then
    raise exception 'Protected listing fields cannot be changed' using errcode = '42501';
  end if;
  -- Publishing requires a prior administrator approval.
  if new.lifecycle_status = 'published' and old.approved_at is null then
    raise exception 'Listing must be approved before it can be published'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger vehicles_guard
  before insert or update on public.vehicles
  for each row execute function private.vehicles_guard();

-- ---------------------------------------------------------------- booking
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  vehicle_id uuid not null references public.vehicles (id),
  pickup_at timestamptz not null,
  return_at timestamptz not null,
  expires_at timestamptz not null,
  policy_version text not null,
  total_cents int not null check (total_cents >= 0),
  breakdown jsonb not null,
  vehicle_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  check (return_at > pickup_at)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  customer_id uuid not null references auth.users (id),
  partner_id uuid not null references public.partners (id),
  vehicle_id uuid not null references public.vehicles (id),
  quote_id uuid references public.quotes (id),
  pickup_at timestamptz not null,
  return_at timestamptz not null,
  state text not null check (state in (
    'pending_partner', 'awaiting_payment', 'confirmed', 'ready_for_pickup',
    'active', 'completed', 'declined', 'expired', 'cancelled', 'payment_failed')),
  total_cents int not null check (total_cents >= 0),
  price_snapshot jsonb not null,
  vehicle_snapshot jsonb not null,
  contact_name text not null default '',
  contact_phone text not null default '',
  partner_approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (return_at > pickup_at)
);
create index bookings_customer_idx on public.bookings (customer_id);
create index bookings_partner_idx on public.bookings (partner_id);
create sequence public.booking_reference_seq start 100001;

-- Single conflict guard for holds, bookings and maintenance blocks.
-- Half-open [pickup, return) so back-to-back rentals are allowed.
create table public.occupancy (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles (id) on delete restrict,
  period tstzrange not null check (not isempty(period)),
  kind text not null check (kind in ('hold', 'booking', 'block')),
  expires_at timestamptz,
  active boolean not null default true,
  booking_id uuid references public.bookings (id),
  created_at timestamptz not null default now(),
  check (kind <> 'hold' or expires_at is not null),
  constraint occupancy_no_overlap
    exclude using gist (vehicle_id with =, period with &&) where (active)
);

create table public.booking_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 100),
  quote_id uuid not null references public.quotes (id),
  request_hash text not null,
  status text not null check (status in (
    'started', 'held', 'confirmed', 'payment_failed', 'unavailable',
    'rejected', 'expired_refunded')),
  failure_code text,
  occupancy_id uuid references public.occupancy (id),
  result_booking_id uuid references public.bookings (id),
  contact_name text not null default '',
  contact_phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id),
  attempt_id uuid not null references public.booking_attempts (id),
  provider text not null check (provider in ('simulated')),
  provider_ref text not null unique,
  amount_cents int not null check (amount_cents >= 0),
  currency text not null default 'USD',
  state text not null check (state in ('succeeded', 'failed', 'refunded')),
  detail text,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  target_type text not null,
  target_id text not null,
  reason text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------- availability API
-- Published, verified inventory that is free for [pickup, return).
-- SECURITY DEFINER because occupancy is not readable by clients.
create function public.available_vehicle_ids(_pickup timestamptz, _return timestamptz)
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select v.id
  from public.vehicles v
  join public.partners p on p.id = v.partner_id
  where v.lifecycle_status = 'published'
    and p.verification_status = 'verified'
    and _return > _pickup
    and exists (
      select 1 from public.availability_windows w
      where w.vehicle_id = v.id and w.start_at <= _pickup and w.end_at >= _return)
    and not exists (
      select 1 from public.occupancy o
      where o.vehicle_id = v.id
        and o.active
        and (o.expires_at is null or o.expires_at > now())
        and o.period operator(pg_catalog.&&) tstzrange(_pickup, _return, '[)'));
$$;
revoke execute on function public.available_vehicle_ids(timestamptz, timestamptz) from public;
grant execute on function public.available_vehicle_ids(timestamptz, timestamptz)
  to anon, authenticated, service_role;

-- ------------------------------------------------------ booking functions
-- Step 1: idempotent, atomic claim of an exclusive hold for a quote.
create function public.begin_booking(
  _user uuid, _quote uuid, _key text, _hash text,
  _contact_name text, _contact_phone text, _hold_seconds int default 600)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  a public.booking_attempts;
  q public.quotes;
  v public.vehicles;
  occ_id uuid;
  inserted boolean;
begin
  -- Serialize on (user, key): a concurrent duplicate waits here, then replays.
  insert into public.booking_attempts
    (user_id, idempotency_key, quote_id, request_hash, status, contact_name, contact_phone)
  values (_user, _key, _quote, _hash, 'started', _contact_name, _contact_phone)
  on conflict (user_id, idempotency_key) do nothing
  returning * into a;
  inserted := found;

  if not inserted then
    select * into a from public.booking_attempts
      where user_id = _user and idempotency_key = _key;
    if a.request_hash <> _hash then
      return jsonb_build_object('status', 'idempotency_mismatch');
    end if;
    return jsonb_build_object('status', a.status, 'attempt_id', a.id,
      'booking_id', a.result_booking_id, 'failure_code', a.failure_code, 'replay', true);
  end if;

  select * into q from public.quotes where id = _quote for update;
  if not found or (q.user_id is not null and q.user_id <> _user) then
    update public.booking_attempts set status = 'rejected', failure_code = 'quote_not_found',
      updated_at = now() where id = a.id;
    return jsonb_build_object('status', 'rejected', 'failure_code', 'quote_not_found', 'attempt_id', a.id);
  end if;
  if q.expires_at <= now() then
    update public.booking_attempts set status = 'rejected', failure_code = 'quote_expired',
      updated_at = now() where id = a.id;
    return jsonb_build_object('status', 'rejected', 'failure_code', 'quote_expired', 'attempt_id', a.id);
  end if;

  select * into v from public.vehicles where id = q.vehicle_id;
  if v.lifecycle_status <> 'published'
     or v.daily_rate_cents <> (q.vehicle_snapshot ->> 'dailyRateCents')::int
     or v.pricing_policy_id::text <> (q.vehicle_snapshot ->> 'pricingPolicyId') then
    update public.booking_attempts set status = 'rejected', failure_code = 'price_changed',
      updated_at = now() where id = a.id;
    return jsonb_build_object('status', 'rejected', 'failure_code', 'price_changed', 'attempt_id', a.id);
  end if;

  if not exists (
    select 1 from public.availability_windows w
    where w.vehicle_id = v.id and w.start_at <= q.pickup_at and w.end_at >= q.return_at) then
    update public.booking_attempts set status = 'unavailable', failure_code = 'unavailable',
      updated_at = now() where id = a.id;
    return jsonb_build_object('status', 'unavailable', 'attempt_id', a.id);
  end if;

  -- Release expired holds for this unit before claiming.
  update public.occupancy set active = false
    where vehicle_id = v.id and kind = 'hold' and active and expires_at <= now();

  begin
    insert into public.occupancy (vehicle_id, period, kind, expires_at)
    values (v.id, tstzrange(q.pickup_at, q.return_at, '[)'), 'hold',
            now() + make_interval(secs => _hold_seconds))
    returning id into occ_id;
  exception when exclusion_violation then
    update public.booking_attempts set status = 'unavailable', failure_code = 'unavailable',
      updated_at = now() where id = a.id;
    return jsonb_build_object('status', 'unavailable', 'attempt_id', a.id);
  end;

  update public.quotes set user_id = _user where id = q.id and user_id is null;
  update public.booking_attempts set status = 'held', occupancy_id = occ_id,
    updated_at = now() where id = a.id;
  return jsonb_build_object('status', 'held', 'attempt_id', a.id,
    'amount_cents', q.total_cents);
end;
$$;

-- Step 2: record the authoritative payment result and finalize exactly once.
create function public.finalize_booking(
  _attempt uuid, _payment_ok boolean, _provider_ref text, _detail text default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  a public.booking_attempts;
  q public.quotes;
  v public.vehicles;
  o public.occupancy;
  b_id uuid;
  b_ref text;
begin
  select * into a from public.booking_attempts where id = _attempt for update;
  if not found then
    return jsonb_build_object('status', 'rejected', 'failure_code', 'attempt_not_found');
  end if;
  if a.status <> 'held' then
    return jsonb_build_object('status', a.status, 'attempt_id', a.id,
      'booking_id', a.result_booking_id, 'failure_code', a.failure_code, 'replay', true);
  end if;

  select * into q from public.quotes where id = a.quote_id;
  select * into v from public.vehicles where id = q.vehicle_id;
  select * into o from public.occupancy where id = a.occupancy_id for update;

  if not _payment_ok then
    update public.occupancy set active = false where id = o.id;
    insert into public.payments (attempt_id, provider, provider_ref, amount_cents, state, detail)
    values (a.id, 'simulated', _provider_ref, q.total_cents, 'failed', _detail);
    update public.booking_attempts set status = 'payment_failed',
      failure_code = coalesce(_detail, 'declined'), updated_at = now() where id = a.id;
    return jsonb_build_object('status', 'payment_failed', 'attempt_id', a.id,
      'failure_code', coalesce(_detail, 'declined'));
  end if;

  -- Payment succeeded but the hold is gone: never double-book. Refund and reconcile.
  if not o.active or o.expires_at <= now() then
    update public.occupancy set active = false where id = o.id;
    insert into public.payments (attempt_id, provider, provider_ref, amount_cents, state, detail)
    values (a.id, 'simulated', _provider_ref, q.total_cents, 'refunded',
            'hold expired before payment completed; simulated refund');
    update public.booking_attempts set status = 'expired_refunded',
      failure_code = 'hold_expired', updated_at = now() where id = a.id;
    insert into public.audit_events (actor_id, action, target_type, target_id, reason)
    values (a.user_id, 'payment.reconcile_refund', 'booking_attempt', a.id::text,
            'payment succeeded after hold expiry');
    return jsonb_build_object('status', 'expired_refunded', 'attempt_id', a.id,
      'failure_code', 'hold_expired');
  end if;

  b_ref := 'CR-' || nextval('public.booking_reference_seq');
  insert into public.bookings
    (reference, customer_id, partner_id, vehicle_id, quote_id, pickup_at, return_at,
     state, total_cents, price_snapshot, vehicle_snapshot, contact_name, contact_phone)
  values (b_ref, a.user_id, v.partner_id, v.id, q.id, q.pickup_at, q.return_at,
     'confirmed', q.total_cents, q.breakdown, q.vehicle_snapshot,
     a.contact_name, a.contact_phone)
  returning id into b_id;

  update public.occupancy set kind = 'booking', expires_at = null, booking_id = b_id
    where id = o.id;
  insert into public.payments (booking_id, attempt_id, provider, provider_ref, amount_cents, state, detail)
  values (b_id, a.id, 'simulated', _provider_ref, q.total_cents, 'succeeded', _detail);
  update public.booking_attempts set status = 'confirmed', result_booking_id = b_id,
    updated_at = now() where id = a.id;
  insert into public.audit_events (actor_id, action, target_type, target_id)
  values (a.user_id, 'booking.confirmed', 'booking', b_id::text);
  return jsonb_build_object('status', 'confirmed', 'attempt_id', a.id, 'booking_id', b_id);
end;
$$;

revoke execute on function public.begin_booking(uuid, uuid, text, text, text, text, int) from public, anon, authenticated;
revoke execute on function public.finalize_booking(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.begin_booking(uuid, uuid, text, text, text, text, int) to service_role;
grant execute on function public.finalize_booking(uuid, boolean, text, text) to service_role;

-- --------------------------------------------- partner onboarding & review
create function public.submit_partner_application(
  _kind text, _display_name text, _contact_email text, _contact_phone text,
  _fleet_size int, _notes text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  pid uuid;
begin
  if uid is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if exists (select 1 from public.partners where owner_user_id = uid) then
    raise exception 'An application already exists for this account' using errcode = '23505';
  end if;
  -- Creates a pending application only; no partner privileges are granted here.
  insert into public.partners (owner_user_id, kind, display_name)
  values (uid, _kind, btrim(_display_name)) returning id into pid;
  insert into public.partner_applications (partner_id, contact_email, contact_phone, fleet_size, notes)
  values (pid, btrim(_contact_email), nullif(btrim(coalesce(_contact_phone, '')), ''),
          _fleet_size, nullif(btrim(coalesce(_notes, '')), ''));
  insert into public.audit_events (actor_id, action, target_type, target_id)
  values (uid, 'partner.application_submitted', 'partner', pid::text);
  return pid;
end;
$$;
revoke execute on function public.submit_partner_application(text, text, text, text, int, text) from public, anon;
grant execute on function public.submit_partner_application(text, text, text, text, int, text) to authenticated;

create function public.review_partner(_partner uuid, _approve boolean, _reason text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  owner uuid;
begin
  if not private.has_role('admin') then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if not _approve and char_length(btrim(coalesce(_reason, ''))) < 3 then
    raise exception 'A reason is required to reject an application' using errcode = '22023';
  end if;
  update public.partners
    set verification_status = case when _approve then 'verified' else 'rejected' end,
        updated_at = now()
    where id = _partner returning owner_user_id into owner;
  if not found then
    raise exception 'Partner not found' using errcode = 'P0002';
  end if;
  update public.partner_applications
    set reviewed_at = now(), reviewer_id = uid, decision_reason = nullif(btrim(coalesce(_reason, '')), '')
    where partner_id = _partner;
  if _approve then
    insert into public.user_roles (user_id, role) values (owner, 'partner')
    on conflict do nothing;
  else
    delete from public.user_roles where user_id = owner and role = 'partner';
  end if;
  insert into public.audit_events (actor_id, action, target_type, target_id, reason)
  values (uid, case when _approve then 'partner.verified' else 'partner.rejected' end,
          'partner', _partner::text, _reason);
end;
$$;
revoke execute on function public.review_partner(uuid, boolean, text) from public, anon;
grant execute on function public.review_partner(uuid, boolean, text) to authenticated;

create function public.review_listing(_vehicle uuid, _approve boolean, _reason text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if not private.has_role('admin') then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if not _approve and char_length(btrim(coalesce(_reason, ''))) < 3 then
    raise exception 'A reason is required to reject a listing' using errcode = '22023';
  end if;
  update public.vehicles
    set lifecycle_status = case when _approve then 'published' else 'draft' end,
        approved_at = case when _approve then now() else approved_at end
    where id = _vehicle and lifecycle_status = 'pending_review';
  if not found then
    raise exception 'Listing is not awaiting review' using errcode = 'P0002';
  end if;
  insert into public.audit_events (actor_id, action, target_type, target_id, reason)
  values (uid, case when _approve then 'listing.approved' else 'listing.rejected' end,
          'vehicle', _vehicle::text, _reason);
end;
$$;
revoke execute on function public.review_listing(uuid, boolean, text) from public, anon;
grant execute on function public.review_listing(uuid, boolean, text) to authenticated;

-- ------------------------------------------------------------------- RLS
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.partners enable row level security;
alter table public.partner_applications enable row level security;
alter table public.providers enable row level security;
alter table public.pricing_policies enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_photos enable row level security;
alter table public.availability_windows enable row level security;
alter table public.quotes enable row level security;
alter table public.bookings enable row level security;
alter table public.occupancy enable row level security;
alter table public.booking_attempts enable row level security;
alter table public.payments enable row level security;
alter table public.audit_events enable row level security;

-- Start from no table privileges for client roles, then grant narrowly.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.providers, public.pricing_policies, public.partners,
  public.vehicles, public.vehicle_photos, public.availability_windows to anon, authenticated;
grant select on public.profiles, public.user_roles, public.partner_applications,
  public.quotes, public.bookings, public.payments, public.audit_events to authenticated;
grant update (display_name, phone) on public.profiles to authenticated;
grant insert, update on public.vehicles to authenticated;
grant insert, update, delete on public.availability_windows, public.vehicle_photos to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

create policy "own profile or admin" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.has_role('admin'));
create policy "update own profile" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "own roles or admin" on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or private.has_role('admin'));

create policy "verified partners are public" on public.partners for select to anon, authenticated
  using (verification_status = 'verified');
create policy "owner or admin sees partner" on public.partners for select to authenticated
  using (owner_user_id = (select auth.uid()) or private.has_role('admin'));

create policy "providers are public" on public.providers for select to anon, authenticated using (true);
create policy "pricing policies are public" on public.pricing_policies for select to anon, authenticated using (true);

create function private.owns_partner(_partner uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.partners p
    where p.id = _partner and p.owner_user_id = (select auth.uid()));
$$;
create function private.owns_verified_partner(_partner uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.partners p
    where p.id = _partner and p.owner_user_id = (select auth.uid())
      and p.verification_status = 'verified');
$$;
create function private.partner_is_verified(_partner uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.partners p
    where p.id = _partner and p.verification_status = 'verified');
$$;
grant execute on function private.owns_partner(uuid), private.owns_verified_partner(uuid),
  private.partner_is_verified(uuid) to anon, authenticated, service_role;

create policy "owner or admin sees application" on public.partner_applications for select to authenticated
  using (private.has_role('admin') or private.owns_partner(partner_id));

create policy "published listings are public" on public.vehicles for select to anon, authenticated
  using (lifecycle_status = 'published' and private.partner_is_verified(partner_id));
create policy "owner or admin sees listing" on public.vehicles for select to authenticated
  using (private.owns_partner(partner_id) or private.has_role('admin'));
create policy "verified partner creates listing" on public.vehicles for insert to authenticated
  with check (private.owns_verified_partner(partner_id));
create policy "verified partner edits own listing" on public.vehicles for update to authenticated
  using (private.owns_verified_partner(partner_id))
  with check (private.owns_verified_partner(partner_id));
create policy "admin edits listing" on public.vehicles for update to authenticated
  using (private.has_role('admin')) with check (private.has_role('admin'));

-- Child rows inherit listing visibility through the vehicles policies.
create policy "photos follow listing" on public.vehicle_photos for select to anon, authenticated
  using (exists (select 1 from public.vehicles v where v.id = vehicle_id));
create policy "owner inserts photos" on public.vehicle_photos for insert to authenticated
  with check (exists (select 1 from public.vehicles v
                 where v.id = vehicle_id and private.owns_verified_partner(v.partner_id)));
create policy "owner updates photos" on public.vehicle_photos for update to authenticated
  using (exists (select 1 from public.vehicles v
                 where v.id = vehicle_id and private.owns_verified_partner(v.partner_id)));
create policy "owner deletes photos" on public.vehicle_photos for delete to authenticated
  using (exists (select 1 from public.vehicles v
                 where v.id = vehicle_id and private.owns_verified_partner(v.partner_id)));

create policy "windows follow listing" on public.availability_windows for select to anon, authenticated
  using (exists (select 1 from public.vehicles v where v.id = vehicle_id));
create policy "owner inserts windows" on public.availability_windows for insert to authenticated
  with check (exists (select 1 from public.vehicles v
                 where v.id = vehicle_id and private.owns_verified_partner(v.partner_id)));
create policy "owner updates windows" on public.availability_windows for update to authenticated
  using (exists (select 1 from public.vehicles v
                 where v.id = vehicle_id and private.owns_verified_partner(v.partner_id)));
create policy "owner deletes windows" on public.availability_windows for delete to authenticated
  using (exists (select 1 from public.vehicles v
                 where v.id = vehicle_id and private.owns_verified_partner(v.partner_id)));

create policy "own quotes" on public.quotes for select to authenticated
  using (user_id = (select auth.uid()));

create policy "booking parties and admin" on public.bookings for select to authenticated
  using (customer_id = (select auth.uid())
         or private.owns_partner(partner_id)
         or private.has_role('admin'));

create policy "customer or admin sees payment" on public.payments for select to authenticated
  using (private.has_role('admin') or exists (
    select 1 from public.bookings b
    where b.id = booking_id and b.customer_id = (select auth.uid())));

create policy "admin reads audit" on public.audit_events for select to authenticated
  using (private.has_role('admin'));

-- occupancy and booking_attempts: no client policies (server-only).

-- ------------------------------------------------------------ static data
insert into public.providers (adapter_key, name, capability, is_mock) values
  ('carrus', 'Carrus Rental Partners', 'native_booking', false),
  ('demo-external', 'Demo rental sources', 'redirect', true);

insert into public.pricing_policies (key, version, label, formula) values
  ('flat-fees', 1, 'Flat service fee and flat taxes (Mateo fixture profile)',
   '{"flatFees":[{"code":"service_fee","label":"Service fee","cents":3000},{"code":"taxes_flat","label":"Taxes and surcharges","cents":3000}],"protectionCents":0,"taxRateBps":0}'),
  ('protection-tax', 1, 'Protection plan plus 10% tax (Sanjay fixture profile)',
   '{"flatFees":[],"protectionCents":5200,"taxRateBps":1000}');
