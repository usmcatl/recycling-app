import { Linking, Platform } from 'react-native';
import { currentLocale } from '@/i18n';
import type { LatLng } from './types';

/** "2026-10-02" → "Fri, Oct 2" / "vie, 2 oct" */
export function formatDate(isoDate: string, opts: Intl.DateTimeFormatOptions = {}) {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(currentLocale() === 'en' ? 'en-US' : 'es-MX', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...opts,
  });
}

export function toIsoDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const intlLocale = () => (currentLocale() === 'en' ? 'en-US' : 'es-MX');

/** 0 → "Sunday" / "domingo" */
export function weekdayName(weekday: number) {
  // 2023-01-01 was a Sunday
  return new Date(2023, 0, 1 + weekday).toLocaleDateString(intlLocale(), { weekday: 'long' });
}

/** "Mon, 8:00 PM" / "lun, 20:00" */
export function formatDateTime(d: Date) {
  return d.toLocaleString(intlLocale(), { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

export function formatTime(d: Date) {
  return d.toLocaleTimeString(intlLocale(), { hour: 'numeric', minute: '2-digit' });
}

/** How many whole days from today until an ISO date (0 = today). */
export function daysUntil(isoDate: string) {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - today) / 86_400_000);
}

export function formatKg(kg: number) {
  return kg >= 100 ? Math.round(kg).toLocaleString() : kg.toFixed(kg % 1 === 0 ? 0 : 1);
}

/** Haversine distance in km. */
export function distanceKm(a: LatLng, b: LatLng) {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Order stops for driving: nearest-neighbour from `start`. Stops without a pinned
 * location go last, in their original order.
 */
export function orderStops<T extends { lat: number | null; lng: number | null }>(stops: T[], start: LatLng): T[] {
  const located = stops.filter((s) => s.lat != null && s.lng != null);
  const rest = stops.filter((s) => s.lat == null || s.lng == null);
  const out: T[] = [];
  let here = start;
  while (located.length) {
    let best = 0;
    let bestKm = Infinity;
    located.forEach((s, i) => {
      const km = distanceKm(here, { lat: s.lat!, lng: s.lng! });
      if (km < bestKm) {
        bestKm = km;
        best = i;
      }
    });
    const [next] = located.splice(best, 1);
    out.push(next);
    here = { lat: next.lat!, lng: next.lng! };
  }
  return [...out, ...rest];
}

export function formatDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function digits(phone: string) {
  return phone.replace(/[^\d]/g, '');
}

export function callNumber(phone: string) {
  Linking.openURL(`tel:${digits(phone)}`);
}

export function openWhatsApp(phone: string, text?: string) {
  const q = text ? `?text=${encodeURIComponent(text)}` : '';
  Linking.openURL(`https://wa.me/${digits(phone)}${q}`);
}

export function openDirections(dest: LatLng | null, address?: string | null) {
  const target = dest ? `${dest.lat},${dest.lng}` : encodeURIComponent(address ?? '');
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${target}`
      : `https://www.google.com/maps/dir/?api=1&destination=${target}`;
  Linking.openURL(url);
}
