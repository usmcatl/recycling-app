import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Api } from './api';
import { KG_PER_BAG, LAKESIDE_CENTER, MAX_ROUTES_PER_DAY, NO_SHOW_WAIT_MINUTES } from './constants';
import { isPastCutoff, routeWeekday, todayIso, upcomingRouteDays } from './schedule';
import type {
  Contact,
  LatLng,
  PickupRequest,
  Profile,
  Rating,
  RequestStatus,
  Reputation,
  Route,
} from './types';

/**
 * On-device backend used when Supabase isn't configured. Mirrors the rules in
 * supabase/migrations/0001_init.sql so the app behaves the same in demo mode.
 * Any email signs in and any 6-digit code is accepted.
 */

const STORAGE_KEY = 'recycle-connect-demo-v2';

type StoredRoute = Omit<Route, 'stop_count' | 'estimated_kg' | 'driver'>;

type State = {
  userId: string | null;
  profiles: Record<string, Profile>;
  routes: StoredRoute[];
  commitments: Record<string, string>; // community -> driver id
  requests: PickupRequest[];
  ratings: Rating[];
  lateDrops: { user_id: string; at: string }[];
  locations: Record<string, LatLng>;
  nextCase: number;
};

const baseProfile: Omit<Profile, 'id' | 'role' | 'full_name'> = {
  whatsapp: null,
  locale: 'es',
  address: null,
  community: null,
  lat: null,
  lng: null,
  vehicle_make: null,
  vehicle_model: null,
  vehicle_color: null,
  vehicle_plate: null,
  is_active: false,
  conduct_accepted_at: null,
  notify_push: true,
  notify_whatsapp: true,
  notify_email: false,
  notify_updates: true,
  notify_status: true,
  notify_impact: true,
  notify_tips: false,
};

const uuid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const now = () => new Date().toISOString();

