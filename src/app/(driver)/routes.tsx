import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { confirmAction } from '@/components/confirm';
import { RouteCard } from '@/components/RouteCard';
import { UrgentRoutes } from '@/components/UrgentRoutes';
import { BrandBar } from '@/components/BrandBar';
import { Button, ButtonRow, Card, ErrorText, Icon, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { weekdayName } from '@/lib/format';
import { routeWeekday } from '@/lib/schedule';
import { useDriverRoutes } from '@/lib/use-driver-data';
import { colors, space } from '@/theme';

export default function Routes() {
  const { t } = useTranslation();
  const { mine, open, weekly, reload } = useDriverRoutes();
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <BrandBar title={t('routes.title')} />
      <Screen>
        <Text>{t('routes.body')}</Text>
        <UrgentRoutes routes={open} />
        <ErrorText message={error} />

        {mine.length > 0 ? (
          <View style={{ gap: space.md }}>
            <Text variant="eyebrow">{t('routes.mine')}</Text>
            {mine.map((r) => (
              <RouteCard key={r.id} route={r} onPress={() => router.push(`/route/${r.id}`)} />
            ))}
          </View>
        ) : null}

        {weekly.length > 0 ? (
          <View style={{ gap: space.md }}>
            <Text variant="eyebrow">{t('routes.weekly')}</Text>
            <Card tone="low" style={{ gap: space.sm }}>
              {weekly.map((community) => (
                <Row key={community}>
                  <Icon name="repeat" color={colors.primary} />
                  <Text variant="label" style={{ flex: 1 }}>
                    {t('routes.weeklyItem', { community, day: weekdayName(routeWeekday(community) ?? 0) })}
                  </Text>
                  <Button
                    variant="tertiary"
                    label={t('routes.stopWeekly')}
                    onPress={() =>
                      confirmAction({
                        title: t('routes.stopWeeklyConfirm', { community }),
                        yes: t('common.confirm'),
                        no: t('common.back'),
                        onYes: () => run(() => api.endCommitment(community)),
                      })
                    }
                  />
                </Row>
              ))}
            </Card>
          </View>
        ) : null}

        <View style={{ gap: space.md }}>
          <Text variant="eyebrow">{t('routes.open')}</Text>
          {open.length === 0 ? (
            <Card tone="low">
              <Text>{t('routes.noOpen')}</Text>
            </Card>
          ) : (
            open.map((r) => (
              <RouteCard key={r.id} route={r} onPress={() => router.push(`/route/${r.id}`)}>
                <ButtonRow>
                  <Button label={t('routes.takeDay')} onPress={() => run(() => api.claimRoute(r.id, false))} />
                  <Button
                    variant="secondary"
                    label={t('routes.everyWeek')}
                    icon="repeat"
                    onPress={() => run(() => api.claimRoute(r.id, true))}
                  />
                </ButtonRow>
              </RouteCard>
            ))
          )}
        </View>
      </Screen>
    </View>
  );
}
