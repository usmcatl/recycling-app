import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { RequestCard } from '@/components/requests';
import { BrandBar, Card, IconTile, Row, Screen, Segmented, Stat, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { ACTIVE_STATUSES, badgeFor } from '@/lib/constants';
import { formatKg } from '@/lib/format';
import type { PickupRequest } from '@/lib/types';
import { useData } from '@/lib/use-data';
import { colors } from '@/theme';

type Filter = 'all' | 'active' | 'done' | 'closed';

const filters: Record<Filter, (r: PickupRequest) => boolean> = {
  all: () => true,
  active: (r) => ACTIVE_STATUSES.includes(r.status),
  done: (r) => r.status === 'deposited',
  closed: (r) => r.status === 'cancelled' || r.status === 'no_show',
};

export default function Activity() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>('all');
  const { data } = useData(() => api.listMyRequests());
  const requests = data ?? [];
  const done = requests.filter(filters.done);
  const kg = done.reduce((s, r) => s + (r.actual_kg ?? r.estimated_kg), 0);

  return (
    <View style={{ flex: 1 }}>
      <BrandBar />
      <Screen>
        <Text variant="display">{t('activity.title')}</Text>
        <Text>{t('activity.body')}</Text>

        <Row>
          <Card style={{ flex: 1 }}>
            <IconTile name="recycling" size={40} />
            <Stat value={`${formatKg(kg)}`} label={t('activity.kgDiverted')} />
          </Card>
          <Card style={{ flex: 1 }}>
            <IconTile name="local-shipping" size={40} bg={colors.tertiaryFixed} color={colors.tertiary} />
            <Stat value={String(done.length)} label={t('activity.completed')} />
          </Card>
        </Row>
        <Card tone="primary" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IconTile name="eco" size={40} bg="rgba(255,255,255,0.15)" color={colors.primaryFixed} />
          <View>
            <Text variant="title" style={{ color: colors.onPrimary }}>
              {t(`badges.${badgeFor(kg).current.id}`)}
            </Text>
            <Text variant="eyebrow" style={{ color: colors.onPrimaryContainer }}>
              {t('activity.badge')}
            </Text>
          </View>
        </Card>

        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('activity.filterAll') },
            { value: 'active', label: t('activity.filterActive') },
            { value: 'done', label: t('activity.filterDone') },
            { value: 'closed', label: t('activity.filterClosed') },
          ]}
        />

        {requests.length === 0 ? (
          <Card tone="low">
            <Text>{t('activity.empty')}</Text>
          </Card>
        ) : (
          requests
            .filter(filters[filter])
            .map((r) => <RequestCard key={r.id} request={r} onPress={() => router.push(`/status/${r.id}`)} />)
        )}
      </Screen>
    </View>
  );
}
