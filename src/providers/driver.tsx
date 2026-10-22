import * as Location from 'expo-location';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { BOARD_DAYS } from '@/lib/use-driver-data';
import type { LatLng } from '@/lib/types';
import { useSession } from './session';

type DriverCtx = {
  position: LatLng | null;
  locationDenied: boolean;
  /** true while one of this driver's routes is in progress (their location is shared with its donors) */
  sharing: boolean;
};

const Ctx = createContext<DriverCtx | null>(null);

/** How often (ms) the driver's position is pushed to the server while a route is in progress. */
const PUSH_INTERVAL = 30_000;

export function DriverProvider({ children }: { children: ReactNode }) {
  const { userId } = useSession();
  const [position, setPosition] = useState<LatLng | null>(null);
  const [locationDenied, setDenied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const sharingRef = useRef(false);
  const lastPush = useRef(0);
  const latest = useRef<LatLng | null>(null);

  // Share location only while a route is in progress; no on/off switch to remember.
  useEffect(() => {
    if (!userId) return;
    const check = () =>
      api
        .routeBoard(BOARD_DAYS)
        .then((routes) => setSharing(routes.some((r) => r.driver_id === userId && r.status === 'in_progress')))
        .catch(() => {});
    check();
    return api.subscribeRoutes(check);
  }, [userId]);

  useEffect(() => {
    sharingRef.current = sharing;
    // push straight away when a route starts, even if the driver hasn't moved yet
    if (sharing && latest.current) {
      lastPush.current = Date.now();
      api.updateLocation(latest.current).catch(() => {});
    }
  }, [sharing]);

  // Watch position for distances and the map; push it to the server only while sharing.
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setDenied(true);
        return;
      }
      setDenied(false);
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 50, timeInterval: 15_000 },
        (loc) => {
          const pos = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          setPosition(pos);
          latest.current = pos;
          const now = Date.now();
          if (sharingRef.current && now - lastPush.current > PUSH_INTERVAL) {
            lastPush.current = now;
            api.updateLocation(pos).catch(() => {});
          }
        },
      );
      if (cancelled) sub.remove();
    })().catch(() => setDenied(true));
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, []);

  return <Ctx.Provider value={{ position, locationDenied, sharing }}>{children}</Ctx.Provider>;
}

export function useDriver() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDriver must be used inside DriverProvider');
  return ctx;
}
