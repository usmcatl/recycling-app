import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Card, Header, Icon, IconTile, Row, Screen, Text } from '@/components/ui';
import { currentLocale } from '@/i18n';
import { TIME_WINDOWS } from '@/lib/constants';
import { formatDate, toIsoDate } from '@/lib/format';
import { useRequestDraft } from '@/providers/request-draft';
import { colors, fonts, radius } from '@/theme';

/** Next 14 days, starting tomorrow. */
function upcomingDays() {
  const days: Date[] = [];
  const d = new Date();
  for (let i = 1; i <= 14; i++) {
    const next = new Date(d);
    next.setDate(d.getDate() + i);
    days.push(next);
  }
  return days;
}

export default function Schedule() {
  const { t } = useTranslation();
  const { draft, update } = useRequestDraft();
  const days = upcomingDays();
  const locale = currentLocale() === 'en' ? 'en-US' : 'es-MX';

  return (
    <View style={{ flex: 1 }}>
      <Header title={t('scheduleStep.title')} />
      <Screen>
        <Text variant="eyebrow">{t('scheduleStep.eyebrow')}</Text>
        <Text variant="display">{t('scheduleStep.headline')}</Text>
        <Text>{t('scheduleStep.body')}</Text>

        <Card tone="low">
          <Text variant="title" style={{ textTransform: 'capitalize' }}>
            {days[0].toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
          </Text>
          <View style={styles.grid}>
            {days.map((d) => {
              const iso = toIsoDate(d);
              const on = iso === draft.date;
              return (
                <Pressable
                  key={iso}
                  onPress={() => update({ date: iso })}
                  style={[styles.day, on && { backgroundColor: colors.primary }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={formatDate(iso)}
                >
                  <Text style={[styles.dow, on && { color: colors.onPrimaryContainer }]}>
                    {d.toLocaleDateString(locale, { weekday: 'short' }).slice(0, 3)}
                  </Text>
                  <Text style={[styles.dayNum, on && { color: colors.onPrimary }]}>{d.getDate()}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <Text variant="eyebrow">{t('scheduleStep.window')}</Text>
        {TIME_WINDOWS.map((w) => {
          const on = w.id === draft.window;
          return (
            <Pressable key={w.id} onPress={() => update({ window: w.id })} accessibilityRole="radio" accessibilityState={{ checked: on }}>
              <Card tone={on ? 'secondary' : 'lowest'} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <IconTile name={w.icon} size={44} bg={on ? colors.surfaceContainerLowest : colors.surfaceContainerLow} />
                <View style={{ flex: 1 }}>
                  <Text variant="title">{t(`windows.${w.id}`)}</Text>
                  <Text variant="bodySmall">{w.hours}</Text>
                </View>
                <Icon name={on ? 'radio-button-checked' : 'radio-button-unchecked'} color={on ? colors.primary : colors.outlineVariant} />
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

        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Text variant="eyebrow">{t('scheduleStep.summary')}</Text>
            <Text variant="title" style={{ color: colors.primary }}>
              {formatDate(draft.date)} · {t(`windows.${draft.window}`)}
            </Text>
          </View>
        </Row>
        <Button label={t('common.continue')} icon="arrow-forward" onPress={() => router.push('/request/details')} />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  day: {
    width: '13%',
    minWidth: 40,
    aspectRatio: 0.8,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerLowest,
  },
  dow: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.outline, textTransform: 'uppercase' },
  dayNum: { fontFamily: fonts.headline, fontSize: 17, color: colors.onSurface },
});
