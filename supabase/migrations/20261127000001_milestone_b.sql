-- Milestone B: request-to-book with partner approve/decline, notifications
-- outbox, saved searches, rate limiting, listing photo storage and a public
-- availability calendar lookup.

-- ------------------------------------------------------- request-to-book
-- A request-mode checkout authorizes the (simulated) payment and holds the
-- car until the partner answers. Approve confirms it; decline or no answer
-- by respond_by releases the car and refunds the simulated payment.
alter table public.bookings add column respond_by timestamptz;
alter table public.bookings add column decline_reason text
  check (decline_reason is null or char_length(decline_reason) <= 300);

-- ---------------------------------------------------- notifications outbox
-- In-app inbox. email_status is the outbox state for a future mail sender;
-- nothing is emailed by the prototype.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (char_length(kind) between 2 and 60),
  title text not null check (char_length(title) between 1 and 160),
  body text not null default '' check (char_length(body) <= 1000),
  link text check (link is null or (link like '/%' and link not like '//%')),
  read_at timestamptz,
  email_status text not null default 'pending'
    check (email_status in ('pending', 'sent', 'skipped', 'failed')),
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;
create policy "own notifications" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "mark own notifications read" on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create function private.notify(_user uuid, _kind text, _title text, _body text, _link text)
returns void
language sql security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, title, body, link)
  values (_user, _kind, left(_title, 160), left(coalesce(_body, ''), 1000), _link);
$$;
revoke execute on function private.notify(uuid, text, text, text, text) from public, anon, authenticated;

-- --------------------------------------------------------- saved searches
create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  -- The /search query string only (no host), e.g. "location=SJC&type=SUV".
  query text not null check (char_length(query) between 1 and 2000 and query not like '%://%'),
  created_at timestamptz not null default now()
);
create index saved_searches_user_idx on public.saved_searches (user_id, created_at desc);
alter table public.saved_searches enable row level security;
grant select, insert, delete on public.saved_searches to authenticated;
grant all on public.saved_searches to service_role;
create policy "own saved searches" on public.saved_searches for select to authenticated
  using (user_id = (select auth.uid()));
create policy "save own searches" on public.saved_searches for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "delete own saved searches" on public.saved_searches for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------- rate limiting
-- Fixed-window counters, server-only (service role through the function).
create table private.rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (bucket, window_start)
);

create function public.hit_rate_limit(_bucket text, _limit int, _window_seconds int)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / greatest(_window_seconds, 1)) * greatest(_window_seconds, 1));
  n int;
begin
  insert into private.rate_limits as r (bucket, window_start, hits)
  values (left(_bucket, 200), w, 1)
  on conflict (bucket, window_start) do update set hits = r.hits + 1
  returning hits into n;
  if random() < 0.02 then
    delete from private.rate_limits where window_start < now() - interval '1 day';
  end if;
  return n <= _limit;
end;
$$;
revoke execute on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;

