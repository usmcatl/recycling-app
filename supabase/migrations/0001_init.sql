-- Recycle Connect — schema.
-- Run in the Supabase SQL editor (or `supabase db push`).
--
-- Model (route days, like Ridwell / Olio collection slots):
--   route_schedule      which weekday each community is collected (mirror of ROUTE_SCHEDULE in the app)
--   routes              one community's run on one date; a driver claims the whole route
--   route_commitments   a driver holding a community's route every week
--   pickup_requests     a donor's stop on a route (doorstep or in person)
--   ratings             1–5 stars + tags, both directions, after a stop is done
--   reliability_events  late drops (driver skips after cutoff, donor cancels after cutoff)
--   driver_locations    last known position of a driver (live tracking)
--
-- Clients never write routes/requests directly: everything goes through the security-definer
-- functions below so the rules (cutoff, daily cap, photo, wait-before-no-show) live in one place.

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------

-- Changes lock at 20:00 local time the night before a route day.
create or replace function public.route_cutoff(d date)
returns timestamptz
language sql immutable
as $$
  select ((d - 1)::timestamp + interval '20 hours') at time zone 'America/Mexico_City';
$$;

create or replace function public.max_routes_per_day() returns int language sql immutable as $$ select 2 $$;
create or replace function public.no_show_wait() returns interval language sql immutable as $$ select interval '5 minutes' $$;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.user_role as enum ('donor', 'driver');
create type public.request_status as enum ('open', 'claimed', 'en_route', 'picked_up', 'deposited', 'cancelled', 'no_show');
create type public.pickup_mode as enum ('doorstep', 'in_person');
create type public.route_status as enum ('open', 'claimed', 'in_progress', 'completed');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  role                 public.user_role not null default 'donor',
  full_name            text not null,
  whatsapp             text,
  locale               text not null default 'es' check (locale in ('es', 'en')),
  address              text,
  community            text,
  lat                  double precision,
  lng                  double precision,
  vehicle_make         text,
  vehicle_model        text,
  vehicle_color        text,
  vehicle_plate        text,
  is_active            boolean not null default false,
  conduct_accepted_at  timestamptz,
  notify_push          boolean not null default true,
  notify_whatsapp      boolean not null default true,
  notify_email         boolean not null default false,
  notify_updates       boolean not null default true,
  notify_status        boolean not null default true,
  notify_impact        boolean not null default true,
  notify_tips          boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- TODO: placeholder days; keep in sync with ROUTE_SCHEDULE in src/lib/constants.ts.
create table public.route_schedule (
  community  text primary key,
  weekday    int not null check (weekday between 0 and 6) -- 0 = Sunday
);

insert into public.route_schedule (community, weekday) values
  ('Ajijic', 2), ('La Floresta', 2),
  ('San Antonio Tlayacapan', 3), ('Riberas del Pilar', 3),
  ('Chapala', 4), ('Vista del Lago', 4), ('Chula Vista', 4), ('Santa Cruz de la Soledad', 4), ('Mezcala', 4),
  ('San Juan Cosalá', 5), ('El Chante', 5), ('Jocotepec', 5);

create table public.routes (
  id            uuid primary key default gen_random_uuid(),
  community     text not null references public.route_schedule (community),
  route_date    date not null,
  driver_id     uuid references public.profiles (id) on delete set null,
  recurring     boolean not null default false,
  status        public.route_status not null default 'open',
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  unique (community, route_date)
);