function seed(): State {
  const people: [string, string, string, number, number][] = [
    ['demo-elena', 'Elena Rodríguez', 'Ajijic', 20.2985, -103.2672],
    ['demo-aisha', 'Aisha Khan', 'Ajijic', 20.3012, -103.2558],
    ['demo-tom', 'Tom Becker', 'Ajijic', 20.2961, -103.2611],
    ['demo-marcus', 'Marcus Chen', 'San Antonio Tlayacapan', 20.2949, -103.2341],
    ['demo-sarah', 'Sarah Jenkins', 'Riberas del Pilar', 20.2921, -103.2149],
    ['demo-rosa', 'Rosa Méndez', 'San Antonio Tlayacapan', 20.2938, -103.2289],
    ['demo-david', 'David Miller', 'Chapala', 20.2945, -103.1912],
    ['demo-lupita', 'Lupita Hernández', 'San Juan Cosalá', 20.2817, -103.3255],
  ];
  const s: State = {
    userId: null,
    profiles: {},
    routes: [],
    commitments: {},
    requests: [],
    ratings: [],
    lateDrops: [],
    locations: {},
    nextCase: 1001,
  };
  people.forEach(([id, full_name, community, lat, lng], i) => {
    s.profiles[id] = {
      ...baseProfile,
      id,
      role: 'donor',
      full_name,
      community,
      lat,
      lng,
      whatsapp: '+52 376 765 0000',
      address: `Calle Hidalgo ${10 + i * 7}, ${community}`,
      conduct_accepted_at: now(),
    };
  });
  s.profiles['demo-driver-jose'] = {
    ...baseProfile,
    id: 'demo-driver-jose',
    role: 'driver',
    full_name: 'José Ramírez',
    whatsapp: '+52 376 766 1111',
    vehicle_make: 'Toyota',
    vehicle_model: 'Hilux',
    vehicle_color: 'Verde',
    vehicle_plate: 'JAL-492-C',
    conduct_accepted_at: now(),
  };
  s.locations['demo-driver-jose'] = { lat: LAKESIDE_CENTER.lat + 0.004, lng: LAKESIDE_CENTER.lng - 0.01 };
  // José drives Jocotepec every week (leaves the nearer routes open for new drivers to try)
  s.commitments['Jocotepec'] = 'demo-driver-jose';

  const stop = (
    donorId: string,
    route: StoredRoute,
    bags: number,
    materials: PickupRequest['materials'],
    extra: Partial<PickupRequest> = {},
  ) => {
    const p = s.profiles[donorId];
    const n = s.nextCase++;
    const r: PickupRequest = {
      id: `req-${n}`,
      case_code: `RC-${n}`,
      donor_id: donorId,
      driver_id: route.driver_id,
      route_id: route.id,
      route_date: route.route_date,
      status: route.driver_id ? 'claimed' : 'open',
      pickup_mode: 'doorstep',
      materials,
      other_material: null,
      bag_count: bags,
      instructions: null,
      address: p.address!,
      community: p.community!,
      lat: p.lat,
      lng: p.lng,
      estimated_kg: bags * KG_PER_BAG,
      actual_kg: null,
      photo_url: null,
      status_note: null,
      arrived_at: null,
      contacted_at: null,
      picked_up_at: null,
      deposited_at: null,
      created_at: now(),
      ...extra,
    };
    s.requests.push(r);
    return r;
  };

  // Past completed routes feed the leaderboard and reputations.
  const past: [string, number, number][] = [
    ['demo-elena', -6, 62], ['demo-elena', -13, 48], ['demo-elena', -20, 55],
    ['demo-marcus', -7, 41], ['demo-marcus', -14, 38],
    ['demo-sarah', -7, 44], ['demo-david', -5, 33], ['demo-lupita', -4, 29], ['demo-aisha', -6, 18],
  ];
  for (const [donorId, offset, kg] of past) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const date = todayIso(d);
    const community = s.profiles[donorId].community!;
    let route = s.routes.find((r) => r.community === community && r.route_date === date);
    if (!route) {
      route = {
        id: `route-${uuid()}`,
        community,
        route_date: date,
        driver_id: 'demo-driver-jose',
        recurring: false,
        status: 'completed',
        started_at: d.toISOString(),
        completed_at: d.toISOString(),
      };
      s.routes.push(route);
    }
    const r = stop(donorId, route, Math.ceil(kg / KG_PER_BAG), ['paper', 'plastic'], {
      status: 'deposited',
      actual_kg: kg,
      picked_up_at: d.toISOString(),
      deposited_at: d.toISOString(),
    });
    s.ratings.push(
      { request_id: r.id, rater_id: donorId, ratee_id: 'demo-driver-jose', stars: 5, tags: ['onTime', 'friendly'], comment: null, created_at: d.toISOString() },
      { request_id: r.id, rater_id: 'demo-driver-jose', ratee_id: donorId, stars: kg > 40 ? 5 : 4, tags: ['bagsReady'], comment: null, created_at: d.toISOString() },
    );
  }

  // Upcoming route days with stops waiting for drivers.
  const upcoming: [string, number, PickupRequest['materials'], Partial<PickupRequest>?][] = [
    ['demo-marcus', 3, ['paper', 'glass'], { instructions: 'Portón verde, junto al buzón.' }],
    ['demo-rosa', 4, ['plastic', 'metal'], { pickup_mode: 'in_person' }],
    ['demo-sarah', 2, ['ewaste'], { instructions: 'Old laptop and two phone chargers.' }],
    ['demo-elena', 5, ['paper', 'plastic', 'glass']],
    ['demo-aisha', 2, ['glass']],
    ['demo-tom', 3, ['metal', 'plastic'], { pickup_mode: 'in_person' }],
    ['demo-david', 6, ['plastic', 'metal']],
    ['demo-lupita', 2, ['ewaste']],
  ];
  const days = upcomingRouteDays(8);
  for (const [donorId, bags, materials, extra] of upcoming) {
    const community = s.profiles[donorId].community!;
    const day = days.find((d) => d.community === community);
    if (!day) continue;
    stop(donorId, ensureRoute(s, community, day.route_date), bags, materials, extra);
  }
  return s;
}

