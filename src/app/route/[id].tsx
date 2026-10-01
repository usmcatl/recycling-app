import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { confirmAction } from '@/components/confirm';
import { Map, type MapPin } from '@/components/Map';
import { RequestCard } from '@/components/requests';
import { RouteCard } from '@/components/RouteCard';
import { Button, Card, ErrorText, Header, Loading, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { RECYCLING_CENTER } from '@/lib/constants';
import { openDirections, orderStops } from '@/lib/format';
import { isPastCutoff, todayIso } from '@/lib/schedule';
import { useData } from '@/lib/use-data';
import { useSession } from '@/providers/session';
import { colors, radius, space } from '@/theme';

export default function RouteDetail() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useSession();
  const { data, reload } = useData(async () => {
    const [route, stops] = await Promise.all([api.getRoute(id), api.listRouteStops(id)]);
    return { route, stops };
  }, [id]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => api.subscribeRoutes(() => reload()), [reload]);

  if (!data) return <Loading />;
  const { route } = data;
  if (!route) {
    return (
      <View style={{ flex: 1 }}>
        <Header title={t('route.title')} />
        <Screen>
          <Text>{t('requestStatus.notFound')}</Text>
        </Screen>
      </View>
    );
  }

  const mine = route.driver_id === userId;
  const stops = orderStops(data.stops, RECYCLING_CENTER.location);
  const pending = stops.filter((s) => s.status === 'en_route');
  const canStart = mine && route.status === 'claimed' && route.route_date <= todayIso();

  async function run(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const pins: MapPin[] = [
    ...stops
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => ({
        id: s.id,
        kind: (s.status === 'en_route' || s.status === 'claimed' || s.status === 'open' ? 'pickup' : 'home') as MapPin['kind'],
        position: { lat: s.lat!, lng: s.lng! },
        title: s.address,
      })),
    { id: 'center', kind: 'center', position: RECYCLING_CENTER.location, title: RECYCLING_CENTER.name },
  ];

  return (
    <View style={{ flex: 1 }}>
      <Header title={t('route.title')} />
      <Screen>
        <RouteCard route={route} />
        <ErrorText message={error} />

        {route.status === 'open' ? (
          <View style={{ gap: space.sm }}>
            <Button label={t('routes.takeDay')} onPress={() => run(() => api.claimRoute(route.id, false))} />
            <Button variant="secondary" icon="repeat" label={t('routes.everyWeek')} onPress={() => run(() => api.claimRoute(route.id, true))} />
          </View>
        ) : null}

        {!mine && route.status !== 'open' ? (
          <Card tone="low">
            <Text>{t('routes.taken')}</Text>
          </Card>
        ) : null}

        {mine && route.status === 'claimed' ? (
          <View style={{ gap: space.sm }}>
            <Button label={t('route.start')} icon="local-shipping" disabled={!canStart} onPress={() => run(() => api.startRoute(route.id))} />
            {!canStart ? (
              <Text variant="bodySmall" style={{ textAlign: 'center' }}>
                {t('route.startHint')}
              </Text>
            ) : null}
            <Button
              variant="tertiary"
              label={t('route.skip')}
              onPress={() =>
                confirmAction({
                  title: t('route.skipConfirm'),
                  message: isPastCutoff(route.route_date) ? t('route.skipLate') : undefined,
                  yes: t('common.confirm'),
                  no: t('common.back'),
                  onYes: () => run(() => api.skipRoute(route.id)),
                })
              }
            />
          </View>
        ) : null}

        {stops.length > 0 ? (
          <View style={{ height: 220, borderRadius: radius.xl, overflow: 'hidden' }}>
            <Map pins={pins} onPinPress={(pinId) => pinId !== 'center' && router.push(`/case/${pinId}`)} />
          </View>
        ) : null}

        <View style={{ gap: space.md }}>
          <Text variant="eyebrow">{t('route.stops')}</Text>
          {stops.length === 0 ? (
            <Card tone="low">
              <Text>{t('route.noStops')}</Text>
            </Card>
          ) : (
            <>
              <Text variant="bodySmall">{t('route.orderHint')}</Text>
              {stops.map((s, i) => (
                <RequestCard
                  key={s.id}
                  request={s}
                  showDonor={mine}
                  trailing={`${i + 1}`}
                  onPress={() => router.push(`/case/${s.id}`)}
                />
              ))}
            </>
          )}
        </View>

        {mine && route.status === 'in_progress' ? (
          <Card tone="primary">
            <Button variant="secondary" icon="directions" label={t('route.navigateCenter')} onPress={() => openDirections(RECYCLING_CENTER.location)} />
            <Button
              variant="secondary"
              icon="eco"
              label={t('route.finish')}
              disabled={pending.length > 0}
              onPress={() => run(() => api.completeRoute(route.id))}
            />
            {pending.length > 0 ? (
              <Text variant="bodySmall" style={{ color: colors.onPrimaryContainer, textAlign: 'center' }}>
                {t('route.finishHint')}
              </Text>
            ) : null}
          </Card>
        ) : null}

        {route.status === 'completed' ? (
          <Card tone="secondary">
            <Text variant="title">{t('route.done')}</Text>
          </Card>
        ) : null}
      </Screen>
    </View>
  );
}
