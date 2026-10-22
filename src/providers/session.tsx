import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { setLanguage } from '@/i18n';
import { api } from '@/lib/api';
import type { Profile, ProfileInput } from '@/lib/types';

type Session = {
  ready: boolean;
  /** true while the profile for the current user is being fetched */
  loading: boolean;
  userId: string | null;
  profile: Profile | null;
  refresh(): Promise<void>;
  saveProfile(input: ProfileInput): Promise<Profile>;
  signOut(): Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  const loadProfile = useCallback(async (id: string | null) => {
    if (!id) {
      setProfile(null);
      return;
    }
    setLoading(true);
    try {
      const p = await api.getMyProfile();
      setProfile(p);
      if (p) await setLanguage(p.locale);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const id = await api.currentUserId();
      if (!alive) return;
      setUserId(id);
      await loadProfile(id);
      if (alive) setReady(true);
    })();
    const off = api.onAuthChange(async (id) => {
      setUserId(id);
      await loadProfile(id);
    });
    return () => {
      alive = false;
      off();
    };
  }, [loadProfile]);

  const value: Session = {
    ready,
    loading,
    userId,
    profile,
    refresh: () => loadProfile(userId),
    async saveProfile(input) {
      const p = await api.saveProfile(input);
      setProfile(p);
      return p;
    },
    async signOut() {
      await api.signOut();
      setUserId(null);
      setProfile(null);
    },
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
