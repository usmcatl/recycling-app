export type Role = 'donor' | 'driver';
export type Locale = 'es' | 'en';

export type RequestStatus =
  | 'open'
  | 'claimed'
  | 'en_route'
  | 'picked_up'
  | 'deposited'
  | 'cancelled'
  | 'no_show';

export type TimeWindow = 'morning' | 'afternoon' | 'evening';

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
  status: RequestStatus;
  materials: MaterialId[];
  other_material: string | null;
  bag_count: number;
  preferred_date: string; // YYYY-MM-DD
  time_window: TimeWindow;
  instructions: string | null;
  address: string;
  community: string | null;
  lat: number | null;
  lng: number | null;
  estimated_kg: number;
  actual_kg: number | null;
  status_note: string | null;
  claimed_at: string | null;
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
  preferred_date: string;
  time_window: TimeWindow;
  instructions: string | null;
  address: string;
  community: string | null;
  lat: number | null;
  lng: number | null;
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
