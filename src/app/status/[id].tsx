import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, View } from 'react-native';
import { Map } from '@/components/Map';
import { RatingCard, ReputationLine, useReputation } from '@/components/rating';
import { StatusChip, StatusTracker, useDateLabel, useMaterialsLabel } from '@/components/requests';
import { StopPhoto } from '@/components/StopPhoto';
import { Avatar, Button, Card, Chip, Header, Icon, IconTile, Loading, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { callNumber, formatKg, openWhatsApp } from '@/lib/format';
import { isPastCutoff } from '@/lib/schedule';
import type { LatLng, PickupRequest } from '@/lib/types';
import { useData } from '@/lib/use-data';
import { colors, radius, space } from '@/theme';

export default function RequestStatusScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, setData, reload } = useData(() => api.getRequest(id), [id]);
  const [driverPos, setDriverPos] = useState<LatLng | null>(null);
  const materialsLabel = useMaterialsLabel();
  const dateLabel = useDateLabel();
  const reputation = useReputation([data?.driver_id]);

  useEffect(() => api.subscribeRequest(id, (r) => setData(r)), [id, setData]);

  const tracking = data?.driver_id && data.status === 'en_route' ? data.driver_id : null;
  useEffect(() => {
    if (!tracking) return;
    api.getDriverLocation(tracking).then(setDriverPos).catch(() => {});
    return api.subscribeDriverLocation(tracking, setDriverPos);
  }, [tracking]);

  if (loading && !data) return <Loading />;
  if (!data) {
    return (
      <View style={{ flex: 1 }}>
        <Header title={t('requestStatus.title')} />
        <Screen>
          <Text>{t('requestStatus.notFound')}</Text>
        </Screen>
      </View>
    );
  }

  const r: PickupRequest = data;
  const cancellable = r.status === 'open' || r.status === 'claimed';
  const late = isPastCutoff(r.route_date);

  function confirmCancel() {
    const run = async () => {
      await api.cancelRequest(r.id);
      await reload();
    };
    if (Platform.OS === 'web') {
      run();
      return;
    }
    Alert.alert(t('requestStatus.cancelConfirm'), late ? t('requestStatus.cancelLate') : undefined, [
      { text: t('common.back'), style: 'cancel' },
      { text: t('requestStatus.cancelYes'), style: 'destructive', onPress: run },
    ]);
  }

  return (
    <View style={{ flex: 1 }}>
      <Header title={t('requestStatus.title')} />
      <Screen>
        <Card tone="low">
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="eyebrow">
              {t('common.caseId')}: {r.case_code}
            </Text>
            <StatusChip status={r.status} />
          </Row>
          <Text variant="display" style={{ color: colors.primary }}>
            {r.status === 'deposited' ? t('requestStatus.doneTitle') : t(`status.${r.status}`)}
          </Text>
          {r.status === 'deposited' ? <Text>{t('requestStatus.doneBody')}</Text> : null}
          {r.status !== 'cancelled' && r.status !== 'no_show' ? <StatusTracker status={r.status} /> : null}
          {r.status_note ? (
            <Text variant="bodySmall">
              {t('requestStatus.note')}: {r.status_note}
            </Text>
          ) : null}
        </Card>

        <RatingCard request={r} rateeRole="driver" />

        {r.status === 'open' ? (
          <Card tone="secondary" style={{ flexDirection: 'row' }}>
            <Icon name="hourglass-empty" />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="label">{t('requestStatus.waitingTitle')}</Text>
              <Text variant="bodySmall">
                {t('requestStatus.waitingBody', { community: r.community, date: dateLabel(r.route_date) })}
              </Text>
            </View>
          </Card>
        ) : null}

        {r.driver ? (
          <Card style={{ alignItems: 'center' }}>
            <Text variant="eyebrow">{t('requestStatus.yourDriver')}</Text>
            <Avatar name={r.driver.full_name} size={80} />
            <Text variant="headline">{r.driver.full_name}</Text>
            <ReputationLine reputation={reputation[r.driver.id]} />
            {r.driver.whatsapp ? (
              <Row>
                <Button label={t('common.call')} icon="call" onPress={() => callNumber(r.driver!.whatsapp!)} style={{ flex: 1 }} />
                <Button
                  variant="secondary"
                  label={t('common.whatsapp')}
                  icon="chat"
                  onPress={() => openWhatsApp(r.driver!.whatsapp!, `Recycle Connect #${r.case_code}`)}
                  style={{ flex: 1 }}
                />
              </Row>
            ) : null}
            {r.driver.vehicle_make || r.driver.vehicle_model ? (
              <Card tone="low" style={{ alignSelf: 'stretch' }}>
                <Text variant="eyebrow">{t('requestStatus.vehicle')}</Text>
                <Text variant="title">
                  {[r.driver.vehicle_color, r.driver.vehicle_make, r.driver.vehicle_model].filter(Boolean).join(' ')}
                </Text>
                {r.driver.vehicle_plate ? (
                  <Text variant="bodySmall">{t('requestStatus.plate', { plate: r.driver.vehicle_plate })}</Text>
                ) : null}
              </Card>
            ) : null}
          </Card>
        ) : null}

        {tracking ? (
          <View style={{ gap: space.md }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="headline">{t('requestStatus.liveLocation')}</Text>
              <Chip label={t('requestStatus.liveTracking')} />
            </Row>
            <View style={{ height: 240, borderRadius: radius.xl, overflow: 'hidden' }}>
              <Map
                focus={driverPos ?? (r.lat != null && r.lng != null ? { lat: r.lat, lng: r.lng } : null)}
                pins={[
                  ...(r.lat != null && r.lng != null ? [{ id: 'home', kind: 'home' as const, position: { lat: r.lat, lng: r.lng } }] : []),
                  ...(driverPos ? [{ id: 'driver', kind: 'driver' as const, position: driverPos }] : []),
                ]}
              />
            </View>
          </View>
        ) : null}

        {r.photo_url ? (
          <Card tone="low">
            <Text variant="eyebrow">{t('requestStatus.photo')}</Text>
            <StopPhoto photoRef={r.photo_url} />
          </Card>
        ) : null}

        <Card tone="low">
          <Text variant="eyebrow">{t('requestStatus.details')}</Text>
          <Row>
            <IconTile name="eco" size={44} bg={colors.surfaceContainerLowest} />
            <View style={{ flex: 1 }}>
              <Text variant="label">{materialsLabel(r.materials, r.other_material)}</Text>
              <Text variant="bodySmall">
                {r.actual_kg != null
                  ? t('requestStatus.actual', { kg: formatKg(r.actual_kg) })
                  : t('requestStatus.estimated', { kg: formatKg(r.estimated_kg), bags: t('common.bags', { count: r.bag_count }) })}
              </Text>
            </View>
          </Row>
          <Row>
            <IconTile name="event" size={44} bg={colors.surfaceContainerLowest} />
            <View style={{ flex: 1 }}>
              <Text variant="label">{t('requestStatus.scheduled')}</Text>
              <Text variant="bodySmall">
                {dateLabel(r.route_date)} · {r.community}
              </Text>
            </View>
          </Row>
          <Row>
            <IconTile name={r.pickup_mode === 'doorstep' ? 'door-front' : 'handshake'} size={44} bg={colors.surfaceContainerLowest} />
            <View style={{ flex: 1 }}>
              <Text variant="label">{t('requestStatus.mode')}</Text>
              <Text variant="bodySmall">{t(`modes.${r.pickup_mode}`)}</Text>
            </View>
          </Row>
          <Row>
            <IconTile name="location-on" size={44} bg={colors.surfaceContainerLowest} />
            <View style={{ flex: 1 }}>
              <Text variant="label">{t('requestStatus.address')}</Text>
              <Text variant="bodySmall">{[r.address, r.community].filter(Boolean).join(', ')}</Text>
            </View>
          </Row>
          {r.instructions ? (
            <Row>
              <IconTile name="edit-note" size={44} bg={colors.surfaceContainerLowest} />
              <View style={{ flex: 1 }}>
                <Text variant="label">{t('requestStatus.instructions')}</Text>
                <Text variant="bodySmall">{r.instructions}</Text>
              </View>
            </Row>
          ) : null}
        </Card>

        {cancellable ? (
          <View style={{ gap: space.sm }}>
            {late ? (
              <Text variant="bodySmall" style={{ textAlign: 'center' }}>
                {t('requestStatus.cancelLate')}
              </Text>
            ) : null}
            <Button variant="danger" label={t('requestStatus.cancel')} onPress={confirmCancel} />
          </View>
        ) : null}
      </Screen>
    </View>
  );
}
