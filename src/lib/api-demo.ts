import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Api } from './api';
import { KG_PER_BAG, LAKESIDE_CENTER } from './constants';
import type { Contact, LatLng, PickupRequest, Profile, RequestStatus } from './types';

/**
 * On-device backend used when Supabase isn't configured. Lets the whole app be
 * tried on a phone (Expo Go) with realistic Lakeside sample data. Any email
 * signs in and any 6-digit code is accepted.
 */

const STORAGE_KEY = 'recycle-connect-demo-v1';

type State = {
  userId: string | null;
  profiles: Record<string, Profile>;
  requests: PickupRequest[];
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
  notify_push: true,
  notify_whatsapp: true,
  notify_email: false,
  notify_updates: true,
  notify_status: true,
  notify_impact: true,
  notify_tips: false,
};

function daysFromToday(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function seed(): State {
  const people: [string, string, string, number, number][] = [
    ['demo-elena', 'Elena Rodríguez', 'Ajijic', 20.2985, -103.2672],
    ['demo-marcus', 'Marcus Chen', 'San Antonio Tlayacapan', 20.2949, -103.2341],
    ['demo-sarah', 'Sarah Jenkins', 'Riberas del Pilar', 20.2921, -103.2149],
    ['demo-david', 'David Miller', 'Chapala', 20.2945, -103.1912],
    ['demo-lupita', 'Lupita Hernández', 'San Juan Cosalá', 20.2817, -103.3255],
    ['demo-aisha', 'Aisha Khan', 'Ajijic', 20.3012, -103.2558],
  ];
  const profiles: Record<string, Profile> = {};
  for (const [id, full_name, community, lat, lng] of people) {
    profiles[id] = {
      ...baseProfile,
      id,
      role: 'donor',
      full_name,
      community,
      lat,
      lng,
      whatsapp: '+52 376 765 0000',
      address: `Calle Hidalgo ${10 + people.findIndex((p) => p[0] === id) * 7}, ${community}`,
    };
  }
  profiles['demo-driver-jose'] = {
    ...baseProfile,
    id: 'demo-driver-jose',
    role: 'driver',
    full_name: 'José Ramírez',
    whatsapp: '+52 376 766 1111',
    vehicle_make: 'Toyota',
    vehicle_model: 'Hilux',
    vehicle_color: 'Verde',
    vehicle_plate: 'JAL-492-C',
  };

  const requests: PickupRequest[] = [];
  let n = 1001;
  const make = (
    donorId: string,
    status: RequestStatus,
    bags: number,
    materials: PickupRequest['materials'],
    dayOffset: number,
    kg?: number,
  ): PickupRequest => {
    const p = profiles[donorId];
    const created = new Date(Date.now() + (dayOffset - 1) * 86_400_000).toISOString();
    const done = status === 'deposited';
    return {
      id: `req-${n}`,
      case_code: `RC-${n++}`,
      donor_id: donorId,
      driver_id: status === 'open' ? null : 'demo-driver-jose',
      status,
      materials,
      other_material: null,
      bag_count: bags,
      preferred_date: daysFromToday(dayOffset),
      time_window: 'morning',
      instructions: null,
      address: p.address!,
      community: p.community,
      lat: p.lat,
      lng: p.lng,
      estimated_kg: bags * KG_PER_BAG,
      actual_kg: kg ?? null,
      status_note: null,
      claimed_at: status === 'open' ? null : created,
      picked_up_at: done ? created : null,
      deposited_at: done ? created : null,
      created_at: created,
    };
  };

  // history that feeds the leaderboard
  const history: [string, number][] = [
    ['demo-elena', 62], ['demo-elena', 48], ['demo-elena', 55],
    ['demo-marcus', 41], ['demo-marcus', 38],
    ['demo-sarah', 44], ['demo-sarah', 21],
    ['demo-david', 33], ['demo-lupita', 29], ['demo-aisha', 18],
  ];
  history.forEach(([id, kg], i) =>
    requests.push(make(id, 'deposited', Math.ceil(kg / KG_PER_BAG), ['paper', 'plastic'], -3 - i * 4, kg)),
  );

  // open requests for drivers to claim
  requests.push(
    { ...make('demo-sarah', 'open', 3, ['paper', 'glass'], 1), instructions: 'Portón verde, tocar el timbre.' },
    make('demo-david', 'open', 6, ['plastic', 'metal'], 1),
    { ...make('demo-lupita', 'open', 2, ['ewaste'], 2), instructions: 'Old laptop and two phone chargers.' },
    make('demo-aisha', 'open', 4, ['paper', 'plastic', 'glass'], 3),
  );

  return {
    userId: null,
    profiles,
    requests,
    locations: { 'demo-driver-jose': { lat: LAKESIDE_CENTER.lat + 0.004, lng: LAKESIDE_CENTER.lng - 0.01 } },
    nextCase: n,
  };
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
  return {
    ...r,
    donor: contact(s.profiles[r.donor_id]),
    driver: r.driver_id ? contact(s.profiles[r.driver_id]) : null,
  };
}

async function me(): Promise<{ s: State; id: string }> {
  const s = await load();
  if (!s.userId) throw new Error('Not signed in');
  return { s, id: s.userId };
}

async function mutate(id: string, fn: (r: PickupRequest, s: State, userId: string) => void) {
  const { s, id: userId } = await me();
  const r = s.requests.find((x) => x.id === id);
  if (!r) throw new Error('Request not found');
  fn(r, s, userId);
  await save();
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

  async createRequest(draft) {
    const { s, id } = await me();
    const n = s.nextCase++;
    const r: PickupRequest = {
      ...draft,
      id: `req-${n}`,
      case_code: `RC-${n}`,
      donor_id: id,
      driver_id: null,
      status: 'open',
      estimated_kg: draft.bag_count * KG_PER_BAG,
      actual_kg: null,
      status_note: null,
      claimed_at: null,
      picked_up_at: null,
      deposited_at: null,
      created_at: new Date().toISOString(),
    };
    s.requests.unshift(r);
    await save();
    return hydrate(s, r);
  },

  async listMyRequests() {
    const { s, id } = await me();
    return s.requests.filter((r) => r.donor_id === id).map((r) => hydrate(s, r));
  },

  async cancelRequest(id) {
    await mutate(id, (r, _s, userId) => {
      if (r.donor_id !== userId || !['open', 'claimed', 'en_route'].includes(r.status)) {
        throw new Error('Request cannot be cancelled');
      }
      r.status = 'cancelled';
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

  async listOpenRequests() {
    const s = await load();
    return s.requests
      .filter((r) => r.status === 'open' && r.donor_id !== s.userId)
      .sort((a, b) => a.preferred_date.localeCompare(b.preferred_date))
      .map((r) => hydrate(s, r));
  },

  async listMyCases() {
    const { s, id } = await me();
    return s.requests.filter((r) => r.driver_id === id).map((r) => hydrate(s, r));
  },

  subscribeRequests(cb) {
    changeListeners.add(cb);
    return () => changeListeners.delete(cb);
  },

  async claimRequest(id) {
    await mutate(id, (r, _s, userId) => {
      if (r.status !== 'open') throw new Error('This request is no longer available');
      r.status = 'claimed';
      r.driver_id = userId;
      r.claimed_at = new Date().toISOString();
    });
  },

  async releaseRequest(id) {
    await mutate(id, (r, _s, userId) => {
      if (r.driver_id !== userId) throw new Error('Request cannot be released');
      r.status = 'open';
      r.driver_id = null;
      r.claimed_at = null;
    });
  },

  async advanceRequest(id, status, opts) {
    await mutate(id, (r, _s, userId) => {
      if (r.driver_id !== userId) throw new Error('Request not assigned to you');
      const allowed: Record<string, RequestStatus[]> = {
        claimed: ['en_route', 'picked_up', 'no_show'],
        en_route: ['picked_up', 'no_show'],
        picked_up: ['deposited'],
      };
      if (!allowed[r.status]?.includes(status)) {
        throw new Error(`Cannot move request from ${r.status} to ${status}`);
      }
      const now = new Date().toISOString();
      r.status = status;
      if (opts?.kg != null) r.actual_kg = opts.kg;
      if (opts?.note) r.status_note = opts.note;
      if (status === 'picked_up') r.picked_up_at = now;
      if (status === 'deposited') r.deposited_at = now;
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
        return {
          user_id,
          display_name: last ? `${first} ${last[0]}.` : first,
          kg: t.kg,
          pickups: t.pickups,
          rank: i + 1,
        };
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
