import { demoApi } from './api-demo';
import { isSupabaseConfigured, supabaseApi } from './api-supabase';
import type {
  CommunityStats,
  LatLng,
  LeaderboardRow,
  PickupRequest,
  Profile,
  ProfileInput,
  Rating,
  RequestDraft,
  Reputation,
  Route,
} from './types';

/**
 * Everything the screens need from the backend. Implemented by Supabase in
 * production and by an on-device demo store when no Supabase keys are set.
 */
export interface Api {
  readonly mode: 'supabase' | 'demo';

  // auth
  currentUserId(): Promise<string | null>;
  /** The email address the current user signed in with. */
  currentEmail(): Promise<string | null>;
  onAuthChange(cb: (userId: string | null) => void): () => void;
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  signOut(): Promise<void>;

  // profile
  getMyProfile(): Promise<Profile | null>;
  saveProfile(input: ProfileInput): Promise<Profile>;

  // donor
  createRequest(draft: RequestDraft): Promise<PickupRequest>;
  /** Most bags/boxes one stop may have on a community's route that day (set by its driver). */
  bagLimit(community: string, routeDate: string): Promise<number>;
  listMyRequests(): Promise<PickupRequest[]>;
  cancelRequest(id: string): Promise<void>;

  // shared
  getRequest(id: string): Promise<PickupRequest | null>;
  subscribeRequest(id: string, cb: (r: PickupRequest) => void): () => void;
  /** Turn a stored photo reference into something an <Image> can show. */
  photoUrl(ref: string): Promise<string | null>;

  // driver: routes
  /** Routes from today through `days` ahead, with stop counts. */
  routeBoard(days: number): Promise<Route[]>;
  getRoute(id: string): Promise<Route | null>;
  listRouteStops(routeId: string): Promise<PickupRequest[]>;
  /** Communities this driver holds every week. */
  listMyCommitments(): Promise<string[]>;
  subscribeRoutes(cb: () => void): () => void;
  claimRoute(routeId: string, everyWeek: boolean): Promise<void>;
  skipRoute(routeId: string): Promise<void>;
  endCommitment(community: string): Promise<void>;
  startRoute(routeId: string): Promise<void>;
  completeRoute(routeId: string): Promise<void>;
  /** Stops this driver has handled (history). */
  listMyStops(): Promise<PickupRequest[]>;

  // driver: stops
  markArrived(requestId: string): Promise<void>;
  markContacted(requestId: string): Promise<void>;
  /** Upload a photo of the bags; returns a reference to pass to collect/noShow. */
  uploadPhoto(requestId: string, localUri: string): Promise<string>;
  collectStop(requestId: string, opts: { kg?: number; photo?: string }): Promise<void>;
  noShowStop(requestId: string, opts: { note: string; photo?: string }): Promise<void>;

  // driver: location (shared only while a route is in progress)
  updateLocation(pos: LatLng): Promise<void>;
  getDriverLocation(driverId: string): Promise<LatLng | null>;
  subscribeDriverLocation(driverId: string, cb: (pos: LatLng) => void): () => void;

  // feedback & reputation
  /** Private yes/no feedback on the other person after a stop. */
  rate(requestId: string, answers: Record<string, boolean>, comment: string | null): Promise<void>;
  /** The feedback the current user gave on a request, if any. */
  myRating(requestId: string): Promise<Rating | null>;
  reputation(userIds: string[]): Promise<Record<string, Reputation>>;

  // impact
  leaderboard(period: 'month' | 'all'): Promise<LeaderboardRow[]>;
  communityStats(): Promise<CommunityStats>;

  /** Demo mode only: finish a donor's pickup with a sample driver so testers can reach feedback. */
  demoCompletePickup?(requestId: string): Promise<void>;
}

export const api: Api = isSupabaseConfigured ? supabaseApi : demoApi;
