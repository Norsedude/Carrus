-- A separate simulation ledger. These rows are never provider reservations.
create table public.external_demo_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users (id) on delete cascade,
  provider_key text not null,
  provider_name text not null,
  provider_listing_id text not null,
  source_url text not null,
  pickup_at timestamptz not null,
  return_at timestamptz not null,
  search_lat double precision not null,
  search_lng double precision not null,
  search_radius_miles int not null,
  listing_snapshot jsonb not null,
  total_cents int not null check (total_cents >= 0),
  state text not null default 'pending' check (state in ('pending', 'confirmed')),
  contact_name text,
  contact_phone text,
  demo_reference text unique,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  check (return_at > pickup_at),
  check (search_radius_miles between 1 and 200),
  check ((state = 'pending' and confirmed_at is null) or (state = 'confirmed' and confirmed_at is not null))
);

create index external_demo_orders_customer_idx on public.external_demo_orders (customer_id, created_at desc);
alter table public.external_demo_orders enable row level security;
grant select on public.external_demo_orders to authenticated;
create policy "customers read own demo orders" on public.external_demo_orders
  for select to authenticated using (customer_id = (select auth.uid()));
