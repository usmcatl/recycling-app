-- Recycle Connect — initial schema.
-- Run in the Supabase SQL editor (or `supabase db push`).
--
-- Model:
--   profiles          one row per signed-in user (donor or driver)
--   pickup_requests   a donor's request; drivers claim it and move it through statuses
--   driver_locations  last known position of an active driver (for live tracking)
--
-- Clients never UPDATE pickup_requests directly: status changes go through the
-- security-definer functions at the bottom so the rules live in one place.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('donor', 'driver');

create type public.request_status as enum (
  'open',        -- waiting for a driver
  'claimed',     -- a driver accepted it
  'en_route',    -- driver is on the way
  'picked_up',   -- collected from the donor
  'deposited',   -- delivered to the recycling center (done)
  'cancelled',   -- cancelled by the donor
  'no_show'      -- driver could not collect
);

create type public.time_window as enum ('morning', 'afternoon', 'evening');

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  role           public.user_role not null default 'donor',
  full_name      text not null,
  whatsapp       text,
  locale         text not null default 'es' check (locale in ('es', 'en')),
  -- donor pickup address
  address        text,
  community      text,
  lat            double precision,
  lng            double precision,
  -- driver details
  vehicle_make   text,
  vehicle_model  text,
  vehicle_color  text,
  vehicle_plate  text,
  is_active      boolean not null default false,
  -- notification preferences
  notify_push        boolean not null default true,
  notify_whatsapp    boolean not null default true,
  notify_email       boolean not null default false,
  notify_updates     boolean not null default true,
  notify_status      boolean not null default true,
  notify_impact      boolean not null default true,
  notify_tips        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create or replace function public.is_driver()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'driver');
$$;

-- ---------------------------------------------------------------------------
-- Pickup requests
-- ---------------------------------------------------------------------------

create sequence public.case_number_seq start 1001;

