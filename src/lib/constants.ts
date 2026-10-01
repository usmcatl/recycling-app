import type { ComponentProps } from 'react';
import type { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/theme';
import type { LatLng, MaterialId, RequestStatus } from './types';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/** Map centre for the Lakeside area (Ajijic). */
export const LAKESIDE_CENTER: LatLng = { lat: 20.2996, lng: -103.261 };

/**
 * Drop-off point for drivers.
 * TODO: replace with the Ajijic Recycling Center's exact address and coordinates.
 */
export const RECYCLING_CENTER = {
  name: 'Ajijic Recycling Center',
  address: 'Ajijic, Jalisco',
  location: { lat: 20.2996, lng: -103.261 } as LatLng,
};

/** Communities along the north shore of Lake Chapala. */
export const COMMUNITIES = [
  'Ajijic',
  'Chapala',
  'San Antonio Tlayacapan',
  'Riberas del Pilar',
  'San Juan Cosalá',
  'Jocotepec',
  'Santa Cruz de la Soledad',
  'Vista del Lago',
  'La Floresta',
  'Chula Vista',
  'El Chante',
  'Mezcala',
] as const;

/** Rough weight used to estimate a request before the driver weighs it. */
export const KG_PER_BAG = 5;

export const MATERIALS: {
  id: Exclude<MaterialId, 'other'>;
  icon: IconName;
  tint: string;
  iconColor: string;
}[] = [
  { id: 'paper', icon: 'description', tint: colors.secondaryContainer, iconColor: colors.primary },
  { id: 'plastic', icon: 'water-drop', tint: colors.tertiaryFixed, iconColor: colors.tertiary },
  { id: 'glass', icon: 'wine-bar', tint: '#d7f3ef', iconColor: colors.primaryContainer },
  { id: 'metal', icon: 'category', tint: colors.amberContainer, iconColor: colors.amber },
  { id: 'ewaste', icon: 'devices', tint: colors.surfaceContainerHigh, iconColor: colors.tertiaryContainer },
];

export type Community = (typeof COMMUNITIES)[number];

/**
 * Which weekday each community's route runs (0 = Sunday … 6 = Saturday).
 * TODO: placeholder days. Set these to match when the Ajijic Recycling Center receives
 * deliveries. Communities can share a day; each community on a day is its own route.
 */
export const ROUTE_SCHEDULE: Record<Community, number> = {
  Ajijic: 2,
  'La Floresta': 2,
  'San Antonio Tlayacapan': 3,
  'Riberas del Pilar': 3,
  Chapala: 4,
  'Vista del Lago': 4,
  'Chula Vista': 4,
  'Santa Cruz de la Soledad': 4,
  Mezcala: 4,
  'San Juan Cosalá': 5,
  'El Chante': 5,
  Jocotepec: 5,
};

/** Changes to a route day lock at this hour (24h) the night before, so drivers can plan. */
export const CUTOFF_HOUR = 20;

/** How many routes one driver can hold on the same day. */
export const MAX_ROUTES_PER_DAY = 2;

/** In-person pickups: minutes a driver waits after arriving before they may mark a no-show. */
export const NO_SHOW_WAIT_MINUTES = 5;

/** Quick tags offered when rating the other person, keyed by who is being rated. */
export const RATING_TAGS = {
  driver: ['onTime', 'friendly', 'careful', 'communicated'],
  donor: ['bagsReady', 'wellSorted', 'clearInstructions', 'friendly'],
} as const;

export const ACTIVE_STATUSES: RequestStatus[] = ['open', 'claimed', 'en_route', 'picked_up'];

/** Impact badges by total kg diverted. */
export const BADGES = [
  { id: 'seedling', minKg: 0 },
  { id: 'sprout', minKg: 25 },
  { id: 'guardian', minKg: 100 },
  { id: 'goldLeaf', minKg: 250 },
] as const;

export type BadgeId = (typeof BADGES)[number]['id'];

export function badgeFor(kg: number) {
  let current: (typeof BADGES)[number] = BADGES[0];
  for (const b of BADGES) if (kg >= b.minKg) current = b;
  const next = BADGES[BADGES.indexOf(current) + 1] ?? null;
  const progress = next ? (kg - current.minKg) / (next.minKg - current.minKg) : 1;
  return { current, next, progress, remainingKg: next ? next.minKg - kg : 0 };
}

/** TODO: replace with the recycling center's real support inbox. */
export const SUPPORT_EMAIL = 'support@example.com';