/** Get or create a route; a new route goes to the community's weekly driver. */
function ensureRoute(s: State, community: string, date: string): StoredRoute {
  let route = s.routes.find((r) => r.community === community && r.route_date === date);
  if (!route) {
    const driver = s.commitments[community] ?? null;
    route = {
      id: `route-${uuid()}`,
      community,
      route_date: date,
      driver_id: driver,
      recurring: !!driver,
      status: driver ? 'claimed' : 'open',
      started_at: null,
      completed_at: null,
    };
    s.routes.push(route);
  }
  return route;
}

/** Push a route's driver/status onto its stops that haven't been collected yet. */
function syncStops(s: State, route: StoredRoute) {
  if (route.status === 'completed') return;
  const status: RequestStatus = route.status === 'open' ? 'open' : route.status === 'claimed' ? 'claimed' : 'en_route';
  for (const r of s.requests) {
    if (r.route_id !== route.id || !['open', 'claimed', 'en_route'].includes(r.status)) continue;
    r.driver_id = route.driver_id;
    r.status = status;
  }
}

let state: State | null = null;
const authListeners = new Set<(id: string | null) => void>();
const changeListeners = new Set<() => void>();

async function load(): Promise<State> {
  if (state) return state;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    state = raw ? (JSON.parse(raw) as State) : seed();
  } catch {
    state = seed();
  }
  return state;
}

async function save() {
  if (!state) return;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // demo data is best-effort
  }
  changeListeners.forEach((cb) => cb());
}

function contact(p: Profile | undefined): Contact | null {
  if (!p) return null;
  const { id, full_name, whatsapp, vehicle_make, vehicle_model, vehicle_color, vehicle_plate } = p;
  return { id, full_name, whatsapp, vehicle_make, vehicle_model, vehicle_color, vehicle_plate };
}

function hydrate(s: State, r: PickupRequest): PickupRequest {
  return { ...r, donor: contact(s.profiles[r.donor_id]), driver: r.driver_id ? contact(s.profiles[r.driver_id]) : null };
}

function withCounts(s: State, route: StoredRoute): Route {
  const stops = s.requests.filter((r) => r.route_id === route.id && r.status !== 'cancelled');
  return {
    ...route,
    stop_count: stops.length,
    estimated_kg: stops.reduce((sum, r) => sum + r.estimated_kg, 0),
    driver: route.driver_id ? contact(s.profiles[route.driver_id]) : null,
  };
}

async function me(): Promise<{ s: State; id: string }> {
  const s = await load();
  if (!s.userId) throw new Error('Not signed in');
  return { s, id: s.userId };
}

async function withStop(id: string, fn: (r: PickupRequest, s: State, userId: string) => void) {
  const { s, id: userId } = await me();
  const r = s.requests.find((x) => x.id === id);
  if (!r) throw new Error('Request not found');
  fn(r, s, userId);
  await save();
}

async function withRoute(id: string, fn: (route: StoredRoute, s: State, userId: string) => void) {
  const { s, id: userId } = await me();
  const route = s.routes.find((x) => x.id === id);
  if (!route) throw new Error('Route not found');
  fn(route, s, userId);
  await save();
}

function assertActiveStop(r: PickupRequest, userId: string) {
  if (r.driver_id !== userId || r.status !== 'en_route') throw new Error('Stop is not active');
}

const pause = (ms = 250) => new Promise((res) => setTimeout(res, ms));

