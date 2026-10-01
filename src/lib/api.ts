import { demoApi } from './api-demo';
import { isSupabaseConfigured, supabaseApi } from './api-supabase';
import type {
  CommunityStats,
  LatLng,
  LeaderboardRow,
  PickupRequest,
  Profile,
  ProfileInput,
  RequestDraft,
  RequestStatus,
} from './types';

/**
 * Everything the screens need from the backend. Implemented by Supabase in
 * production and by an on-device demo store when no Supabase keys are set.
 */
export interface Api {
  readonly mode: 'supabase' | 'demo';

  // auth
  currentUserId(): Promise<string | null>;
  onAuthChange(cb: (userId: string | null) => void): () => void;
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  signOut(): Promise<void>;

  // profile
  getMyProfile(): Promise<Profile | null>;
  saveProfile(input: ProfileInput): Promise<Profile>;

  // donor
  createRequest(draft: RequestDraft): Promise<PickupRequest>;
  listMyRequests(): Promise<PickupRequest[]>;
  cancelRequest(id: string): Promise<void>;

  // shared
  getRequest(id: string): Promise<PickupRequest | null>;
  subscribeRequest(id: string, cb: (r: PickupRequest) => void): () => void;

  // driver
  listOpenRequests(): Promise<PickupRequest[]>;
  listMyCases(): Promise<PickupRequest[]>;
  subscribeRequests(cb: () => void): () => void;
  claimRequest(id: string): Promise<void>;
  releaseRequest(id: string): Promise<void>;
  advanceRequest(id: string, status: RequestStatus, opts?: { kg?: number; note?: string }): Promise<void>;
  setActive(active: boolean): Promise<void>;
  updateLocation(pos: LatLng): Promise<void>;
  getDriverLocation(driverId: string): Promise<LatLng | null>;
  subscribeDriverLocation(driverId: string, cb: (pos: LatLng) => void): () => void;

  // impact
  leaderboard(period: 'month' | 'all'): Promise<LeaderboardRow[]>;
  communityStats(): Promise<CommunityStats>;
}

export const api: Api = isSupabaseConfigured ? supabaseApi : demoApi;
