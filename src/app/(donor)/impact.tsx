import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Avatar, BrandBar, Card, Icon, ProgressBar, Row, Screen, Segmented, Stat, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { badgeFor } from '@/lib/constants';
import { formatKg } from '@/lib/format';
import type { LeaderboardRow } from '@/lib/types';
import { useData } from '@/lib/use-data';
import { useSession } from '@/providers/session';
import { colors, radius, space } from '@/theme';

const medal = ['#e8b931', '#a8b0b5', '#c8814a'];

export default function Impact() {
  const { t } = useTranslation();
  const { userId } = useSession();
  const [period, setPeriod] = useState<'month' | 'all'>('all');
  const board = useData(() => api.leaderboard(period), [period]);
  const lifetime = useData(() => api.leaderboard('all'));

  const rows = board.data ?? [];
  const mine = (lifetime.data ?? []).find((r) => r.user_id === userId);
  const kg = mine?.kg ?? 0;
  const badge = badgeFor(kg);

  return (
    <View style={{ flex: 1 }}>
      <BrandBar title={t('impact.title')} />
      <Screen>
        <Card tone="primary">
          <Text variant="eyebrow" style={{ color: colors.onPrimaryContainer }}>
            {t('impact.yourStanding')}
          </Text>
          <Text variant="display" style={{ color: colors.onPrimary, fontSize: 40, lineHeight: 46 }}>
            {mine ? t('impact.rank', { rank: mine.rank }) : t('impact.unranked')}
          </Text>
          <Row gap={space.xl}>
            <Stat light value={`${formatKg(kg)} kg`} label={t('impact.diverted')} />
            <Stat light value={String(mine?.pickups ?? 0)} label={t('impact.pickups')} />
          </Row>
        </Card>

        <Card tone="tertiary">
          <Text variant="eyebrow" style={{ color: colors.onTertiaryContainer }}>
            {t('impact.nextMilestone')}
          </Text>
          <Text variant="headline" style={{ color: colors.tertiaryFixed }}>
            {t(`badges.${(badge.next ?? badge.current).id}`)}
          </Text>
          <ProgressBar value={badge.progress} track="rgba(255,255,255,0.18)" fill={colors.tertiaryFixed} />
          <Text variant="bodySmall" style={{ color: colors.onTertiaryContainer }}>
            {badge.next
              ? t('impact.toNext', { kg: formatKg(badge.remainingKg), badge: t(`badges.${badge.next.id}`) })
              : t('impact.maxBadge')}
          </Text>
        </Card>

        <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Text variant="headline">{t('impact.topContributors')}</Text>
          <Segmented
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'month', label: t('impact.monthly') },
              { value: 'all', label: t('impact.allTime') },
            ]}
          />
        </Row>

        {rows.length === 0 ? (
          <Card tone="low">
            <Text>{t('impact.empty')}</Text>
          </Card>
        ) : null}

        {rows.slice(0, 3).map((r, i) => (
          <Podium key={r.user_id} row={r} color={medal[i]} me={r.user_id === userId} />
        ))}

        {rows.length > 3 ? (
          <Card tone="low" style={{ gap: space.lg }}>
            {rows.slice(3).map((r) => (
              <Row key={r.user_id}>
                <Text variant="label" style={{ width: 24, color: colors.outline }}>
                  {r.rank}
                </Text>
                <Avatar name={r.display_name} />
                <View style={{ flex: 1 }}>
                  <Text variant="label" style={r.user_id === userId && { color: colors.primary }}>
                    {r.display_name}
                  </Text>
                  <Text variant="bodySmall">{t(`badges.${badgeFor(r.kg).current.id}`)}</Text>
                </View>
                <Text variant="label" style={{ color: colors.primary }}>
                  {formatKg(r.kg)} kg
                </Text>
              </Row>
            ))}
          </Card>
        ) : null}
      </Screen>
    </View>
  );
}

function Podium({ row, color, me }: { row: LeaderboardRow; color: string; me: boolean }) {
  const { t } = useTranslation();
  return (
    <Card style={{ alignItems: 'center', gap: space.sm }}>
      <View>
        <Avatar name={row.display_name} size={72} />
        <View style={[styles.medal, { backgroundColor: color }]}>
          <Icon name="eco" size={14} color="#fff" />
        </View>
      </View>
      <Text variant="title" style={me && { color: colors.primary }}>
        {row.display_name}
      </Text>
      <Text variant="label" style={{ color: colors.primary, fontSize: 16 }}>
        {formatKg(row.kg)} kg
      </Text>
      <Text variant="eyebrow">{t(`badges.${badgeFor(row.kg).current.id}`)}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  medal: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 26,
    height: 26,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
});
