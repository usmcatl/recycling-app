// Loads supabase/migrations/0001_init.sql into PGlite (real Postgres in WASM) with
// minimal Supabase stubs, then exercises the route-day / rating rules as real users with RLS on.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const sql = readFileSync(process.argv[2] ?? new URL('../migrations/0001_init.sql', import.meta.url), 'utf8');
const db = new PGlite();

const stubs = `
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  create publication supabase_realtime;
`;

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`);
  if (!cond) failures++;
};

async function as(uid, query, params = []) {
  await db.exec(`reset role; select set_config('test.uid', '${uid ?? ''}', false); set role authenticated;`);
  try {
    return await db.query(query, params);
  } finally {
    await db.exec('reset role');
  }
}
async function expectError(uid, query, params, pattern, msg) {
  try {
    await as(uid, query, params);
    ok(false, `${msg} (no error)`);
  } catch (e) {
    ok(pattern.test(e.message), `${msg} → "${e.message}"`);
  }
}

await db.exec(stubs);
await db.exec(sql);
await db.exec(`
  grant usage on schema public to authenticated, anon;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant usage on all sequences in schema public to authenticated;
`);
console.log('schema loaded');

const A = '00000000-0000-0000-0000-00000000000a'; // donor, doorstep
const B = '00000000-0000-0000-0000-00000000000b'; // donor, in person
const C = '00000000-0000-0000-0000-00000000000c'; // donor, next week
const D = '00000000-0000-0000-0000-00000000000d'; // driver
const E = '00000000-0000-0000-0000-00000000000e'; // other driver
for (const [id, role, name] of [[A, 'donor', 'Ana López'], [B, 'donor', 'Beto Ruiz'], [C, 'donor', 'Carla Díaz'], [D, 'driver', 'Diego Vega'], [E, 'driver', 'Eva Soto']]) {
  await db.query('insert into auth.users (id) values ($1)', [id]);
  await db.query("insert into profiles (id, role, full_name, community, whatsapp) values ($1, $2, $3, 'Ajijic', '+52 376 000 0000')", [id, role, name]);
}

// next two Tuesdays (Ajijic = weekday 2) that are still before the cutoff
const { rows: [d] } = await db.query(`
  select min(x::date)::text as d1, (min(x::date) + 7)::text as d2 from generate_series(current_date + 2, current_date + 9, interval '1 day') x
  where extract(dow from x) = 2`);
const create = `select * from create_request($1::text[], null, $2, $3::date, $4::pickup_mode, null, 'Calle 1', 'Ajijic', 20.3, -103.26, $5)`;

// --- donors sign up ---
const { rows: [ra] } = await as(A, create, [['paper'], 3, d.d1, 'doorstep', 15]);
const { rows: [rb] } = await as(B, create, [['glass'], 2, d.d1, 'in_person', 10]);
ok(ra.status === 'open' && ra.route_id === rb.route_id, 'two donors share one open route');
await expectError(A, create, [['paper'], 1, d.d1.replace(/\d\d$/, (x) => String(Number(x) + 1).padStart(2, '0')), 'doorstep', 5], /Not a route day/, 'wrong weekday rejected');
await expectError(A, create, [['paper'], 1, new Date().toISOString().slice(0, 10), 'doorstep', 5], /Not a route day|closed/, 'past-cutoff / non-route date rejected');
await expectError(A, create, [['paper'], 4, d.d1, 'doorstep', 20], /up to 3 bags/, 'bag limit: more than the default 3 rejected while the route has no driver');

const { rows: mine } = await as(A, 'select id from pickup_requests');
ok(mine.length === 1 && mine[0].id === ra.id, 'RLS: donor only sees own requests');
await expectError(A, "insert into pickup_requests (donor_id, route_id, route_date, materials, bag_count, address, community, estimated_kg) values ($1, $2, current_date, '{paper}', 1, 'x', 'Ajijic', 1)", [A, ra.route_id], /permission|policy|row-level/i, 'RLS: no direct inserts');

// --- drivers claim ---
const { rows: board } = await as(D, 'select * from route_board(current_date, current_date + 14)');
ok(board.length === 1 && Number(board[0].stop_count) === 2, 'route board shows the route with 2 stops');
await expectError(A, 'select * from claim_route($1, false)', [ra.route_id], /Only drivers/, 'donor cannot claim');
await as(D, 'select * from claim_route($1, true)', [ra.route_id]);
const { rows: [afterClaim] } = await db.query('select status, driver_id from pickup_requests where id = $1', [ra.id]);
ok(afterClaim.status === 'claimed' && afterClaim.driver_id === D, 'claiming a route claims its stops');
await expectError(E, 'select * from claim_route($1, false)', [ra.route_id], /no longer available/, 'second driver cannot take the same route');

const { rows: driverSees } = await as(D, 'select full_name from profiles order by full_name');
ok(driverSees.length === 3, `RLS: driver sees own profile + donors on their route (${driverSees.map((x) => x.full_name).join(', ')})`);

// bag limit follows the driver's own setting, including on next week's route via the weekly commitment
await as(D, 'update profiles set max_bags = 5 where id = $1', [D]);
const { rows: [lim] } = await as(C, "select bag_limit('Ajijic', $1::date) as n", [d.d2]);
ok(lim.n === 5, `bag limit comes from the weekly driver (${lim.n})`);
await expectError(C, create, [['metal'], 6, d.d2, 'doorstep', 30], /up to 5 bags/, 'bag limit: more than the driver’s limit rejected');

// weekly commitment: a new sign-up next week lands on D's route automatically
const { rows: [rc] } = await as(C, create, [['metal'], 5, d.d2, 'doorstep', 25]);
ok(rc.status === 'claimed' && rc.driver_id === D, 'weekly driver gets next week’s route automatically');

// --- route day ---
await expectError(D, 'select * from start_route($1)', [ra.route_id], /on its day/, 'cannot start before the route day');
await db.query('update routes set route_date = current_date where id = $1', [ra.route_id]);
await db.query('update pickup_requests set route_date = current_date where route_id = $1', [ra.route_id]);
await as(D, 'insert into driver_locations (driver_id, lat, lng) values ($1, 20.3, -103.26)', [D]);
const { rows: seenBefore } = await as(A, 'select * from driver_locations');
ok(seenBefore.length === 0, 'location: donor cannot see the driver before the route starts');
await as(D, 'select * from start_route($1)', [ra.route_id]);
const { rows: [enr] } = await db.query('select status from pickup_requests where id = $1', [rb.id]);
ok(enr.status === 'en_route', 'starting the route puts stops en route');
const { rows: seenDuring } = await as(A, 'select * from driver_locations');
ok(seenDuring.length === 1, 'location: donor sees the driver while the route is in progress');

await expectError(D, 'select * from collect_stop($1, 12, null)', [ra.id], /photo/, 'doorstep needs a photo');
await as(D, "select * from collect_stop($1, 12, 'req/photo.jpg')", [ra.id]);

await expectError(D, "select * from no_show_stop($1, 'nobody home', null)", [rb.id], /Wait/, 'in-person no-show blocked before waiting');
await as(D, 'select * from mark_arrived($1)', [rb.id]);
await db.query("update pickup_requests set arrived_at = now() - interval '6 minutes' where id = $1", [rb.id]);
await expectError(D, "select * from no_show_stop($1, 'nobody home', null)", [rb.id], /Call or message/, 'in-person no-show blocked before contacting');
await as(D, 'select * from mark_contacted($1)', [rb.id]);
await as(D, "select * from no_show_stop($1, 'nobody home', null)", [rb.id]);

await as(D, 'select * from complete_route($1)', [ra.route_id]);
const { rows: [dep] } = await db.query('select status, actual_kg from pickup_requests where id = $1', [ra.id]);
ok(dep.status === 'deposited' && Number(dep.actual_kg) === 12, 'completing the route delivers collected stops');
const { rows: [locLeft] } = await db.query('select count(*)::int as n from driver_locations where driver_id = $1', [D]);
ok(locLeft.n === 0, 'location: sharing stops when the route is completed');

// --- private feedback & reputation ---
await as(A, `select * from rate_request($1, '{"pickedUp": true, "onTime": true, "problem": false}', 'Great')`, [ra.id]);
await as(D, `select * from rate_request($1, '{"bagsReady": true, "asListed": true, "problem": false}', null)`, [ra.id]);
await as(A, `select * from rate_request($1, '{"pickedUp": true, "onTime": false, "problem": false}', null)`, [ra.id]); // edit own
await expectError(E, `select * from rate_request($1, '{}', null)`, [ra.id], /Not your pickup/, 'outsider cannot give feedback');
await expectError(C, `select * from rate_request($1, '{}', null)`, [rc.id], /once the pickup is done/, 'cannot give feedback before pickup');
const { rows: [mineGiven] } = await as(A, 'select answers from ratings where rater_id = $1', [A]);
ok(mineGiven?.answers.onTime === false, 'feedback updated after edit');
const { rows: aboutMe } = await as(D, 'select * from ratings where ratee_id = $1', [D]);
ok(aboutMe.length === 0, 'feedback is private: the driver cannot read feedback about them');
const { rows: rep } = await as(A, 'select * from reputation($1::uuid[])', [[D, A, B]]);
const byId = Object.fromEntries(rep.map((r) => [r.user_id, r]));
ok(!('rating_avg' in byId[D]), 'reputation has no star average');
ok(Number(byId[A].completed) === 1 && Number(byId[B].no_shows) === 1, 'reputation counts completed and missed');

// --- skips and late drops ---
const { rows: [nextRoute] } = await db.query('select id from routes where id = $1', [rc.route_id]);
await as(D, 'select * from skip_route($1)', [nextRoute.id]);
const { rows: [skipped] } = await db.query('select r.status, p.status as stop_status, p.driver_id from routes r join pickup_requests p on p.route_id = r.id where r.id = $1', [nextRoute.id]);
ok(skipped.status === 'open' && skipped.stop_status === 'open' && skipped.driver_id === null, 'skipping reopens the route and its stops');
const { rows: [ev1] } = await db.query('select count(*)::int as n from reliability_events');
ok(ev1.n === 0, 'skipping before the cutoff is not a late drop');

// late cancel: move C’s route to tomorrow so we’re past the 20:00-the-night-before cutoff only if it's late; force it
await db.query("update pickup_requests set route_date = current_date where id = $1", [rc.id]);
await as(C, 'select * from cancel_request($1)', [rc.id]);
const { rows: [ev2] } = await db.query("select count(*)::int as n from reliability_events where user_id = $1", [C]);
ok(ev2.n === 1, 'cancelling on the route day records a late drop');

// no daily cap: one driver can take three routes on the same day
const same = [];
for (const community of ['Ajijic', 'La Floresta', 'Test Town']) {
  if (community === 'Test Town') await db.query("insert into route_schedule (community, weekday) values ('Test Town', 2)");
  const { rows: [r] } = await db.query("insert into routes (community, route_date) values ($1, $2) on conflict (community, route_date) do update set status = 'open', driver_id = null returning id", [community, d.d2]);
  same.push(r.id);
}
for (const id of same) await as(E, 'select * from claim_route($1, false)', [id]);
const { rows: [held] } = await db.query('select count(*)::int as n from routes where driver_id = $1 and route_date = $2', [E, d.d2]);
ok(held.n === 3, 'no daily cap: a driver can take 3 routes on one day');

const { rows: gone } = await db.query("select community from route_schedule where community in ('Mezcala', 'Santa Cruz de la Soledad')");
ok(gone.length === 0, 'Mezcala and Santa Cruz de la Soledad are out of the service area');

const { rows: lb } = await as(A, 'select * from leaderboard(null, 10)');
ok(lb.length === 1 && lb[0].display_name === 'Ana L.', `leaderboard shows "${lb[0]?.display_name}"`);

console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
