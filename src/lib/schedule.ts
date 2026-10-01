import { COMMUNITIES, CUTOFF_HOUR, ROUTE_SCHEDULE, type Community } from './constants';
import { toIsoDate } from './format';

export function isCommunity(name: string | null | undefined): name is Community {
  return !!name && (COMMUNITIES as readonly string[]).includes(name);
}

/** Weekday (0 = Sunday) a community's route runs on, or null if it has no route. */
export function routeWeekday(community: string | null | undefined): number | null {
  return isCommunity(community) ? ROUTE_SCHEDULE[community] : null;
}

function parseDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** The moment changes to a route day lock: CUTOFF_HOUR the evening before. */
export function cutoffFor(routeDate: string) {
  const d = parseDate(routeDate);
  d.setDate(d.getDate() - 1);
  d.setHours(CUTOFF_HOUR, 0, 0, 0);
  return d;
}

export function isPastCutoff(routeDate: string, now = new Date()) {
  return now >= cutoffFor(routeDate);
}

/** The next `count` route dates for a community that are still open for changes. */
export function upcomingRouteDates(community: string | null | undefined, count = 3, now = new Date()) {
  const weekday = routeWeekday(community);
  if (weekday == null) return [];
  const dates: string[] = [];
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  while (dates.length < count) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== weekday) continue;
    const iso = toIsoDate(d);
    if (!isPastCutoff(iso, now)) dates.push(iso);
  }
  return dates;
}

/** The next `days` days of every community's route, soonest first. */
export function upcomingRouteDays(days = 14, now = new Date()) {
  const out: { community: Community; route_date: string }[] = [];
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let i = 0; i <= days; i++) {
    const iso = toIsoDate(d);
    for (const c of COMMUNITIES) if (ROUTE_SCHEDULE[c] === d.getDay()) out.push({ community: c, route_date: iso });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function todayIso(now = new Date()) {
  return toIsoDate(now);
}
