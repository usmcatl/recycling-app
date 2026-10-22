import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { RequestCard } from '@/components/requests';
import { BrandBar } from '@/components/BrandBar';
import { Card, Row, Screen, Stat, Text } from '@/components/ui';
import { formatKg } from '@/lib/format';
import { useClosedStops } from '@/lib/use-driver-data';
import { space } from '@/theme';

export default function DriverHistory() {
  const { t } = useTranslation();
  const { closed, delivered, kg } = useClosedStops();

  return (
    <View style={{ flex: 1 }}>
      <BrandBar title={t('driver.historyTitle')} />
      <Screen>
        <Row style={{ flexWrap: 'wrap' }}>
          <Card style={{ flexGrow: 1, flexBasis: 130, padding: space.md }}>
            <Stat value={String(delivered.length)} label={t('driver.totalPickups')} />
          </Card>
          <Card style={{ flexGrow: 1, flexBasis: 130, padding: space.md }}>
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
