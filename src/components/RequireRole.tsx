import { Redirect } from 'expo-router';
import type { ReactNode } from 'react';
import type { Role } from '@/lib/types';
import { useSession } from '@/providers/session';
import { Loading } from './ui';

/** Keeps signed-out users and the wrong role out of a section of the app. */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { userId, profile, loading } = useSession();
  if (!userId) return <Redirect href="/" />;
  if (!profile) return loading ? <Loading /> : <Redirect href="/profile-setup" />;
  if (profile.role !== role) return <Redirect href={profile.role === 'driver' ? '/map' : '/home'} />;
  return <>{children}</>;
}
