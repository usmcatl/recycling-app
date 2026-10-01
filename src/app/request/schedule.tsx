import { router } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useDateLabel } from '@/components/requests';
import { Button, Card, Header, Icon, IconTile, Screen, Text, type IconName } from '@/components/ui';
import { formatDateTime, weekdayName } from '@/lib/format';
import { cutoffFor, routeWeekday, upcomingRouteDates } from '@/lib/schedule';
import type { PickupMode } from '@/lib/types';
import { useRequestDraft } from '@/providers/request-draft';
import { useSession } from '@/providers/session';
import { colors, space } from '@/theme';

const MODES: { id: PickupMode; icon: IconName }[] = [
  { id: 'doorstep', icon: 'door-front' },
  { id: 'in_person', icon: 'handshake' },
];

export default function Schedule() {
  const { t } = useTranslation();
  const { profile } = useSession();
  const { draft, update } = useRequestDraft();
  const dateLabel = useDateLabel();
  const community = profile?.community ?? null;
  const weekday = routeWeekday(community);
  const dates = upcomingRouteDates(community, 3);

  // default to the soonest route day
  useEffect(() => {
    if (!draft.routeDate && dates[0]) update({ routeDate: dates[0] });
  }, [draft.routeDate, dates, update]);

  if (weekday == null) {
    return (
      <View style={{ flex: 1 }}>
        <Header title={t('scheduleStep.title')} />
        <Screen>
          <Text variant="display">{t('scheduleStep.headline')}</Text>
          <Card tone="low">
            <Text>{t('scheduleStep.noRoute')}</Text>
            <Button
              variant="secondary"
              label={t('scheduleStep.editProfile')}
              onPress={() => router.push({ pathname: '/profile-setup', params: { edit: '1' } })}
            />
          </Card>
        </Screen>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Header title={t('scheduleStep.title')} />
      <Screen>
        <Text variant="eyebrow">{t('scheduleStep.eyebrow')}</Text>
        <Text variant="display">{t('scheduleStep.headline')}</Text>
        <Text>{t('scheduleStep.body', { community, day: weekdayName(weekday) })}</Text>

        {dates.map((date) => {
          const on = date === draft.routeDate;
          return (
            <Pressable
              key={date}
              onPress={() => update({ routeDate: date })}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
            >
              <Card tone={on ? 'secondary' : 'lowest'} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <IconTile name="event" size={44} bg={on ? colors.surfaceContainerLowest : colors.surfaceContainerLow} />
                <View style={{ flex: 1 }}>
                  <Text variant="title">{dateLabel(date)}</Text>
                  <Text variant="bodySmall">{t('scheduleStep.cutoff', { time: formatDateTime(cutoffFor(date)) })}</Text>
                </View>
                <Icon
                  name={on ? 'radio-button-checked' : 'radio-button-unchecked'}
                  color={on ? colors.primary : colors.outlineVariant}
                />
              </Card>
            </Pressable>
          );
        })}

        <Text variant="eyebrow" style={{ marginTop: space.sm }}>
          {t('scheduleStep.howTitle')}
        </Text>
        {MODES.map((m) => {
          const on = m.id === draft.mode;
          return (
            <Pressable
              key={m.id}
              onPress={() => update({ mode: m.id })}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
            >
              <Card tone={on ? 'secondary' : 'lowest'} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <IconTile name={m.icon} size={44} bg={on ? colors.surfaceContainerLowest : colors.surfaceContainerLow} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text variant="title">{t(`modes.${m.id}`)}</Text>
                  <Text variant="bodySmall">{t(`modes.${m.id}Desc`)}</Text>
                </View>
                <Icon
                  name={on ? 'radio-button-checked' : 'radio-button-unchecked'}
                  color={on ? colors.primary : colors.outlineVariant}
                />
              </Card>
            </Pressable>
          );
        })}

        <Card tone="tertiary" style={{ flexDirection: 'row' }}>
          <Icon name="eco" color={colors.tertiaryFixed} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="label" style={{ color: colors.tertiaryFixed }}>
              {t('scheduleStep.tipTitle')}
            </Text>
            <Text variant="bodySmall" style={{ color: colors.onTertiaryContainer }}>
              {t('scheduleStep.tip')}
            </Text>
          </View>
        </Card>

        <Button
          label={t('common.continue')}
          icon="arrow-forward"
          disabled={!draft.routeDate}
          onPress={() => router.push('/request/details')}
        />
      </Screen>
    </View>
  );
}
