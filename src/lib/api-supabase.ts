import './localstorage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import type { Api } from './api';
import { KG_PER_BAG } from './constants';
import type { PickupRequest, Profile } from './types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(url && key);

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

  async createRequest(draft) {
    const donor_id = await uid();
    const row = { ...draft, donor_id, estimated_kg: draft.bag_count * KG_PER_BAG };
    return unwrap(await db().from('pickup_requests').insert(row).select(REQUEST_SELECT).single()) as PickupRequest;
  },

  async listMyRequests() {
    const id = await uid();
    return unwrap(
      await db()
        .from('pickup_requests')
        .select(REQUEST_SELECT)
        .eq('donor_id', id)
        .order('created_at', { ascending: false }),
    ) as PickupRequest[];
  },

  async cancelRequest(id) {
    unwrap(await db().rpc('cancel_request', { request_id: id }));
  },

  async getRequest(id) {
    return unwrap(
      await db().from('pickup_requests').select(REQUEST_SELECT).eq('id', id).maybeSingle(),
    ) as PickupRequest | null;
  },

  subscribeRequest(id, cb) {
    const channel = db()
      .channel(`request:${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pickup_requests', filter: `id=eq.${id}` },
        async () => {
          const fresh = await supabaseApi.getRequest(id);
          if (fresh) cb(fresh);
        },
      )
      .subscribe();
    return () => {
      db().removeChannel(channel);
    };
  },

  async listOpenRequests() {
    return unwrap(
      await db()
        .from('pickup_requests')
        .select(REQUEST_SELECT)
        .eq('status', 'open')
        .order('preferred_date', { ascending: true }),
    ) as PickupRequest[];
  },

  async listMyCases() {
    const id = await uid();
    return unwrap(
      await db()
        .from('pickup_requests')
        .select(REQUEST_SELECT)
        .eq('driver_id', id)
        .order('updated_at', { ascending: false }),
    ) as PickupRequest[];
  },

  subscribeRequests(cb) {
    const channel = db()
      .channel('requests:all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pickup_requests' }, () => cb())
      .subscribe();
    return () => {
      db().removeChannel(channel);
    };
  },

  async claimRequest(id) {
    unwrap(await db().rpc('claim_request', { request_id: id }));
  },

  async releaseRequest(id) {
    unwrap(await db().rpc('release_request', { request_id: id }));
  },

  async advanceRequest(id, status, opts) {
    unwrap(
      await db().rpc('advance_request', {
        request_id: id,
        new_status: status,
        kg: opts?.kg ?? null,
        note: opts?.note ?? null,
      }),
    );
  },

  async setActive(active) {
    const id = await uid();
    unwrap(await db().from('profiles').update({ is_active: active }).eq('id', id));
  },

  async updateLocation({ lat, lng }) {
    const driver_id = await uid();
    unwrap(
      await db()
        .from('driver_locations')
        .upsert({ driver_id, lat, lng, updated_at: new Date().toISOString() }),
    );
  },

  async getDriverLocation(driverId) {
    const row = unwrap(
      await db().from('driver_locations').select('lat, lng').eq('driver_id', driverId).maybeSingle(),
    ) as { lat: number; lng: number } | null;
    return row;
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

  async leaderboard(period) {
    const rows = unwrap(
      await db().rpc('leaderboard', { since: period === 'month' ? startOfMonth() : null, max_rows: 50 }),
    ) as LeaderboardRowRaw[];
    return rows.map((r) => ({ ...r, kg: Number(r.kg), pickups: Number(r.pickups), rank: Number(r.rank) }));
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

type LeaderboardRowRaw = { user_id: string; display_name: string; kg: string; pickups: string; rank: string };
