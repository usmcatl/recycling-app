import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import { isUrgent } from '@/lib/schedule';
import type { Route } from '@/lib/types';
import { colors, space } from '@/theme';
import { useDateLabel } from './requests';
import { Card, Icon, Row, Text } from './ui';

/**
 * From 6 PM the night before, flags open routes that have donors signed up but no driver yet,
 * so a driver can still take them before the morning.
 */
export function UrgentRoutes({ routes, style }: { routes: Route[]; style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  const dateLabel = useDateLabel();
  const urgent = routes.filter((r) => r.status === 'open' && r.stop_count > 0 && isUrgent(r.route_date));
  if (urgent.length === 0) return null;
  return (
    <View style={[{ gap: space.sm }, style]}>
      {urgent.map((r) => (
        <Pressable key={r.id} onPress={() => router.push(`/route/${r.id}`)} accessibilityRole="button">
          <Card style={{ backgroundColor: colors.errorContainer, padding: space.md, gap: 4 }}>
            <Row gap={6}>
              <Icon name="notification-important" size={18} color={colors.onErrorContainer} />
              <Text variant="label" style={{ color: colors.onErrorContainer, flex: 1 }}>
                {t('driver.urgentTitle')}
              </Text>
              <Icon name="chevron-right" size={18} color={colors.onErrorContainer} />
            </Row>
            <Text variant="bodySmall" style={{ color: colors.onErrorContainer }}>
              {t('driver.urgentBody', { community: r.community, date: dateLabel(r.route_date), count: r.stop_count })}
            </Text>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}