create table public.route_commitments (
  community   text primary key references public.route_schedule (community),
  driver_id   uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create sequence public.case_number_seq start 1001;

create table public.pickup_requests (
  id              uuid primary key default gen_random_uuid(),
  case_code       text not null unique default ('RC-' || nextval('public.case_number_seq')),
  donor_id        uuid not null references public.profiles (id) on delete cascade,
  driver_id       uuid references public.profiles (id) on delete set null,
  route_id        uuid not null references public.routes (id),
  route_date      date not null,
  status          public.request_status not null default 'open',
  pickup_mode     public.pickup_mode not null default 'doorstep',
  materials       text[] not null check (cardinality(materials) > 0),
  other_material  text,
  bag_count       int not null check (bag_count between 1 and 50),
  instructions    text,
  address         text not null,
  community       text not null,
  lat             double precision,
  lng             double precision,
  estimated_kg    numeric(6,1) not null,
  actual_kg       numeric(6,1),
  photo_url       text,
  status_note     text,
  arrived_at      timestamptz,
  contacted_at    timestamptz,
  picked_up_at    timestamptz,
  deposited_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index pickup_requests_route_idx on public.pickup_requests (route_id);
create index pickup_requests_donor_idx on public.pickup_requests (donor_id);
create index pickup_requests_driver_idx on public.pickup_requests (driver_id);

create table public.ratings (
  request_id  uuid not null references public.pickup_requests (id) on delete cascade,
  rater_id    uuid not null references public.profiles (id) on delete cascade,
  ratee_id    uuid not null references public.profiles (id) on delete cascade,
  stars       int not null check (stars between 1 and 5),
  tags        text[] not null default '{}',
  comment     text,
  created_at  timestamptz not null default now(),
  primary key (request_id, rater_id)
);

create index ratings_ratee_idx on public.ratings (ratee_id);

create table public.reliability_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('late_drop')),
  route_id    uuid references public.routes (id) on delete set null,
  request_id  uuid references public.pickup_requests (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.driver_locations (
  driver_id   uuid primary key references public.profiles (id) on delete cascade,
  lat         double precision not null,
  lng         double precision not null,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_driver()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'driver');
$$;

-- Get (or create) the route for a community on a date. A new route is handed to the
-- community's weekly driver, if there is one.
create or replace function public.ensure_route(p_community text, p_date date)
returns routes
language plpgsql security definer set search_path = public
as $$
declare
  r routes;
begin
  insert into routes (community, route_date, driver_id, recurring, status)
  select p_community, p_date, c.driver_id, c.driver_id is not null,
         case when c.driver_id is null then 'open' else 'claimed' end::route_status
    from (select 1) one
    left join route_commitments c on c.community = p_community
  on conflict (community, route_date) do nothing;

  select * into r from routes where community = p_community and route_date = p_date;
  return r;
end;
$$;

-- Push a route's driver/status onto its stops that haven't been collected yet.
create or replace function public.sync_stops(p_route uuid)
returns void
language sql security definer set search_path = public
as $$
  update pickup_requests p
     set driver_id = r.driver_id,
         status = case
           when r.status = 'open' then 'open'
           when r.status = 'claimed' then 'claimed'
           when r.status = 'in_progress' then 'en_route'
           else p.status::text end::request_status,
         updated_at = now()
    from routes r
   where r.id = p_route and p.route_id = r.id and p.status in ('open', 'claimed', 'en_route');
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.route_schedule enable row level security;
alter table public.routes enable row level security;
alter table public.route_commitments enable row level security;
alter table public.pickup_requests enable row level security;
alter table public.ratings enable row level security;
alter table public.reliability_events enable row level security;
alter table public.driver_locations enable row level security;

create policy "profiles: read own" on public.profiles for select using (id = auth.uid());
create policy "profiles: read counterpart" on public.profiles for select using (
  exists (
    select 1 from public.pickup_requests r
    where (r.donor_id = profiles.id and r.driver_id = auth.uid())
       or (r.driver_id = profiles.id and r.donor_id = auth.uid())
  )
);
create policy "profiles: insert own" on public.profiles for insert with check (id = auth.uid());
create policy "profiles: update own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "schedule: readable" on public.route_schedule for select using (true);
create policy "routes: readable when signed in" on public.routes for select using (auth.uid() is not null);
create policy "commitments: readable when signed in" on public.route_commitments for select using (auth.uid() is not null);

-- Donors see their own stops; drivers see stops on unclaimed routes (to plan) and their own.
create policy "requests: donor reads own" on public.pickup_requests for select using (donor_id = auth.uid());
create policy "requests: driver reads open and assigned" on public.pickup_requests for select using (
  public.is_driver() and (status = 'open' or driver_id = auth.uid())
);

create policy "ratings: read own given and received" on public.ratings for select using (
  rater_id = auth.uid() or ratee_id = auth.uid()
);

create policy "locations: driver writes own" on public.driver_locations
  for all using (driver_id = auth.uid()) with check (driver_id = auth.uid());
create policy "locations: donor reads assigned driver" on public.driver_locations for select using (
  exists (
    select 1 from public.pickup_requests r
    where r.driver_id = driver_locations.driver_id and r.donor_id = auth.uid() and r.status in ('claimed', 'en_route')
  )
);

-- ---------------------------------------------------------------------------
-- Donor actions
-- ---------------------------------------------------------------------------

create or replace function public.create_request(
  p_materials text[], p_other_material text, p_bag_count int, p_route_date date, p_mode pickup_mode,
  p_instructions text, p_address text, p_community text, p_lat double precision, p_lng double precision,
  p_estimated_kg numeric
)
returns pickup_requests
language plpgsql security definer set search_path = public
as $$
declare
  sched route_schedule;
  r routes;
  result pickup_requests;
begin
  select * into sched from route_schedule where community = p_community;
  if sched.community is null then raise exception 'No route serves %', p_community; end if;
  if extract(dow from p_route_date) <> sched.weekday then raise exception 'Not a route day for %', p_community; end if;
  if now() >= route_cutoff(p_route_date) then raise exception 'Requests for this day are closed'; end if;

  r := ensure_route(p_community, p_route_date);
  if r.status in ('in_progress', 'completed') then raise exception 'This route has already started'; end if;

  insert into pickup_requests (donor_id, driver_id, route_id, route_date, status, pickup_mode, materials,
    other_material, bag_count, instructions, address, community, lat, lng, estimated_kg)
  values (auth.uid(), r.driver_id, r.id, p_route_date,
    case when r.driver_id is null then 'open' else 'claimed' end::request_status,
    p_mode, p_materials, p_other_material, p_bag_count, p_instructions, p_address, p_community, p_lat, p_lng,
    p_estimated_kg)
  returning * into result;
  return result;
end;
$$;

-- Donor cancels before collection. After the cutoff it counts as a late drop.
create or replace function public.cancel_request(request_id uuid)
returns pickup_requests
language plpgsql security definer set search_path = public
as $$
declare
  result pickup_requests;
begin
  update pickup_requests set status = 'cancelled', updated_at = now()
   where id = request_id and donor_id = auth.uid() and status in ('open', 'claimed', 'en_route')
  returning * into result;
  if result.id is null then raise exception 'Request cannot be cancelled'; end if;
  if now() >= route_cutoff(result.route_date) then
    insert into reliability_events (user_id, kind, request_id) values (auth.uid(), 'late_drop', result.id);
  end if;
  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Driver actions: routes
-- ---------------------------------------------------------------------------

-- Routes in a date range with stop counts (drivers plan from this).
create or replace function public.route_board(p_from date, p_to date)
returns table (id uuid, community text, route_date date, driver_id uuid, recurring boolean, status route_status,
               started_at timestamptz, completed_at timestamptz, stop_count bigint, estimated_kg numeric)
language sql stable security definer set search_path = public
as $$
  select r.id, r.community, r.route_date, r.driver_id, r.recurring, r.status, r.started_at, r.completed_at,
         count(p.id) filter (where p.status <> 'cancelled'),
         coalesce(sum(p.estimated_kg) filter (where p.status <> 'cancelled'), 0)
    from routes r
    left join pickup_requests p on p.route_id = r.id
   where r.route_date between p_from and p_to
   group by r.id;
$$;

-- Take a route for one day, or every week (holds the community's weekday going forward).
create or replace function public.claim_route(p_route uuid, p_every_week boolean default false)
returns routes
language plpgsql security definer set search_path = public
as $$
declare
  r routes;
  held int;
  later record;
begin
  if not is_driver() then raise exception 'Only drivers can claim routes'; end if;
  select * into r from routes where id = p_route for update;
  if r.id is null or r.status <> 'open' then raise exception 'This route is no longer available'; end if;
  if r.route_date < current_date then raise exception 'This route has passed'; end if;

  select count(*) into held from routes
   where driver_id = auth.uid() and route_date = r.route_date and status <> 'completed';
  if held >= max_routes_per_day() then raise exception 'You already have % routes that day', held; end if;

  if p_every_week then
    insert into route_commitments (community, driver_id) values (r.community, auth.uid())
    on conflict (community) do nothing;
    if not exists (select 1 from route_commitments where community = r.community and driver_id = auth.uid()) then
      raise exception 'Another driver already holds % every week', r.community;
    end if;
  end if;

  update routes set driver_id = auth.uid(), status = 'claimed', recurring = p_every_week where id = p_route
  returning * into r;
  perform sync_stops(r.id);

  if p_every_week then
    -- pick up later dates for this community that are still open
    for later in
      update routes set driver_id = auth.uid(), status = 'claimed', recurring = true
       where community = r.community and route_date > r.route_date and status = 'open'
      returning id
    loop
      perform sync_stops(later.id);
    end loop;
  end if;
  return r;
end;
$$;

-- Hand one date back. After the cutoff this is a late drop on the driver's record.
create or replace function public.skip_route(p_route uuid)
returns routes
language plpgsql security definer set search_path = public
as $$
declare
  r routes;
begin
  update routes set driver_id = null, status = 'open', recurring = false
   where id = p_route and driver_id = auth.uid() and status = 'claimed'
  returning * into r;
  if r.id is null then raise exception 'Route cannot be skipped'; end if;
  perform sync_stops(r.id);
  if now() >= route_cutoff(r.route_date) then
    insert into reliability_events (user_id, kind, route_id) values (auth.uid(), 'late_drop', r.id);
  end if;
  return r;
end;
$$;

-- Stop holding a community every week (dates already claimed stay claimed).
create or replace function public.end_commitment(p_community text)
returns void
language sql security definer set search_path = public
as $$
  delete from route_commitments where community = p_community and driver_id = auth.uid();
  update routes set recurring = false where community = p_community and driver_id = auth.uid();
$$;

create or replace function public.start_route(p_route uuid)
returns routes
language plpgsql security definer set search_path = public
as $$
declare
  r routes;
begin
  update routes set status = 'in_progress', started_at = now()
   where id = p_route and driver_id = auth.uid() and status = 'claimed' and route_date <= current_date
  returning * into r;
  if r.id is null then raise exception 'Route can only be started on its day'; end if;
  perform sync_stops(r.id);
  return r;
end;
$$;

-- All collected stops delivered to the center. Every stop must be collected or marked first.
create or replace function public.complete_route(p_route uuid)
returns routes
language plpgsql security definer set search_path = public
as $$
declare
  r routes;
begin
  select * into r from routes where id = p_route and driver_id = auth.uid() and status = 'in_progress' for update;
  if r.id is null then raise exception 'Route is not in progress'; end if;
  if exists (select 1 from pickup_requests where route_id = p_route and status = 'en_route') then
    raise exception 'Finish every stop first';
  end if;
  update pickup_requests set status = 'deposited', deposited_at = now(), updated_at = now()
   where route_id = p_route and status = 'picked_up';
  update routes set status = 'completed', completed_at = now() where id = p_route returning * into r;
  return r;
end;
$$;

-- ---------------------------------------------------------------------------
-- Driver actions: stops
-- ---------------------------------------------------------------------------

create or replace function public.mark_arrived(request_id uuid)
returns pickup_requests
language plpgsql security definer set search_path = public
as $$
declare result pickup_requests;
begin
  update pickup_requests set arrived_at = coalesce(arrived_at, now()), updated_at = now()
   where id = request_id and driver_id = auth.uid() and status = 'en_route'
  returning * into result;
  if result.id is null then raise exception 'Stop is not active'; end if;
  return result;
end;
$$;

create or replace function public.mark_contacted(request_id uuid)
returns pickup_requests
language plpgsql security definer set search_path = public
as $$
declare result pickup_requests;
begin
  update pickup_requests set contacted_at = coalesce(contacted_at, now()), updated_at = now()
   where id = request_id and driver_id = auth.uid() and status = 'en_route'
  returning * into result;
  if result.id is null then raise exception 'Stop is not active'; end if;
  return result;
end;
$$;

-- Collected. Doorstep pickups need a photo of the bags.
create or replace function public.collect_stop(request_id uuid, kg numeric default null, photo text default null)
returns pickup_requests
language plpgsql security definer set search_path = public
as $$
declare
  p pickup_requests;
begin
  select * into p from pickup_requests where id = request_id and driver_id = auth.uid() and status = 'en_route' for update;
  if p.id is null then raise exception 'Stop is not active'; end if;
  if p.pickup_mode = 'doorstep' and coalesce(photo, p.photo_url) is null then
    raise exception 'Take a photo of the bags first';
  end if;
  update pickup_requests
     set status = 'picked_up', actual_kg = coalesce(kg, actual_kg), photo_url = coalesce(photo, photo_url),
         picked_up_at = now(), updated_at = now()
   where id = request_id
  returning * into p;
  return p;
end;
$$;

-- Couldn't collect. In person: only after waiting and trying to contact the donor.
create or replace function public.no_show_stop(request_id uuid, note text, photo text default null)
returns pickup_requests
language plpgsql security definer set search_path = public
as $$
declare
  p pickup_requests;
begin
  select * into p from pickup_requests where id = request_id and driver_id = auth.uid() and status = 'en_route' for update;
  if p.id is null then raise exception 'Stop is not active'; end if;
  if coalesce(trim(note), '') = '' then raise exception 'Say what happened'; end if;
  if p.pickup_mode = 'in_person' then
    if p.arrived_at is null or now() < p.arrived_at + no_show_wait() then
      raise exception 'Wait % minutes after arriving first', (extract(epoch from no_show_wait()) / 60)::int;
    end if;
    if p.contacted_at is null then raise exception 'Call or message the donor first'; end if;
  end if;
  update pickup_requests
     set status = 'no_show', status_note = note, photo_url = coalesce(photo, photo_url), updated_at = now()
   where id = request_id
  returning * into p;
  return p;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ratings & reputation
-- ---------------------------------------------------------------------------

create or replace function public.rate_request(p_request uuid, p_stars int, p_tags text[], p_comment text)
returns ratings
language plpgsql security definer set search_path = public
as $$
declare
  p pickup_requests;
  other uuid;
  result ratings;
begin
  select * into p from pickup_requests where id = p_request;
  if p.id is null or p.status not in ('picked_up', 'deposited', 'no_show') then
    raise exception 'You can rate once the pickup is done';
  end if;
  if auth.uid() = p.donor_id then other := p.driver_id;
  elsif auth.uid() = p.driver_id then other := p.donor_id;
  else raise exception 'Not your pickup';
  end if;
  if other is null then raise exception 'Nobody to rate'; end if;

  insert into ratings (request_id, rater_id, ratee_id, stars, tags, comment)
  values (p_request, auth.uid(), other, p_stars, coalesce(p_tags, '{}'), nullif(trim(p_comment), ''))
  on conflict (request_id, rater_id) do update
    set stars = excluded.stars, tags = excluded.tags, comment = excluded.comment, created_at = now()
  returning * into result;
  return result;
end;
$$;

create or replace function public.reputation(user_ids uuid[])
returns table (user_id uuid, rating_avg numeric, rating_count bigint, completed bigint, no_shows bigint, late_drops bigint)
language sql stable security definer set search_path = public
as $$
  select u.id,
         (select round(avg(stars), 2) from ratings where ratee_id = u.id),
         (select count(*) from ratings where ratee_id = u.id),
         (select count(*) from pickup_requests where status = 'deposited' and (donor_id = u.id or driver_id = u.id)),
         (select count(*) from pickup_requests where status = 'no_show' and donor_id = u.id),
         (select count(*) from reliability_events where user_id = u.id and kind = 'late_drop')
    from unnest(user_ids) as u(id);
$$;

-- ---------------------------------------------------------------------------
-- Impact
-- ---------------------------------------------------------------------------

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
   where r.status = 'deposited' and (since is null or r.deposited_at >= since)
   group by p.id
   order by 3 desc
   limit max_rows;
$$;

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

-- ---------------------------------------------------------------------------
-- Grants: internal helpers are not callable from the app
-- ---------------------------------------------------------------------------

revoke execute on function public.ensure_route(text, date) from public, anon, authenticated;
revoke execute on function public.sync_stops(uuid) from public, anon, authenticated;

grant execute on function public.community_stats() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Doorstep photos (private bucket; files stored as <request_id>/<file>)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public) values ('pickup-photos', 'pickup-photos', false)
on conflict (id) do nothing;

create policy "photos: driver uploads for own stop" on storage.objects for insert to authenticated with check (
  bucket_id = 'pickup-photos' and exists (
    select 1 from public.pickup_requests r
    where r.id::text = (storage.foldername(name))[1] and r.driver_id = auth.uid()
  )
);

create policy "photos: donor and driver can view" on storage.objects for select to authenticated using (
  bucket_id = 'pickup-photos' and exists (
    select 1 from public.pickup_requests r
    where r.id::text = (storage.foldername(name))[1] and (r.driver_id = auth.uid() or r.donor_id = auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.pickup_requests;
alter publication supabase_realtime add table public.routes;
alter publication supabase_realtime add table public.driver_locations;
