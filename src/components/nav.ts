import { router } from 'expo-router';
import type { Role } from '@/lib/types';

/** Each role's home tab. */
export function homeHref(role: Role) {
  return role === 'driver' ? ('/map' as const) : ('/home' as const);
}

/** Back to the home screen from anywhere: the role's home tab, or the welcome screen when signed out. */
export function goHome(role: Role | null | undefined) {
  router.dismissTo(role ? homeHref(role) : '/');
}
