import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { daysUntil, formatDate, formatKg } from '@/lib/format';
import type { MaterialId, PickupRequest, RequestStatus, RouteStatus } from '@/lib/types';
import { colors, space } from '@/theme';
import { Card, Chip, Icon, ProgressBar, Row, Text } from './ui';

export function statusTone(status: RequestStatus): 'secondary' | 'tertiary' | 'error' | 'neutral' {
  if (status === 'deposited' || status === 'picked_up') return 'secondary';
  if (status === 'cancelled' || status === 'no_show') return 'error';
  if (status === 'open') return 'neutral';
  return 'tertiary';
}

export function StatusChip({ status }: { status: RequestStatus }) {
  const { t } = useTranslation();
  return <Chip label={t(`status.${status}`)} tone={statusTone(status)} />;
}

export function RouteStatusChip({ status }: { status: RouteStatus }) {
  const { t } = useTranslation();
  const tone = status === 'open' ? 'neutral' : status === 'completed' ? 'secondary' : 'tertiary';
  return <Chip label={t(`routeStatus.${status}`)} tone={tone} />;
}

export function useMaterialsLabel() {
  const { t } = useTranslation();
  return (materials: MaterialId[], other?: string | null) =>
    materials.map((m) => (m === 'other' && other ? other : t(`materials.${m}`))).join(', ');
}

/** "Today" / "Tomorrow" / "Tue, Oct 6" */
export function useDateLabel() {
  const { t } = useTranslation();
  return (isoDate: string) => {
    const d = daysUntil(isoDate);
    if (d === 0) return t('common.today');
    if (d === 1) return t('common.tomorrow');
    return formatDate(isoDate);
  };
}

/** Compact card used in history lists and route stop lists. */
export function RequestCard({ request, onPress, trailing, showDonor }: {
  request: PickupRequest;
  onPress?: () => void;
  trailing?: string;
  showDonor?: boolean;
}) {
  const { t } = useTranslation();
  const label = useMaterialsLabel();
  const dateLabel = useDateLabel();
  const kg = request.actual_kg ?? request.estimated_kg;
  return (
    <Card onPress={onPress}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="eyebrow">#{request.case_code}</Text>
        <StatusChip status={request.status} />
      </Row>
      <Text variant="title">{showDonor && request.donor ? request.donor.full_name : label(request.materials, request.other_material)}</Text>
      <Text variant="bodySmall">
        {dateLabel(request.route_date)} · {t(`modes.${request.pickup_mode}`)} · {t('common.bags', { count: request.bag_count })}
      </Text>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={6} style={{ flex: 1 }}>
          <Icon name="location-on" size={16} color={colors.outline} />
          <Text variant="bodySmall" numberOfLines={1} style={{ flex: 1 }}>
            {showDonor ? request.address : request.community}
          </Text>
        </Row>
        <Text variant="label" style={{ color: colors.primary }}>
          {trailing ?? t('common.kg', { value: formatKg(kg) })}
        </Text>
      </Row>
    </Card>
  );
}

const STEPS: RequestStatus[] = ['open', 'claimed', 'en_route', 'picked_up'];

/** Progress tracker shown at the top of the donor's request status screen. */
export function StatusTracker({ status }: { status: RequestStatus }) {
  const { t } = useTranslation();
  const idx = status === 'deposited' ? STEPS.length - 1 : Math.max(0, STEPS.indexOf(status));
  const labels = [
    t('requestStatus.stepConfirmed'),
    t('requestStatus.stepAssigned'),
    t('requestStatus.stepEnRoute'),
    t('requestStatus.stepCollected'),
  ];
  return (
    <View style={{ gap: space.sm }}>
      <ProgressBar value={(idx + 1) / STEPS.length} />
      <Row style={{ justifyContent: 'space-between' }}>
        {labels.map((l, i) => (
          <Text
            key={l}
            variant="eyebrow"
            style={{ fontSize: 9, letterSpacing: 0.8, color: i <= idx ? colors.primary : colors.outline }}
          >
            {l}
          </Text>
        ))}
      </Row>
    </View>
  );
}
