export type Role = 'donor' | 'driver';
export type Locale = 'es' | 'en';

/**
 * A stop's status. Stops ride along with their route:
 * open (route has no driver yet) → claimed (route has a driver) → en_route (route started)
 * → picked_up → deposited. Or cancelled (donor) / no_show (driver couldn't collect).
 */
export type RequestStatus =
  | 'open'
  | 'claimed'
  | 'en_route'
  | 'picked_up'
  | 'deposited'
  | 'cancelled'
  | 'no_show';

/** doorstep: bags left out at the gate, driver confirms with a photo. in_person: donor hands them over. */
export type PickupMode = 'doorstep' | 'in_person';

export type RouteStatus = 'open' | 'claimed' | 'in_progress' | 'completed';

export type MaterialId = 'paper' | 'plastic' | 'glass' | 'metal' | 'ewaste' | 'other';

export type Profile = {
  id: string;
  role: Role;
  full_name: string;
  whatsapp: string | null;
  locale: Locale;
  address: string | null;
  community: string | null;
  lat: number | null;
  lng: number | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_plate: string | null;
  is_active: boolean;
  conduct_accepted_at: string | null;
  notify_push: boolean;
  notify_whatsapp: boolean;
  notify_email: boolean;
  notify_updates: boolean;
  notify_status: boolean;
  notify_impact: boolean;
  notify_tips: boolean;
};

export type ProfileInput = Partial<Omit<Profile, 'id'>> & Pick<Profile, 'role' | 'full_name'>;

/** The other party on a request, as visible to the current user. */
export type Contact = {
  id: string;
  full_name: string;
  whatsapp: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_plate: string | null;
};

export type PickupRequest = {
  id: string;
  case_code: string;
  donor_id: string;
  driver_id: string | null;
  route_id: string;
  route_date: string; // YYYY-MM-DD
  status: RequestStatus;
  pickup_mode: PickupMode;
  materials: MaterialId[];
  other_material: string | null;
  bag_count: number;
  instructions: string | null;
  address: string;
  community: string;
  lat: number | null;
  lng: number | null;
  estimated_kg: number;
  actual_kg: number | null;
  photo_url: string | null;
  status_note: string | null;
  arrived_at: string | null;
  contacted_at: string | null;
  picked_up_at: string | null;
  deposited_at: string | null;
  created_at: string;
  donor?: Contact | null;
  driver?: Contact | null;
};

export type RequestDraft = {
  materials: MaterialId[];
  other_material: string | null;
  bag_count: number;
  route_date: string;
  pickup_mode: PickupMode;
  instructions: string | null;
  address: string;
  community: string;
  lat: number | null;
  lng: number | null;
};

/** One community's collection run on one day. */
export type Route = {
  id: string;
  community: string;
  route_date: string; // YYYY-MM-DD
  driver_id: string | null;
  /** true when the driver holds this community/weekday every week */
  recurring: boolean;
  status: RouteStatus;
  started_at: string | null;
  completed_at: string | null;
  stop_count: number;
  estimated_kg: number;
  driver?: Contact | null;
};

/** A driver's standing weekly commitment to a community's route day. */
export type Commitment = {
  community: string;
  weekday: number; // 0 = Sunday
};

export type Rating = {
  request_id: string;
  rater_id: string;
  ratee_id: string;
  stars: number; // 1–5
  tags: string[];
  comment: string | null;
  created_at: string;
};

/** Track record shown next to someone's name. */
export type Reputation = {
  user_id: string;
  rating_avg: number | null;
  rating_count: number;
  completed: number;
  /** donors: pickups marked not collected. drivers: stops they couldn't collect. */
  no_shows: number;
  /** drivers: routes dropped after the cutoff. donors: requests cancelled after the cutoff. */
  late_drops: number;
};

export type LeaderboardRow = {
  user_id: string;
  display_name: string;
  kg: number;
  pickups: number;
  rank: number;
};

export type CommunityStats = {
  total_kg: number;
  total_pickups: number;
  donors: number;
  drivers: number;
};

export type LatLng = { lat: number; lng: number };