create table public.pickup_requests (
  id              uuid primary key default gen_random_uuid(),
  case_code       text not null unique default ('RC-' || nextval('public.case_number_seq')),
  donor_id        uuid not null references public.profiles (id) on delete cascade,
  driver_id       uuid references public.profiles (id) on delete set null,
  status          public.request_status not null default 'open',
  materials       text[] not null check (cardinality(materials) > 0),
  other_material  text,
  bag_count       int not null check (bag_count between 1 and 50),
  preferred_date  date not null,
  time_window     public.time_window not null,
  instructions    text,
  address         text not null,
  community       text,
  lat             double precision,
  lng             double precision,
  estimated_kg    numeric(6,1) not null,
  actual_kg       numeric(6,1),
  status_note     text,
  claimed_at      timestamptz,
  picked_up_at    timestamptz,
  deposited_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index pickup_requests_status_idx on public.pickup_requests (status);
create index pickup_requests_donor_idx on public.pickup_requests (donor_id);
create index pickup_requests_driver_idx on public.pickup_requests (driver_id);

-- ---------------------------------------------------------------------------
-- Driver locations
-- ---------------------------------------------------------------------------

create table public.driver_locations (
  driver_id   uuid primary key references public.profiles (id) on delete cascade,
  lat         double precision not null,
  lng         double precision not null,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.pickup_requests enable row level security;
alter table public.driver_locations enable row level security;

-- Profiles: you can read your own, plus the other party on a request you share.
create policy "profiles: read own" on public.profiles
  for select using (id = auth.uid());

create policy "profiles: read counterpart" on public.profiles
  for select using (
    exists (
      select 1 from public.pickup_requests r
      where (r.donor_id = profiles.id and r.driver_id = auth.uid())
         or (r.driver_id = profiles.id and r.donor_id = auth.uid())
    )
  );

create policy "profiles: insert own" on public.profiles
  for insert with check (id = auth.uid());

create policy "profiles: update own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Requests: donors see their own; drivers see open requests and the ones they hold.
create policy "requests: donor reads own" on public.pickup_requests
  for select using (donor_id = auth.uid());

create policy "requests: driver reads open and assigned" on public.pickup_requests
  for select using (
    public.is_driver() and (status = 'open' or driver_id = auth.uid())
  );

create policy "requests: donor creates own" on public.pickup_requests
  for insert with check (
    donor_id = auth.uid() and status = 'open' and driver_id is null
  );

-- Driver locations: drivers write their own; a donor can see the driver
-- currently assigned to one of their in-progress requests.
create policy "locations: driver upserts own" on public.driver_locations
  for all using (driver_id = auth.uid()) with check (driver_id = auth.uid());

create policy "locations: donor reads assigned driver" on public.driver_locations
  for select using (
    exists (
      select 1 from public.pickup_requests r
      where r.driver_id = driver_locations.driver_id
        and r.donor_id = auth.uid()
        and r.status in ('claimed', 'en_route')
    )
  );

-- ---------------------------------------------------------------------------
-- Status transitions
-- ---------------------------------------------------------------------------

-- A driver claims an open request. Fails if someone else got there first.
create or replace function public.claim_request(request_id uuid)
returns public.pickup_requests
language plpgsql security definer set search_path = public
as $$
declare
  result pickup_requests;
begin
  if not is_driver() then
    raise exception 'Only drivers can claim requests';
  end if;

  update pickup_requests
     set driver_id = auth.uid(), status = 'claimed', claimed_at = now(), updated_at = now()
   where id = request_id and status = 'open'
  returning * into result;

  if result.id is null then
    raise exception 'This request is no longer available';
  end if;
  return result;
end;
$$;

-- The assigned driver hands a request back to the open pool.
create or replace function public.release_request(request_id uuid)
returns public.pickup_requests
language plpgsql security definer set search_path = public
as $$
declare
  result pickup_requests;
begin
  update pickup_requests
     set driver_id = null, status = 'open', claimed_at = null, updated_at = now()
   where id = request_id and driver_id = auth.uid() and status in ('claimed', 'en_route')
  returning * into result;

  if result.id is null then
    raise exception 'Request cannot be released';
  end if;
  return result;
end;
$$;

-- The assigned driver advances a request: claimed → en_route → picked_up → deposited,
-- or marks it no_show.
create or replace function public.advance_request(
  request_id uuid,
  new_status public.request_status,
  kg numeric default null,
  note text default null
)
returns public.pickup_requests
language plpgsql security definer set search_path = public
as $$
declare
  current_status request_status;
  result pickup_requests;
begin
  select status into current_status
    from pickup_requests
   where id = request_id and driver_id = auth.uid()
   for update;

  if current_status is null then
    raise exception 'Request not found or not assigned to you';
  end if;

  if not (
       (current_status = 'claimed'   and new_status in ('en_route', 'picked_up', 'no_show'))
    or (current_status = 'en_route'  and new_status in ('picked_up', 'no_show'))
    or (current_status = 'picked_up' and new_status = 'deposited')
  ) then
    raise exception 'Cannot move request from % to %', current_status, new_status;
  end if;

  update pickup_requests
     set status       = new_status,
         actual_kg    = coalesce(kg, actual_kg),
         status_note  = coalesce(note, status_note),
         picked_up_at = case when new_status = 'picked_up' then now() else picked_up_at end,
         deposited_at = case when new_status = 'deposited' then now() else deposited_at end,
         updated_at   = now()
   where id = request_id
  returning * into result;

  return result;
end;
$$;

-- A donor cancels their own request before it has been collected.
create or replace function public.cancel_request(request_id uuid)
returns public.pickup_requests
language plpgsql security definer set search_path = public
as $$
declare
  result pickup_requests;
begin
  update pickup_requests
     set status = 'cancelled', updated_at = now()
   where id = request_id and donor_id = auth.uid() and status in ('open', 'claimed', 'en_route')
  returning * into result;

  if result.id is null then
    raise exception 'Request cannot be cancelled';
  end if;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Impact
-- ---------------------------------------------------------------------------

-- Community leaderboard: kg delivered to the center, per donor.
-- Exposes first name + last initial only, never contact details.
create or replace function public.leaderboard(since timestamptz default null, max_rows int default 50)
returns table (user_id uuid, display_name text, kg numeric, pickups bigint, rank bigint)
language sql stable security definer set search_path = public
as $$
  select p.id,
         split_part(p.full_name, ' ', 1) ||
           coalesce(' ' || nullif(left(split_part(p.full_name, ' ', 2), 1), '') || '.', ''),
         sum(coalesce(r.actual_kg, r.estimated_kg)),
         count(*),
         rank() over (order by sum(coalesce(r.actual_kg, r.estimated_kg)) desc)
    from pickup_requests r
    join profiles p on p.id = r.donor_id
   where r.status = 'deposited'
     and (since is null or r.deposited_at >= since)
   group by p.id
   order by 3 desc
   limit max_rows;
$$;

-- Community-wide totals for the welcome screen. Safe to call signed out.
create or replace function public.community_stats()
returns table (total_kg numeric, total_pickups bigint, donors bigint, drivers bigint)
language sql stable security definer set search_path = public
as $$
  select
    coalesce((select sum(coalesce(actual_kg, estimated_kg)) from pickup_requests where status = 'deposited'), 0),
    (select count(*) from pickup_requests where status = 'deposited'),
    (select count(*) from profiles where role = 'donor'),
    (select count(*) from profiles where role = 'driver');
$$;

grant execute on function public.community_stats() to anon, authenticated;
grant execute on function public.leaderboard(timestamptz, int) to authenticated;
grant execute on function public.claim_request(uuid) to authenticated;
grant execute on function public.release_request(uuid) to authenticated;
grant execute on function public.advance_request(uuid, public.request_status, numeric, text) to authenticated;
grant execute on function public.cancel_request(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.pickup_requests;
alter publication supabase_realtime add table public.driver_locations;
