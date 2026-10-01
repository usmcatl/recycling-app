import { useTranslation } from 'react-i18next';
import { AccountScreen } from '@/components/AccountScreen';
import { Card, Row, Stat, Text } from '@/components/ui';
import { formatKg } from '@/lib/format';
import { useClosedStops } from '@/lib/use-driver-data';
import { useSession } from '@/providers/session';

export default function DriverProfile() {
  const { t } = useTranslation();
  const { profile } = useSession();
  const { delivered, kg } = useClosedStops();
  const vehicle = [profile?.vehicle_color, profile?.vehicle_make, profile?.vehicle_model].filter(Boolean).join(' ');

  return (
    <AccountScreen title={t('driver.profileTitle')}>
      <Card tone="primary">
        <Row>
          <Stat light value={String(delivered.length)} label={t('driver.totalPickups')} />
          <Stat light value={formatKg(kg)} label={t('driver.kgCollected')} />
        </Row>
      </Card>
      {vehicle ? (
        <Card tone="low">
          <Text variant="eyebrow">{t('profile.vehicle')}</Text>
          <Text variant="title">{vehicle}</Text>
          {profile?.vehicle_plate ? <Text variant="bodySmall">{t('requestStatus.plate', { plate: profile.vehicle_plate })}</Text> : null}
        </Card>
      ) : null}
    </AccountScreen>
  );
}