-- --------------------------------------------------- listing photo storage
-- Public bucket: listing photos are shown on public pages. Uploads go
-- through the server, which checks ownership, file type and size first.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vehicle-photos', 'vehicle-photos', true, 10000000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ---------------------------------------------- public availability lookup
-- Busy periods for a visible listing (no customer details), for calendars.
create function public.vehicle_busy_periods(_vehicle uuid, _from timestamptz, _to timestamptz)
returns table (start_at timestamptz, end_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select lower(o.period), upper(o.period)
  from public.occupancy o
  join public.vehicles v on v.id = o.vehicle_id
  where o.vehicle_id = _vehicle
    and o.active
    and (o.expires_at is null or o.expires_at > now())
    and o.period operator(pg_catalog.&&) tstzrange(_from, _to, '[)')
    and ((v.lifecycle_status = 'published' and private.partner_is_verified(v.partner_id))
         or private.owns_partner(v.partner_id) or private.has_role('admin'))
  order by 1;
$$;
revoke execute on function public.vehicle_busy_periods(uuid, timestamptz, timestamptz) from public;
grant execute on function public.vehicle_busy_periods(uuid, timestamptz, timestamptz) to anon, authenticated, service_role;

-- ------------------------------------------- per-vehicle claim serialization
-- A finalize updates its occupancy row, which re-checks the exclusion
-- constraint; a concurrent claim inserting a conflicting row on the same car
-- could then deadlock with it. Both now take a per-vehicle advisory lock.
create or replace function public.begin_booking(
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

  -- Serialize hold changes per vehicle (see finalize_booking): prevents a
  -- deadlock between a concurrent claim and a finalize on the same car.
  perform pg_advisory_xact_lock(hashtext('carrus.vehicle:' || v.id::text));

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

-- ------------------------------------------------- finalize (request mode)
-- Same contract as before; request-mode listings now create a pending
-- booking that keeps its hold until the partner answers.
create or replace function public.finalize_booking(
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
  owner uuid;
  b_id uuid;
  b_ref text;
  is_request boolean;
  deadline timestamptz := now() + interval '24 hours';
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
  -- Same per-vehicle lock as begin_booking, taken before touching occupancy.
  perform pg_advisory_xact_lock(hashtext('carrus.vehicle:' || v.id::text));
  select * into o from public.occupancy where id = a.occupancy_id for update;
  select owner_user_id into owner from public.partners where id = v.partner_id;
  is_request := v.booking_mode = 'request';

  if not _payment_ok then
    update public.occupancy set active = false where id = o.id;
    insert into public.payments (attempt_id, provider, provider_ref, amount_cents, state, detail)
    values (a.id, 'simulated', _provider_ref, q.total_cents, 'failed', _detail);
    update public.booking_attempts set status = 'payment_failed',
      failure_code = coalesce(_detail, 'declined'), updated_at = now() where id = a.id;
    return jsonb_build_object('status', 'payment_failed', 'attempt_id', a.id,
      'failure_code', coalesce(_detail, 'declined'));
  end if;

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
     state, total_cents, price_snapshot, vehicle_snapshot, contact_name, contact_phone, respond_by)
  values (b_ref, a.user_id, v.partner_id, v.id, q.id, q.pickup_at, q.return_at,
     case when is_request then 'pending_partner' else 'confirmed' end,
     q.total_cents, q.breakdown, q.vehicle_snapshot,
     a.contact_name, a.contact_phone, case when is_request then deadline end)
  returning id into b_id;

  if is_request then
    update public.occupancy set expires_at = deadline, booking_id = b_id where id = o.id;
  else
    update public.occupancy set kind = 'booking', expires_at = null, booking_id = b_id where id = o.id;
  end if;
  insert into public.payments (booking_id, attempt_id, provider, provider_ref, amount_cents, state, detail)
  values (b_id, a.id, 'simulated', _provider_ref, q.total_cents, 'succeeded', _detail);
  update public.booking_attempts set status = 'confirmed', result_booking_id = b_id,
    updated_at = now() where id = a.id;
  insert into public.audit_events (actor_id, action, target_type, target_id)
  values (a.user_id, case when is_request then 'booking.requested' else 'booking.confirmed' end, 'booking', b_id::text);

  if is_request then
    perform private.notify(a.user_id, 'booking.requested', 'Request sent: ' || b_ref,
      'The host has 24 hours to respond. If they decline or do not answer, your simulated payment is refunded.',
      '/bookings/' || b_id || '/confirmation');
    perform private.notify(owner, 'partner.request', 'New booking request ' || b_ref,
      (q.vehicle_snapshot ->> 'year') || ' ' || (q.vehicle_snapshot ->> 'make') || ' ' || (q.vehicle_snapshot ->> 'model') || '. Respond within 24 hours.',
      '/partner/reservations/' || b_id);
  else
    perform private.notify(a.user_id, 'booking.confirmed', 'Reservation confirmed: ' || b_ref,
      (q.vehicle_snapshot ->> 'year') || ' ' || (q.vehicle_snapshot ->> 'make') || ' ' || (q.vehicle_snapshot ->> 'model') || ' is reserved for you.',
      '/bookings/' || b_id || '/confirmation');
    perform private.notify(owner, 'partner.booking', 'New reservation ' || b_ref,
      (q.vehicle_snapshot ->> 'year') || ' ' || (q.vehicle_snapshot ->> 'make') || ' ' || (q.vehicle_snapshot ->> 'model') || ' was booked.',
      '/partner/reservations/' || b_id);
  end if;
  return jsonb_build_object('status', 'confirmed', 'attempt_id', a.id, 'booking_id', b_id,
    'booking_state', case when is_request then 'pending_partner' else 'confirmed' end);
end;
$$;

-- Shared release used by decline and expiry: frees the car and refunds.
create function private.release_request(_booking uuid, _state text, _reason text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  b public.bookings;
begin
  update public.bookings
    set state = _state, decline_reason = nullif(btrim(coalesce(_reason, '')), ''), updated_at = now()
    where id = _booking and state = 'pending_partner'
    returning * into b;
  if not found then
    return;
  end if;
  perform pg_advisory_xact_lock(hashtext('carrus.vehicle:' || b.vehicle_id::text));
  update public.occupancy set active = false where booking_id = b.id;
  update public.payments
    set state = 'refunded',
        detail = case when _state = 'declined' then 'host declined the request; simulated refund'
                      else 'host did not respond in time; simulated refund' end
    where booking_id = b.id and state = 'succeeded';
  perform private.notify(b.customer_id, 'booking.' || _state,
    case when _state = 'declined' then 'Request declined: ' else 'Request expired: ' end || b.reference,
    case when _state = 'declined'
         then 'The host declined your request' || coalesce(': ' || nullif(btrim(coalesce(_reason, '')), ''), '.') || ' Your simulated payment was refunded.'
         else 'The host did not respond within 24 hours. Your simulated payment was refunded.' end,
    '/bookings/' || b.id || '/confirmation');
end;
$$;
revoke execute on function private.release_request(uuid, text, text) from public, anon, authenticated;

-- Partner (or admin) answers a pending request.
create function public.respond_to_booking(_booking uuid, _approve boolean, _reason text default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  b public.bookings;
begin
  select * into b from public.bookings where id = _booking for update;
  if not found or not (private.owns_partner(b.partner_id) or private.has_role('admin')) then
    raise exception 'Reservation not found' using errcode = 'P0002';
  end if;
  if b.state <> 'pending_partner' then
    return jsonb_build_object('status', b.state);
  end if;
  if b.respond_by is not null and b.respond_by <= now() then
    perform private.release_request(b.id, 'expired', null);
    return jsonb_build_object('status', 'expired');
  end if;
  if _approve then
    perform pg_advisory_xact_lock(hashtext('carrus.vehicle:' || b.vehicle_id::text));
    update public.bookings set state = 'confirmed', partner_approved_at = now(), updated_at = now()
      where id = b.id;
    update public.occupancy set kind = 'booking', expires_at = null where booking_id = b.id and active;
    perform private.notify(b.customer_id, 'booking.approved', 'Request approved: ' || b.reference,
      'The host approved your request. Your reservation is confirmed.', '/bookings/' || b.id || '/confirmation');
    insert into public.audit_events (actor_id, action, target_type, target_id)
    values (uid, 'booking.approved', 'booking', b.id::text);
    return jsonb_build_object('status', 'confirmed');
  end if;
  perform private.release_request(b.id, 'declined', _reason);
  insert into public.audit_events (actor_id, action, target_type, target_id, reason)
  values (uid, 'booking.declined', 'booking', b.id::text, _reason);
  return jsonb_build_object('status', 'declined');
end;
$$;
revoke execute on function public.respond_to_booking(uuid, boolean, text) from public, anon;
grant execute on function public.respond_to_booking(uuid, boolean, text) to authenticated, service_role;

-- Expire unanswered requests (called lazily by the server).
create function public.expire_pending_requests()
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  r record;
  n int := 0;
begin
  for r in select id from public.bookings
           where state = 'pending_partner' and respond_by is not null and respond_by <= now()
           for update skip locked
  loop
    perform private.release_request(r.id, 'expired', null);
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function public.expire_pending_requests() from public, anon, authenticated;
grant execute on function public.expire_pending_requests() to service_role;
