import { useEffect } from 'react';
import { useSession } from '@/providers/session';
import { api } from './api';
import { todayIso } from './schedule';
import type { Route } from './types';
import { useData } from './use-data';

/** Days ahead shown on the route board. */
export const BOARD_DAYS = 14;

const byDate = (a: Route, b: Route) => a.route_date.localeCompare(b.route_date) || a.community.localeCompare(b.community);

/** Stops this driver has finished (collected, delivered or not collected). */
export function useClosedStops() {
  const { data } = useData(() => api.listMyStops());
  const closed = (data ?? []).filter((r) => ['picked_up', 'deposited', 'no_show'].includes(r.status));
  const delivered = closed.filter((r) => r.status === 'deposited');
  const kg = delivered.reduce((s, r) => s + (r.actual_kg ?? r.estimated_kg), 0);
  return { closed, delivered, kg };
}

/** The route board plus this driver's routes and weekly commitments, kept live. */
export function useDriverRoutes() {
  const { userId } = useSession();
  const { data, reload, loading } = useData(async () => {
    const [board, weekly] = await Promise.all([api.routeBoard(BOARD_DAYS), api.listMyCommitments()]);
    return { board, weekly };
  });

  useEffect(() => api.subscribeRoutes(() => reload()), [reload]);

  const board = data?.board ?? [];
  const mine = board.filter((r) => r.driver_id === userId && r.status !== 'completed').sort(byDate);
  const open = board.filter((r) => r.status === 'open').sort(byDate);
  const today = todayIso();
  const current = mine.find((r) => r.status === 'in_progress') ?? mine.find((r) => r.route_date === today) ?? null;

  return {
    board,
    mine,
    open,
    current,
    next: mine.find((r) => r.route_date >= today) ?? null,
    weekly: data?.weekly ?? [],
    reload,
    loading: loading && !data,
  };
}
