import './localstorage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import type { Api } from './api';
import { KG_PER_BAG } from './constants';
import { toIsoDate } from './format';
import type { PickupRequest, Profile, Rating, Reputation, Route } from './types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && key);

const PHOTO_BUCKET = 'pickup-photos';

let client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (!client) {
    client = createClient(url!, key!, {
      auth: {
        storage: localStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
    AppState.addEventListener('change', (state) => {
      if (state === 'active') client!.auth.startAutoRefresh();
      else client!.auth.stopAutoRefresh();
    });
  }
  return client;
}

const CONTACT = 'id, full_name, whatsapp, vehicle_make, vehicle_model, vehicle_color, vehicle_plate';
const REQUEST_SELECT = `*, donor:profiles!donor_id(${CONTACT}), driver:profiles!driver_id(${CONTACT})`;

function unwrap<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data;
}

async function uid(): Promise<string> {
  const { data } = await db().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Not signed in');
  return id;
}

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function toRoute(r: Record<string, unknown>): Route {
  return {
    ...(r as unknown as Route),
    stop_count: Number(r.stop_count ?? 0),
    estimated_kg: Number(r.estimated_kg ?? 0),
  };
}

async function board(from: string, to: string) {
  const rows = unwrap(await db().rpc('route_board', { p_from: from, p_to: to })) as Record<string, unknown>[];
  return rows.map(toRoute);
}

/** Subscribe to any change on a table; returns an unsubscribe function. */
function watch(name: string, table: string, cb: () => void, filter?: string) {
  const channel = db()
    .channel(name)
    .on('postgres_changes', { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, () => cb())
    .subscribe();
  return () => {
    db().removeChannel(channel);
  };
}

export const supabaseApi: Api = {
  mode: 'supabase',

  async currentUserId() {
    const { data } = await db().auth.getSession();
    return data.session?.user.id ?? null;
  },

  onAuthChange(cb) {
    const { data } = db().auth.onAuthStateChange((_event, session) => cb(session?.user.id ?? null));
    return () => data.subscription.unsubscribe();
  },

  async sendCode(email) {
    const { error } = await db().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) throw new Error(error.message);
  },

  async verifyCode(email, code) {
    const { error } = await db().auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) throw new Error(error.message);
  },

  async signOut() {
    await db().auth.signOut();
  },

  async getMyProfile() {
    const id = await uid();
    return unwrap(await db().from('profiles').select('*').eq('id', id).maybeSingle()) as Profile | null;
  },

  async saveProfile(input) {
    const id = await uid();
    const row = { ...input, id, updated_at: new Date().toISOString() };
    return unwrap(await db().from('profiles').upsert(row).select('*').single()) as Profile;
  },

  async createRequest(d) {
    const created = unwrap(
      await db().rpc('create_request', {
        p_materials: d.materials,
        p_other_material: d.other_material,
        p_bag_count: d.bag_count,
        p_route_date: d.route_date,
        p_mode: d.pickup_mode,
        p_instructions: d.instructions,
        p_address: d.address,
        p_community: d.community,
        p_lat: d.lat,
        p_lng: d.lng,
        p_estimated_kg: d.bag_count * KG_PER_BAG,
      }),
    ) as PickupRequest;
    return (await supabaseApi.getRequest(created.id)) ?? created;
  },

  async listMyRequests() {
    const id = await uid();
    return unwrap(
      await db().from('pickup_requests').select(REQUEST_SELECT).eq('donor_id', id).order('created_at', { ascending: false }),
    ) as PickupRequest[];
  },

  async cancelRequest(id) {
    unwrap(await db().rpc('cancel_request', { request_id: id }));
  },

  async getRequest(id) {
    return unwrap(await db().from('pickup_requests').select(REQUEST_SELECT).eq('id', id).maybeSingle()) as PickupRequest | null;
  },

  subscribeRequest(id, cb) {
    return watch(`request:${id}`, 'pickup_requests', async () => {
      const fresh = await supabaseApi.getRequest(id);
      if (fresh) cb(fresh);
    }, `id=eq.${id}`);
  },

  async photoUrl(ref) {
    const { data } = await db().storage.from(PHOTO_BUCKET).createSignedUrl(ref, 60 * 60);
    return data?.signedUrl ?? null;
  },

  async routeBoard(days) {
    const from = new Date();
    const to = new Date();
    to.setDate(to.getDate() + days);
    return board(toIsoDate(from), toIsoDate(to));
  },

  async getRoute(id) {
    const row = unwrap(await db().from('routes').select('route_date').eq('id', id).maybeSingle()) as { route_date: string } | null;
    if (!row) return null;
    return (await board(row.route_date, row.route_date)).find((r) => r.id === id) ?? null;
  },

  async listRouteStops(routeId) {
    return unwrap(
      await db().from('pickup_requests').select(REQUEST_SELECT).eq('route_id', routeId).neq('status', 'cancelled'),
    ) as PickupRequest[];
  },

  async listMyCommitments() {
    const id = await uid();
    const rows = unwrap(await db().from('route_commitments').select('community').eq('driver_id', id)) as { community: string }[];
    return rows.map((r) => r.community);
  },

  subscribeRoutes(cb) {
    const offRoutes = watch('routes:all', 'routes', cb);
    const offStops = watch('stops:all', 'pickup_requests', cb);
    return () => {
      offRoutes();
      offStops();
    };
  },

  async claimRoute(routeId, everyWeek) {
    unwrap(await db().rpc('claim_route', { p_route: routeId, p_every_week: everyWeek }));
  },

  async skipRoute(routeId) {
    unwrap(await db().rpc('skip_route', { p_route: routeId }));
  },

  async endCommitment(community) {
    unwrap(await db().rpc('end_commitment', { p_community: community }));
  },

  async startRoute(routeId) {
    unwrap(await db().rpc('start_route', { p_route: routeId }));
  },

  async completeRoute(routeId) {
    unwrap(await db().rpc('complete_route', { p_route: routeId }));
  },

  async listMyStops() {
    const id = await uid();
    return unwrap(
      await db().from('pickup_requests').select(REQUEST_SELECT).eq('driver_id', id).order('updated_at', { ascending: false }),
    ) as PickupRequest[];
  },

  async markArrived(requestId) {
    unwrap(await db().rpc('mark_arrived', { request_id: requestId }));
  },

  async markContacted(requestId) {
    unwrap(await db().rpc('mark_contacted', { request_id: requestId }));
  },

  async uploadPhoto(requestId, localUri) {
    const body = await (await fetch(localUri)).arrayBuffer();
    const path = `${requestId}/${Date.now()}.jpg`;
    const { error } = await db().storage.from(PHOTO_BUCKET).upload(path, body, { contentType: 'image/jpeg' });
    if (error) throw new Error(error.message);
    return path;
  },

  async collectStop(requestId, { kg, photo }) {
    unwrap(await db().rpc('collect_stop', { request_id: requestId, kg: kg ?? null, photo: photo ?? null }));
  },

  async noShowStop(requestId, { note, photo }) {
    unwrap(await db().rpc('no_show_stop', { request_id: requestId, note, photo: photo ?? null }));
  },

  async setActive(active) {
    const id = await uid();
    unwrap(await db().from('profiles').update({ is_active: active }).eq('id', id));
  },

  async updateLocation({ lat, lng }) {
    const driver_id = await uid();
    unwrap(await db().from('driver_locations').upsert({ driver_id, lat, lng, updated_at: new Date().toISOString() }));
  },

  async getDriverLocation(driverId) {
    return unwrap(
      await db().from('driver_locations').select('lat, lng').eq('driver_id', driverId).maybeSingle(),
    ) as { lat: number; lng: number } | null;
  },

  subscribeDriverLocation(driverId, cb) {
    const channel = db()
      .channel(`location:${driverId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_locations', filter: `driver_id=eq.${driverId}` },
        (payload) => {
          const row = payload.new as { lat?: number; lng?: number };
          if (row.lat != null && row.lng != null) cb({ lat: row.lat, lng: row.lng });
        },
      )
      .subscribe();
    return () => {
      db().removeChannel(channel);
    };
  },

  async rate(requestId, stars, tags, comment) {
    unwrap(await db().rpc('rate_request', { p_request: requestId, p_stars: stars, p_tags: tags, p_comment: comment }));
  },

  async myRating(requestId) {
    const id = await uid();
    return unwrap(
      await db().from('ratings').select('*').eq('request_id', requestId).eq('rater_id', id).maybeSingle(),
    ) as Rating | null;
  },

  async reputation(userIds) {
    if (userIds.length === 0) return {};
    const rows = unwrap(await db().rpc('reputation', { user_ids: userIds })) as Record<string, unknown>[];
    const out: Record<string, Reputation> = {};
    for (const r of rows) {
      out[r.user_id as string] = {
        user_id: r.user_id as string,
        rating_avg: r.rating_avg == null ? null : Number(r.rating_avg),
        rating_count: Number(r.rating_count),
        completed: Number(r.completed),
        no_shows: Number(r.no_shows),
        late_drops: Number(r.late_drops),
      };
    }
    return out;
  },

  async leaderboard(period) {
    const rows = unwrap(
      await db().rpc('leaderboard', { since: period === 'month' ? startOfMonth() : null, max_rows: 50 }),
    ) as Record<string, unknown>[];
    return rows.map((r) => ({
      user_id: r.user_id as string,
      display_name: r.display_name as string,
      kg: Number(r.kg),
      pickups: Number(r.pickups),
      rank: Number(r.rank),
    }));
  },

  async communityStats() {
    const rows = unwrap(await db().rpc('community_stats')) as Record<string, number | string>[];
    const r = rows[0] ?? {};
    return {
      total_kg: Number(r.total_kg ?? 0),
      total_pickups: Number(r.total_pickups ?? 0),
      donors: Number(r.donors ?? 0),
      drivers: Number(r.drivers ?? 0),
    };
  },
};
