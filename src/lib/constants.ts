import type { ComponentProps } from 'react';
import type { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/theme';
import type { LatLng, MaterialId, RequestStatus, TimeWindow } from './types';

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

export const TIME_WINDOWS: { id: TimeWindow; icon: IconName; hours: string }[] = [
  { id: 'morning', icon: 'wb-sunny', hours: '8:00 – 11:00' },
  { id: 'afternoon', icon: 'light-mode', hours: '12:00 – 16:00' },
  { id: 'evening', icon: 'dark-mode', hours: '17:00 – 20:00' },
];

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
