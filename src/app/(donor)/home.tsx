import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { RequestCard, useDateLabel } from '@/components/requests';
import { BrandBar, Button, Card, DemoBanner, IconTile, ProgressBar, Row, Screen, Stat, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { ACTIVE_STATUSES, badgeFor } from '@/lib/constants';
import { formatKg, formatTime, weekdayName } from '@/lib/format';
import { cutoffFor, routeWeekday, upcomingRouteDates } from '@/lib/schedule';
import { useData } from '@/lib/use-data';
import { useSession } from '@/providers/session';
import { colors, space } from '@/theme';

export default function DonorHome() {
  const { t } = useTranslation();
  const { profile } = useSession();
  const { data: requests } = useData(() => api.listMyRequests());

  const active = (requests ?? []).filter((r) => ACTIVE_STATUSES.includes(r.status));
  const done = (requests ?? []).filter((r) => r.status === 'deposited');
  const kg = done.reduce((sum, r) => sum + (r.actual_kg ?? r.estimated_kg), 0);
  const badge = badgeFor(kg);
  const firstName = profile?.full_name.split(' ')[0] ?? '';
  const dateLabel = useDateLabel();
  const weekday = routeWeekday(profile?.community);
  const nextDate = upcomingRouteDates(profile?.community, 1)[0];

  return (
    <View style={{ flex: 1 }}>
      <BrandBar />
      <DemoBanner />
      <Screen>
        <View style={{ gap: space.sm }}>
          <Text variant="eyebrow">{t('donorHome.greeting', { name: firstName })}</Text>
          <Text variant="display">{t('donorHome.headline')}</Text>
        </View>

        <Card tone="secondary" style={{ padding: space.xl }}>
          <IconTile name="recycling" bg={colors.surfaceContainerLowest} />
          <Text variant="headline">{t('donorHome.requestPickup')}</Text>
          <Text>
            {weekday != null
              ? t('donorHome.requestBody', { day: weekdayName(weekday), cutoff: formatTime(cutoffFor('2023-01-02')) })
              : t('donorHome.requestBodyNoRoute')}
          </Text>
          {nextDate ? (
            <Text variant="label" style={{ color: colors.primary }}>
              {t('donorHome.nextRoute', { community: profile?.community, date: dateLabel(nextDate) })}
            </Text>
          ) : null}
          <Button
            label={t('donorHome.requestPickup')}
            icon="arrow-forward"
            onPress={() => router.push('/request/materials')}
            style={{ alignSelf: 'flex-start' }}
          />
        </Card>

        <View style={{ gap: space.md }}>
          <Text variant="eyebrow">{t('donorHome.activeTitle')}</Text>
          {active.length === 0 ? (
            <Card tone="low">
              <Text>{t('donorHome.noActive')}</Text>
            </Card>
          ) : (
            active.map((r) => (
              <RequestCard key={r.id} request={r} onPress={() => router.push(`/status/${r.id}`)} />
            ))
          )}
        </View>

        <Card tone="primary">
          <Text variant="eyebrow" style={{ color: colors.onPrimaryContainer }}>
            {t('donorHome.yourImpact')}
          </Text>
          <Row gap={space.xl}>
            <Stat light value={formatKg(kg)} label={t('donorHome.kgDiverted')} />
            <Stat light value={String(done.length)} label={t('donorHome.pickups')} />
          </Row>
          <Text variant="label" style={{ color: colors.primaryFixed }}>
            {t(`badges.${badge.current.id}`)}
          </Text>
          <ProgressBar value={badge.progress} track="rgba(255,255,255,0.18)" fill={colors.primaryFixed} />
        </Card>

        <Card tone="low">
          <Text variant="eyebrow">{t('donorHome.tipTitle')}</Text>
          <Text>{t('donorHome.tip')}</Text>
        </Card>
      </Screen>
    </View>
  );
}
