import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { formatDateTime, formatKg } from '@/lib/format';
import { cutoffFor, isPastCutoff } from '@/lib/schedule';
import type { Route } from '@/lib/types';
import { colors } from '@/theme';
import { RouteStatusChip, useDateLabel } from './requests';
import { Card, Icon, Row, Text } from './ui';

/** One community's route on one day: when, how many stops, and whether stops are locked. */
export function RouteCard({ route, onPress, children }: { route: Route; onPress?: () => void; children?: ReactNode }) {
  const { t } = useTranslation();
  const dateLabel = useDateLabel();
  const locked = isPastCutoff(route.route_date);
  return (
    <Card onPress={onPress}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="eyebrow">{dateLabel(route.route_date)}</Text>
        <RouteStatusChip status={route.status} />
      </Row>
      <Row gap={6}>
        <Text variant="headline" style={{ flex: 1 }}>
          {route.community}
        </Text>
        {route.recurring ? <Icon name="repeat" size={20} color={colors.primary} /> : null}
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="bodySmall">
          {route.stop_count ? t('common.stops', { count: route.stop_count }) : t('routes.empty')}
          {route.stop_count ? ` · ≈ ${formatKg(route.estimated_kg)} kg` : ''}
        </Text>
        <Row gap={4}>
          <Icon name={locked ? 'lock' : 'lock-open'} size={14} color={colors.outline} />
          <Text variant="bodySmall">
            {locked ? t('routes.locked') : t('routes.cutoff', { time: formatDateTime(cutoffFor(route.route_date)) })}
          </Text>
        </Row>
      </Row>
      {children ? <View style={{ gap: 8 }}>{children}</View> : null}
    </Card>
  );
}