export const demoApi: Api = {
  mode: 'demo',

  async currentUserId() {
    return (await load()).userId;
  },

  onAuthChange(cb) {
    authListeners.add(cb);
    return () => authListeners.delete(cb);
  },

  async sendCode() {
    await pause();
  },

  async verifyCode(email, code) {
    await pause();
    if (!/^\d{6}$/.test(code)) throw new Error('Enter the 6-digit code');
    const s = await load();
    s.userId = `user-${email.trim().toLowerCase()}`;
    await save();
    authListeners.forEach((cb) => cb(s.userId));
  },

  async signOut() {
    const s = await load();
    s.userId = null;
    await save();
    authListeners.forEach((cb) => cb(null));
  },

  async getMyProfile() {
    const s = await load();
    return s.userId ? (s.profiles[s.userId] ?? null) : null;
  },

  async saveProfile(input) {
    const { s, id } = await me();
    s.profiles[id] = { ...baseProfile, ...s.profiles[id], ...input, id };
    await save();
    return s.profiles[id];
  },

  async createRequest(d) {
    const { s, id } = await me();
    const weekday = routeWeekday(d.community);
    if (weekday == null) throw new Error(`No route serves ${d.community}`);
    if (new Date(`${d.route_date}T12:00:00`).getDay() !== weekday) throw new Error(`Not a route day for ${d.community}`);
    if (isPastCutoff(d.route_date)) throw new Error('Requests for this day are closed');
    const route = ensureRoute(s, d.community, d.route_date);
    if (route.status === 'in_progress' || route.status === 'completed') throw new Error('This route has already started');
    const n = s.nextCase++;
    const r: PickupRequest = {
      ...d,
      id: `req-${n}`,
      case_code: `RC-${n}`,
      donor_id: id,
      driver_id: route.driver_id,
      route_id: route.id,
      status: route.driver_id ? 'claimed' : 'open',
      estimated_kg: d.bag_count * KG_PER_BAG,
      actual_kg: null,
      photo_url: null,
      status_note: null,
      arrived_at: null,
      contacted_at: null,
      picked_up_at: null,
      deposited_at: null,
      created_at: now(),
    };
    s.requests.unshift(r);
    await save();
    return hydrate(s, r);
  },

  async listMyRequests() {
    const { s, id } = await me();
    return s.requests
      .filter((r) => r.donor_id === id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((r) => hydrate(s, r));
  },

  async cancelRequest(id) {
    await withStop(id, (r, s, userId) => {
      if (r.donor_id !== userId || !['open', 'claimed', 'en_route'].includes(r.status)) {
        throw new Error('Request cannot be cancelled');
      }
      r.status = 'cancelled';
      if (isPastCutoff(r.route_date)) s.lateDrops.push({ user_id: userId, at: now() });
    });
  },

  async getRequest(id) {
    const s = await load();
    const r = s.requests.find((x) => x.id === id);
    return r ? hydrate(s, r) : null;
  },

  subscribeRequest(id, cb) {
    const listener = async () => {
      const r = await demoApi.getRequest(id);
      if (r) cb(r);
    };
    changeListeners.add(listener);
    return () => changeListeners.delete(listener);
  },

  async photoUrl(ref) {
    return ref;
  },

  async routeBoard(days) {
    const s = await load();
    const from = todayIso();
    const end = new Date();
    end.setDate(end.getDate() + days);
    const to = todayIso(end);
    return s.routes.filter((r) => r.route_date >= from && r.route_date <= to).map((r) => withCounts(s, r));
  },

  async getRoute(id) {
    const s = await load();
    const r = s.routes.find((x) => x.id === id);
    return r ? withCounts(s, r) : null;
  },

  async listRouteStops(routeId) {
    const s = await load();
    return s.requests.filter((r) => r.route_id === routeId && r.status !== 'cancelled').map((r) => hydrate(s, r));
  },

  async listMyCommitments() {
    const { s, id } = await me();
    return Object.entries(s.commitments)
      .filter(([, d]) => d === id)
      .map(([c]) => c);
  },

  subscribeRoutes(cb) {
    changeListeners.add(cb);
    return () => changeListeners.delete(cb);
  },

  async claimRoute(routeId, everyWeek) {
    await withRoute(routeId, (route, s, userId) => {
      if (s.profiles[userId]?.role !== 'driver') throw new Error('Only drivers can claim routes');
      if (route.status !== 'open') throw new Error('This route is no longer available');
      if (route.route_date < todayIso()) throw new Error('This route has passed');
      const held = s.routes.filter(
        (r) => r.driver_id === userId && r.route_date === route.route_date && r.status !== 'completed',
      ).length;
      if (held >= MAX_ROUTES_PER_DAY) throw new Error(`You already have ${held} routes that day`);
      if (everyWeek) {
        const holder = s.commitments[route.community];
        if (holder && holder !== userId) throw new Error(`Another driver already holds ${route.community} every week`);
        s.commitments[route.community] = userId;
      }
      Object.assign(route, { driver_id: userId, status: 'claimed', recurring: everyWeek });
      syncStops(s, route);
      if (everyWeek) {
        for (const later of s.routes) {
          if (later.community === route.community && later.route_date > route.route_date && later.status === 'open') {
            Object.assign(later, { driver_id: userId, status: 'claimed', recurring: true });
            syncStops(s, later);
          }
        }
      }
    });
  },

  async skipRoute(routeId) {
    await withRoute(routeId, (route, s, userId) => {
      if (route.driver_id !== userId || route.status !== 'claimed') throw new Error('Route cannot be skipped');
      Object.assign(route, { driver_id: null, status: 'open', recurring: false });
      syncStops(s, route);
      if (isPastCutoff(route.route_date)) s.lateDrops.push({ user_id: userId, at: now() });
    });
  },

  async endCommitment(community) {
    const { s, id } = await me();
    if (s.commitments[community] === id) delete s.commitments[community];
    for (const r of s.routes) if (r.community === community && r.driver_id === id) r.recurring = false;
    await save();
  },

  async startRoute(routeId) {
    await withRoute(routeId, (route, s, userId) => {
      if (route.driver_id !== userId || route.status !== 'claimed' || route.route_date > todayIso()) {
        throw new Error('Route can only be started on its day');
      }
      Object.assign(route, { status: 'in_progress', started_at: now() });
      syncStops(s, route);
    });
  },

  async completeRoute(routeId) {
    await withRoute(routeId, (route, s, userId) => {
      if (route.driver_id !== userId || route.status !== 'in_progress') throw new Error('Route is not in progress');
      const stops = s.requests.filter((r) => r.route_id === route.id);
      if (stops.some((r) => r.status === 'en_route')) throw new Error('Finish every stop first');
      for (const r of stops) if (r.status === 'picked_up') Object.assign(r, { status: 'deposited', deposited_at: now() });
      Object.assign(route, { status: 'completed', completed_at: now() });
    });
  },

  async listMyStops() {
    const { s, id } = await me();
    return s.requests
      .filter((r) => r.driver_id === id)
      .sort((a, b) => b.route_date.localeCompare(a.route_date))
      .map((r) => hydrate(s, r));
  },

  async markArrived(requestId) {
    await withStop(requestId, (r, _s, userId) => {
      assertActiveStop(r, userId);
      r.arrived_at ??= now();
    });
  },

  async markContacted(requestId) {
    await withStop(requestId, (r, _s, userId) => {
      assertActiveStop(r, userId);
      r.contacted_at ??= now();
    });
  },

  async uploadPhoto(_requestId, localUri) {
    return localUri;
  },

  async collectStop(requestId, { kg, photo }) {
    await withStop(requestId, (r, _s, userId) => {
      assertActiveStop(r, userId);
      if (r.pickup_mode === 'doorstep' && !(photo ?? r.photo_url)) throw new Error('Take a photo of the bags first');
      Object.assign(r, { status: 'picked_up', actual_kg: kg ?? r.actual_kg, photo_url: photo ?? r.photo_url, picked_up_at: now() });
    });
  },

  async noShowStop(requestId, { note, photo }) {
    await withStop(requestId, (r, _s, userId) => {
      assertActiveStop(r, userId);
      if (!note.trim()) throw new Error('Say what happened');
      if (r.pickup_mode === 'in_person') {
        const waited = r.arrived_at && Date.now() - new Date(r.arrived_at).getTime() >= NO_SHOW_WAIT_MINUTES * 60_000;
        if (!waited) throw new Error(`Wait ${NO_SHOW_WAIT_MINUTES} minutes after arriving first`);
        if (!r.contacted_at) throw new Error('Call or message the donor first');
      }
      Object.assign(r, { status: 'no_show', status_note: note.trim(), photo_url: photo ?? r.photo_url });
    });
  },

  async setActive(active) {
    const { s, id } = await me();
    s.profiles[id] = { ...s.profiles[id], is_active: active };
    await save();
  },

  async updateLocation(pos) {
    const { s, id } = await me();
    s.locations[id] = pos;
    await save();
  },

  async getDriverLocation(driverId) {
    return (await load()).locations[driverId] ?? null;
  },

  subscribeDriverLocation(driverId, cb) {
    const listener = async () => {
      const pos = await demoApi.getDriverLocation(driverId);
      if (pos) cb(pos);
    };
    changeListeners.add(listener);
    return () => changeListeners.delete(listener);
  },

  async rate(requestId, stars, tags, comment) {
    await withStop(requestId, (r, s, userId) => {
      if (!['picked_up', 'deposited', 'no_show'].includes(r.status)) throw new Error('You can rate once the pickup is done');
      const other = userId === r.donor_id ? r.driver_id : userId === r.driver_id ? r.donor_id : undefined;
      if (other === undefined) throw new Error('Not your pickup');
      if (!other) throw new Error('Nobody to rate');
      s.ratings = s.ratings.filter((x) => !(x.request_id === requestId && x.rater_id === userId));
      s.ratings.push({
        request_id: requestId,
        rater_id: userId,
        ratee_id: other,
        stars: Math.max(1, Math.min(5, Math.round(stars))),
        tags,
        comment: comment?.trim() || null,
        created_at: now(),
      });
    });
  },

  async myRating(requestId) {
    const { s, id } = await me();
    return s.ratings.find((x) => x.request_id === requestId && x.rater_id === id) ?? null;
  },

  async reputation(userIds) {
    const s = await load();
    const out: Record<string, Reputation> = {};
    for (const u of userIds) {
      const received = s.ratings.filter((x) => x.ratee_id === u);
      out[u] = {
        user_id: u,
        rating_avg: received.length ? received.reduce((sum, x) => sum + x.stars, 0) / received.length : null,
        rating_count: received.length,
        completed: s.requests.filter((r) => r.status === 'deposited' && (r.donor_id === u || r.driver_id === u)).length,
        no_shows: s.requests.filter((r) => r.status === 'no_show' && r.donor_id === u).length,
        late_drops: s.lateDrops.filter((x) => x.user_id === u).length,
      };
    }
    return out;
  },

  async leaderboard(period) {
    const s = await load();
    const since = new Date();
    since.setDate(1);
    since.setHours(0, 0, 0, 0);
    const totals = new Map<string, { kg: number; pickups: number }>();
    for (const r of s.requests) {
      if (r.status !== 'deposited') continue;
      if (period === 'month' && new Date(r.deposited_at!) < since) continue;
      const t = totals.get(r.donor_id) ?? { kg: 0, pickups: 0 };
      t.kg += r.actual_kg ?? r.estimated_kg;
      t.pickups += 1;
      totals.set(r.donor_id, t);
    }
    return [...totals.entries()]
      .sort((a, b) => b[1].kg - a[1].kg)
      .map(([user_id, t], i) => {
        const [first, last] = (s.profiles[user_id]?.full_name ?? '').split(' ');
        return { user_id, display_name: last ? `${first} ${last[0]}.` : first, kg: t.kg, pickups: t.pickups, rank: i + 1 };
      });
  },

  async communityStats() {
    const s = await load();
    const done = s.requests.filter((r) => r.status === 'deposited');
    const all = Object.values(s.profiles);
    return {
      total_kg: done.reduce((sum, r) => sum + (r.actual_kg ?? r.estimated_kg), 0),
      total_pickups: done.length,
      donors: all.filter((p) => p.role === 'donor').length,
      drivers: all.filter((p) => p.role === 'driver').length,
    };
  },
};
