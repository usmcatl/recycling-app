import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { COMMUNITIES } from './constants';
import type { LatLng } from './types';

/** A position up to this old is good enough for pinning a pickup address. */
const MAX_AGE_MS = 5 * 60_000;
/** Give up on a fresh position after this long. */
const POSITION_TIMEOUT_MS = 10_000;
/** Give up on turning coordinates into an address after this long; the pin is already set. */
const ADDRESS_TIMEOUT_MS = 6_000;

export class LocationDeniedError extends Error {}

export type FoundAddress = { street: string | null; community: string | null };

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/**
 * The device's position, as fast as possible: a recent cached fix when there is one,
 * otherwise a quick network/Wi-Fi fix rather than waiting for GPS.
 */
export async function locateMe(): Promise<LatLng> {
  if (Platform.OS === 'web') {
    // Ask the browser directly: expo-location's web permission request takes a separate,
    // uncached fix before the real one, which doubles the wait on iPhone Safari.
    if (!('geolocation' in navigator)) throw new LocationDeniedError();
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        (e) => reject(e.code === e.PERMISSION_DENIED ? new LocationDeniedError() : new Error(e.message)),
        { enableHighAccuracy: false, maximumAge: MAX_AGE_MS, timeout: POSITION_TIMEOUT_MS },
      );
    });
  }

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new LocationDeniedError();
  const recent = await Location.getLastKnownPositionAsync({ maxAge: MAX_AGE_MS, requiredAccuracy: 100 }).catch(() => null);
  const pos =
    recent ??
    (await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), POSITION_TIMEOUT_MS));
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** The first of `names` that matches one of our communities (accents and case ignored). */
export function matchCommunity(names: (string | null | undefined)[]): string | null {
  for (const name of names) {
    if (!name) continue;
    const n = normalize(name);
    const hit = COMMUNITIES.find((c) => normalize(c) === n);
    if (hit) return hit;
  }
  return null;
}

type NominatimAddress = Partial<
  Record<'road' | 'house_number' | 'neighbourhood' | 'suburb' | 'village' | 'town' | 'city' | 'hamlet', string>
>;

/** OpenStreetMap's free reverse geocoder; used on the web, where the device geocoder isn't available. */
async function nominatim({ lat, lng }: LatLng): Promise<FoundAddress> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&accept-language=es&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Address lookup failed (${res.status})`);
  const a = ((await res.json()) as { address?: NominatimAddress }).address ?? {};
  return {
    street: [a.road, a.house_number].filter(Boolean).join(' ') || null,
    community: matchCommunity([a.village, a.town, a.city, a.suburb, a.neighbourhood, a.hamlet]),
  };
}

/** Street and community for a position, or nulls if it can't be found in time. */
export async function addressFor(pos: LatLng): Promise<FoundAddress> {
  const lookup = async (): Promise<FoundAddress> => {
    if (Platform.OS !== 'web') {
      const [place] = await Location.reverseGeocodeAsync({ latitude: pos.lat, longitude: pos.lng }).catch(() => []);
      if (place?.street) {
        return {
          street: [place.street, place.streetNumber].filter(Boolean).join(' '),
          community: matchCommunity([place.city, place.district, place.subregion, place.name]),
        };
      }
    }
    return nominatim(pos);
  };
  return withTimeout(lookup(), ADDRESS_TIMEOUT_MS).catch(() => ({ street: null, community: null }));
}
