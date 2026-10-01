import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { RequestCard } from '@/components/requests';
import { BrandBar, Card, Row, Screen, Stat, Text } from '@/components/ui';
import { formatKg } from '@/lib/format';
import { useClosedStops } from '@/lib/use-driver-data';

export default function DriverHistory() {
  const { t } = useTranslation();
  const { closed, delivered, kg } = useClosedStops();

  return (
    <View style={{ flex: 1 }}>
      <BrandBar title={t('driver.historyTitle')} />
      <Screen>
        <Row>
          <Card style={{ flex: 1 }}>
            <Stat value={String(delivered.length)} label={t('driver.totalPickups')} />
          </Card>
          <Card style={{ flex: 1 }}>
            <Stat value={formatKg(kg)} label={t('driver.kgCollected')} />
          </Card>
        </Row>
        {closed.length === 0 ? (
          <Card tone="low">
            <Text>{t('driver.historyEmpty')}</Text>
          </Card>
        ) : (
          closed.map((r) => <RequestCard key={r.id} request={r} showDonor onPress={() => router.push(`/case/${r.id}`)} />)
        )}
      </Screen>
    </View>
  );
}
