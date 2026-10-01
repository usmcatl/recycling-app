import { useEffect } from 'react';
import { api } from './api';
import { distanceKm } from './format';
import type { LatLng, PickupRequest } from './types';
import { useData } from './use-data';

const IN_HAND = ['claimed', 'en_route', 'picked_up'];

/** Open requests + this driver's cases, kept fresh via realtime. */
export function useDriverData(position: LatLng | null) {
  const { data, reload } = useData(async () => {
    const [open, mine] = await Promise.all([api.listOpenRequests(), api.listMyCases()]);
    return { open, mine };
  });

  useEffect(() => api.subscribeRequests(() => reload()), [reload]);

  const distanceTo = (r: PickupRequest) =>
    position && r.lat != null && r.lng != null ? distanceKm(position, { lat: r.lat, lng: r.lng }) : null;

  const open = [...(data?.open ?? [])].sort((a, b) => {
    const da = distanceTo(a);
    const db = distanceTo(b);
    if (da != null && db != null) return da - db;
    return a.preferred_date.localeCompare(b.preferred_date);
  });
  const mine = data?.mine ?? [];
  const inHand = mine.filter((r) => IN_HAND.includes(r.status));
  const closed = mine.filter((r) => !IN_HAND.includes(r.status));

  return { open, inHand, closed, reload, distanceTo, loaded: data != null };
}
