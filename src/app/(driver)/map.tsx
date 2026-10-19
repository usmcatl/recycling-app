import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Map, type MapPin } from '@/components/Map';
import { useDateLabel, useMaterialsLabel } from '@/components/requests';
import { RoleSwitch } from '@/components/RoleSwitch';
import { UrgentRoutes } from '@/components/UrgentRoutes';
import { Button, Card, DemoBanner, Row, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { RECYCLING_CENTER } from '@/lib/constants';
import { distanceKm, formatDistance, orderStops } from '@/lib/format';
import type { PickupRequest } from '@/lib/types';
import { useData } from '@/lib/use-data';
import { useDriverRoutes } from '@/lib/use-driver-data';
import { useDriver } from '@/providers/driver';
import { ambientShadow, colors, radius, space } from '@/theme';

/** Driver home: map of today's route with the next stop, or the next route to drive. */
export default function DriverHome() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { position, locationDenied } = useDriver();
  const { current, next, open } = useDriverRoutes();
  const materialsLabel = useMaterialsLabel();
  const dateLabel = useDateLabel();

  const routeId = current?.id ?? null;
  const { data: stops } = useData(async () => (routeId ? api.listRouteStops(routeId) : []), [routeId, current?.status]);
  const ordered = orderStops(stops ?? [], position ?? RECYCLING_CENTER.location);
  const nextStop = ordered.find((s) => s.status === 'en_route') ?? null;

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

  const shown = current ?? next;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Map pins={pins} focus={focus} me={position} onPinPress={(id) => id !== 'center' && router.push(`/case/${id}`)} />

      <View style={[styles.top, { paddingTop: insets.top + space.sm }]}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Image
            source={require('../../../assets/images/logo-mark.png')}
            style={styles.mark}
            resizeMode="contain"
            accessibilityLabel={t('common.appName')}
          />
          <RoleSwitch />
        </Row>
      </View>
      <DemoBanner />

      <View style={styles.sheetWrap} pointerEvents="box-none">
        <UrgentRoutes routes={open} style={{ marginBottom: space.sm }} />
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
            {shown ? (
              <>
                <Text variant="headline">{shown.community}</Text>
                <Text variant="bodySmall">
                  {dateLabel(shown.route_date)} · {t('common.stops', { count: shown.stop_count })}
                </Text>
                <Button label={t('driver.viewRoute')} icon="arrow-forward" onPress={() => router.push(`/route/${shown.id}`)} />
              </>
            ) : (
              <>
                <Text>{t('driver.noRoutes')}</Text>
                <Button label={t('driver.findRoutes')} icon="route" onPress={() => router.push('/routes')} />
              </>
            )}
            <Text variant="bodySmall" style={{ textAlign: 'center' }}>
              {t('driver.locationNote')}
            </Text>
          </Card>
        )}
      </View>
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
    backgroundColor: 'rgba(248,250,248,0.9)',
  },
  mark: { width: 44, height: 36 },
  sheetWrap: { position: 'absolute', left: space.md, right: space.md, bottom: 100 },
  sheet: { borderRadius: radius.xl },
});
