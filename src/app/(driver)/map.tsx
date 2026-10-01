import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Map, type MapPin } from '@/components/Map';
import { useDateLabel, useMaterialsLabel } from '@/components/requests';
import { RouteCard } from '@/components/RouteCard';
import { Avatar, Button, Card, DemoBanner, IconTile, Row, Stat, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { RECYCLING_CENTER } from '@/lib/constants';
import { distanceKm, formatDistance, formatKg, orderStops } from '@/lib/format';
import { todayIso } from '@/lib/schedule';
import type { PickupRequest } from '@/lib/types';
import { useData } from '@/lib/use-data';
import { useDriverRoutes } from '@/lib/use-driver-data';
import { useDriver } from '@/providers/driver';
import { useSession } from '@/providers/session';
import { ambientShadow, colors, fonts, radius, space } from '@/theme';

export default function DriverMap() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const { active, setActive, position, locationDenied } = useDriver();
  const { current, next, board } = useDriverRoutes();
  const materialsLabel = useMaterialsLabel();
  const dateLabel = useDateLabel();

  const routeId = current?.id ?? null;
  const { data: stops } = useData(async () => (routeId ? api.listRouteStops(routeId) : []), [routeId, current?.status]);
  const ordered = orderStops(stops ?? [], position ?? RECYCLING_CENTER.location);
  const nextStop = ordered.find((s) => s.status === 'en_route') ?? null;

  const today = todayIso();
  const doneToday = board.filter((r) => r.driver_id === profile?.id && r.status === 'completed' && r.route_date === today);
  const kgToday = doneToday.reduce((s, r) => s + r.estimated_kg, 0);

  const pins: MapPin[] = [
    ...ordered
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => ({
        id: s.id,
        kind: (s === nextStop ? 'active' : s.status === 'en_route' || s.status === 'claimed' ? 'pickup' : 'home') as MapPin['kind'],
        position: { lat: s.lat!, lng: s.lng! },
        title: s.address,
      })),
    { id: 'center', kind: 'center', position: RECYCLING_CENTER.location, title: RECYCLING_CENTER.name },
  ];

  const focus = nextStop && nextStop.lat != null && nextStop.lng != null ? { lat: nextStop.lat, lng: nextStop.lng } : position;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {active ? (
        <Map pins={pins} focus={focus} me={position} onPinPress={(id) => id !== 'center' && router.push(`/case/${id}`)} />
      ) : null}

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <Row>
          <Avatar name={profile?.full_name ?? '?'} size={44} />
          <Text variant="title" style={{ color: colors.primary, flex: 1, fontSize: 20 }}>
            {t('common.driverAppName')}
          </Text>
        </Row>
        <Row gap={0} style={styles.toggle}>
          {[true, false].map((on) => {
            const selected = active === on;
            return (
              <Pressable
                key={String(on)}
                onPress={() => setActive(on)}
                style={[styles.toggleItem, selected && { backgroundColor: colors.primary }]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                {on ? <View style={[styles.dot, { backgroundColor: selected ? colors.primaryFixed : colors.outline }]} /> : null}
                <Text style={[styles.toggleText, { color: selected ? colors.onPrimary : colors.outline }]}>
                  {on ? t('driver.active') : t('driver.offline')}
                </Text>
              </Pressable>
            );
          })}
        </Row>
      </View>
      <DemoBanner />

      {!active ? (
        <View style={styles.offline}>
          <Card tone="low" style={{ alignItems: 'center', padding: space.xl }}>
            <IconTile name="cloud-off" size={72} bg={colors.surfaceContainerHigh} color={colors.outline} />
            <Text variant="headline" style={{ textAlign: 'center' }}>
              {t('driver.offlineTitle')}
            </Text>
            <Text style={{ textAlign: 'center' }}>{t('driver.offlineBody')}</Text>
            <Button label={t('driver.goOnline')} icon="power-settings-new" onPress={() => setActive(true)} style={{ alignSelf: 'stretch' }} />
          </Card>
          <Row>
            <Card style={{ flex: 1 }}>
              <Stat value={String(doneToday.length)} label={t('driver.todayPickups')} />
            </Card>
            <Card style={{ flex: 1 }}>
              <Stat value={formatKg(kgToday)} label={t('driver.kgCollected')} />
            </Card>
          </Row>
          {next ? (
            <RouteCard route={next} onPress={() => router.push(`/route/${next.id}`)} />
          ) : null}
        </View>
      ) : (
        <View style={styles.sheetWrap} pointerEvents="box-none">
          {locationDenied ? (
            <Card tone="high" style={{ marginBottom: space.sm, padding: space.md }}>
              <Text variant="bodySmall">{t('driver.locationNeeded')}</Text>
            </Card>
          ) : null}
          {nextStop ? (
            <NextStopCard stop={nextStop} distance={position && focus ? distanceKm(position, focus) : null} label={materialsLabel(nextStop.materials, nextStop.other_material)} />
          ) : (
            <Card style={[styles.sheet, ambientShadow]}>
              <Text variant="eyebrow">{current ? t('driver.todayRoute') : t('driver.nextRoute')}</Text>
              {current ?? next ? (
                <>
                  <Text variant="headline">{(current ?? next)!.community}</Text>
                  <Text variant="bodySmall">
                    {dateLabel((current ?? next)!.route_date)} · {t('common.stops', { count: (current ?? next)!.stop_count })}
                  </Text>
                  <Button label={t('driver.viewRoute')} icon="arrow-forward" onPress={() => router.push(`/route/${(current ?? next)!.id}`)} />
                </>
              ) : (
                <>
                  <Text>{t('driver.noRoutes')}</Text>
                  <Button label={t('driver.findRoutes')} icon="route" onPress={() => router.push('/routes')} />
                </>
              )}
            </Card>
          )}
        </View>
      )}
    </View>
  );
}

function NextStopCard({ stop, distance, label }: { stop: PickupRequest; distance: number | null; label: string }) {
  const { t } = useTranslation();
  return (
    <Card style={[styles.sheet, ambientShadow]}>
      <Text variant="eyebrow">{t('driver.nextStop')}</Text>
      <Text variant="headline">{stop.donor?.full_name ?? stop.address}</Text>
      <Text variant="bodySmall">
        {[stop.address, distance != null ? t('driver.away', { distance: formatDistance(distance) }) : null].filter(Boolean).join(' · ')}
      </Text>
      <Text variant="bodySmall">
        {t(`modes.${stop.pickup_mode}`)} · {t('common.bags', { count: stop.bag_count })} · {label}
      </Text>
      <Button label={t('driver.viewStop')} icon="arrow-forward" onPress={() => router.push(`/case/${stop.id}`)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  top: {
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    gap: space.md,
    backgroundColor: 'rgba(248,250,248,0.9)',
  },
  toggle: {
    alignSelf: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.full,
    padding: 4,
    ...ambientShadow,
  },
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: radius.full,
  },
  toggleText: { fontFamily: fonts.bodySemi, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  offline: { flex: 1, padding: space.lg, gap: space.lg, justifyContent: 'center' },
  sheetWrap: { position: 'absolute', left: space.md, right: space.md, bottom: 100 },
  sheet: { borderRadius: radius.xl },
});
