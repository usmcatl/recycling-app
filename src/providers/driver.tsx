import * as Location from 'expo-location';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import type { LatLng } from '@/lib/types';
import { useSession } from './session';

type DriverCtx = {
  active: boolean;
  setActive(active: boolean): Promise<void>;
  position: LatLng | null;
  locationDenied: boolean;
};

const Ctx = createContext<DriverCtx | null>(null);

/** How often (ms) the driver's position is pushed to the server while active. */
const PUSH_INTERVAL = 30_000;

export function DriverProvider({ children }: { children: ReactNode }) {
  const { profile, refresh } = useSession();
  const [active, setActiveState] = useState(profile?.is_active ?? false);
  const [position, setPosition] = useState<LatLng | null>(null);
  const [locationDenied, setDenied] = useState(false);
  const lastPush = useRef(0);

  // Watch position whenever the driver is online; share it so donors can track them.
  useEffect(() => {
    if (!active) return;
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
          const now = Date.now();
          if (now - lastPush.current > PUSH_INTERVAL) {
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
  }, [active]);

  async function setActive(next: boolean) {
    setActiveState(next);
    try {
      await api.setActive(next);
      await refresh();
    } catch {
      setActiveState(!next);
    }
  }

  return <Ctx.Provider value={{ active, setActive, position, locationDenied }}>{children}</Ctx.Provider>;
}

export function useDriver() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useDriver must be used inside DriverProvider');
  return ctx;
}
