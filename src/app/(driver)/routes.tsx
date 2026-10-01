import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { RequestCard } from '@/components/requests';
import { BrandBar, Card, Screen, Text } from '@/components/ui';
import { formatDistance } from '@/lib/format';
import { useDriverData } from '@/lib/use-driver-data';
import { useDriver } from '@/providers/driver';
import { space } from '@/theme';

export default function Routes() {
  const { t } = useTranslation();
  const { position } = useDriver();
  const { open, inHand, distanceTo } = useDriverData(position);

  const trailing = (km: number | null) => (km != null ? formatDistance(km) : undefined);

  return (
    <View style={{ flex: 1 }}>
      <BrandBar title={t('driver.routesTitle')} />
      <Screen>
        {inHand.length > 0 ? (
          <View style={{ gap: space.md }}>
            <Text variant="eyebrow">{t('driver.myQueue')}</Text>
            {inHand.map((r) => (
              <RequestCard key={r.id} request={r} trailing={trailing(distanceTo(r))} onPress={() => router.push(`/case/${r.id}`)} />
            ))}
          </View>
        ) : null}

        <View style={{ gap: space.md }}>
          <Text variant="eyebrow">{t('driver.openRequests')}</Text>
          <Text>{position ? t('driver.routesBody') : t('driver.locationNeeded')}</Text>
          {open.length === 0 ? (
            <Card tone="low">
              <Text>{t('driver.noOpen')}</Text>
            </Card>
          ) : (
            open.map((r) => (
              <RequestCard key={r.id} request={r} trailing={trailing(distanceTo(r))} onPress={() => router.push(`/case/${r.id}`)} />
            ))
          )}
        </View>
      </Screen>
    </View>
  );
}
