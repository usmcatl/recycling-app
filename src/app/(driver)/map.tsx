import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Map, type MapPin } from '@/components/Map';
import { StatusChip, useMaterialsLabel } from '@/components/requests';
import { Avatar, Button, Card, Chip, DemoBanner, Icon, IconTile, Row, Stat, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { RECYCLING_CENTER } from '@/lib/constants';
import { formatDistance, formatKg } from '@/lib/format';
import type { PickupRequest } from '@/lib/types';
import { useDriverData } from '@/lib/use-driver-data';
import { useDriver } from '@/providers/driver';
import { useSession } from '@/providers/session';
import { ambientShadow, colors, fonts, radius, space } from '@/theme';

export default function DriverMap() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { profile } = useSession();
  const { active, setActive, position, locationDenied } = useDriver();
  const { open, inHand, closed, reload, distanceTo } = useDriverData(position);
  const materialsLabel = useMaterialsLabel();

  const current = inHand[0] ?? null;
  const today = new Date().toISOString().slice(0, 10);
  const doneToday = closed.filter((r) => r.status === 'deposited' && r.deposited_at?.slice(0, 10) === today);
  const kgToday = doneToday.reduce((s, r) => s + (r.actual_kg ?? r.estimated_kg), 0);

  const pins: MapPin[] = [
    ...open.filter(hasCoords).map((r) => ({ id: r.id, kind: 'pickup' as const, position: { lat: r.lat!, lng: r.lng! }, title: r.community ?? r.address })),
    ...inHand.filter(hasCoords).map((r) => ({ id: r.id, kind: 'active' as const, position: { lat: r.lat!, lng: r.lng! }, title: `#${r.case_code}` })),
    { id: 'center', kind: 'center', position: RECYCLING_CENTER.location, title: RECYCLING_CENTER.name },
  ];

  const nearest = open[0];
  const nearestKm = nearest ? distanceTo(nearest) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {active ? (
        <Map
          pins={pins}
          focus={position}
          showsUserLocation
          onPinPress={(id) => id !== 'center' && router.push(`/case/${id}`)}
        />
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
        </View>
      ) : (
        <View style={styles.sheetWrap} pointerEvents="box-none">
          {locationDenied ? (
            <Card tone="high" style={{ marginBottom: space.sm, padding: space.md }}>
              <Text variant="bodySmall">{t('driver.locationNeeded')}</Text>
            </Card>
          ) : null}
          {nearestKm != null && !current ? (
            <View style={styles.nearest}>
              <Text variant="label" style={{ color: colors.primary }}>
                {t('driver.nearest', { distance: formatDistance(nearestKm) })}
              </Text>
            </View>
          ) : null}
          {current ? (
            <CurrentCase request={current} distance={distanceTo(current)} onChanged={reload} label={materialsLabel(current.materials, current.other_material)} />
          ) : (
            <Card style={[styles.sheet, ambientShadow]}>
              <Text variant="eyebrow">{t('driver.openRequests')}</Text>
              {nearest ? (
                <>
                  <Text variant="headline">{nearest.community ?? nearest.address}</Text>
                  <Text variant="bodySmall">
                    {materialsLabel(nearest.materials, nearest.other_material)} · {t('common.bags', { count: nearest.bag_count })}
                  </Text>
                  <Row>
                    <Button label={t('driver.viewCase')} icon="arrow-forward" onPress={() => router.push(`/case/${nearest.id}`)} style={{ flex: 1 }} />
                    <Button variant="secondary" label={`${open.length}`} icon="route" onPress={() => router.push('/routes')} />
                  </Row>
                </>
              ) : (
                <Text>{t('driver.noOpen')}</Text>
              )}
            </Card>
          )}
        </View>
      )}
    </View>
  );
}

function CurrentCase({ request: r, distance, onChanged, label }: {
  request: PickupRequest;
  distance: number | null;
  onChanged: () => void;
  label: string;
}) {
  const { t } = useTranslation();
  const collected = r.status === 'picked_up';

  return (
    <Card style={[styles.sheet, ambientShadow]}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ gap: 6, flex: 1 }}>
          <Chip label={label} tone="tertiary" icon="recycling" />
          <StatusChip status={r.status} />
          <Text variant="bodySmall">
            {t('common.caseId')}: #{r.case_code}
          </Text>
        </View>
        <IconTile name="local-shipping" size={52} />
      </Row>
      <Text variant="headline">{r.address}</Text>
      <Text variant="bodySmall">
        {[r.community, distance != null ? t('driver.away', { distance: formatDistance(distance) }) : null].filter(Boolean).join(' · ')}
      </Text>

      <Pressable onPress={() => router.push(`/case/${r.id}`)} accessibilityRole="checkbox" accessibilityState={{ checked: collected }}>
        <Row gap={space.sm}>
          <Icon name={collected ? 'check-box' : 'check-box-outline-blank'} />
          <Text variant="label" style={{ fontSize: 15 }}>
            {t('driver.pickupCompleted')}
          </Text>
        </Row>
      </Pressable>
      <Pressable
        disabled={!collected}
        onPress={async () => {
          await api.advanceRequest(r.id, 'deposited');
          onChanged();
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: false, disabled: !collected }}
        style={{ opacity: collected ? 1 : 0.45 }}
      >
        <Row gap={space.sm}>
          <Icon name="check-box-outline-blank" />
          <Text variant="label" style={{ fontSize: 15 }}>
            {t('driver.deposited')}
          </Text>
        </Row>
      </Pressable>

      <Button label={t('driver.viewCase')} icon="arrow-forward" onPress={() => router.push(`/case/${r.id}`)} />
    </Card>
  );
}

const hasCoords = (r: PickupRequest) => r.lat != null && r.lng != null;

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
  nearest: {
    alignSelf: 'flex-end',
    backgroundColor: colors.surfaceContainerLowest,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.md,
    marginBottom: space.sm,
  },
});
