import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMaterialsLabel } from '@/components/requests';
import { Button, Card, Icon, IconTile, Loading, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, formatKg } from '@/lib/format';
import { useData } from '@/lib/use-data';
import { colors, space } from '@/theme';

export default function Confirmed() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: request } = useData(() => api.getRequest(id), [id]);
  const materialsLabel = useMaterialsLabel();

  if (!request) return <Loading />;

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <Screen style={{ alignItems: 'stretch' }}>
        <View style={{ alignItems: 'center', gap: space.md, marginTop: space.xl }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.secondaryContainer, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="check-circle" size={56} color={colors.primary} />
          </View>
          <Text variant="display" style={{ textAlign: 'center' }}>
            {t('confirmed.headline')}
          </Text>
          <Text style={{ textAlign: 'center' }}>{t('confirmed.body')}</Text>
        </View>

        <Card tone="low">
          <Text variant="eyebrow">{t('confirmed.reference')}</Text>
          <Text variant="headline" style={{ color: colors.primary }}>
            #{request.case_code}
          </Text>
          <Row gap={space.sm}>
            <Icon name="schedule" size={18} />
            <Text variant="label">
              {t('confirmed.pickup')}: {formatDate(request.preferred_date)} · {t(`windows.${request.time_window}`)}
            </Text>
          </Row>
        </Card>

        <Card tone="primary" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IconTile name="eco" bg="rgba(255,255,255,0.15)" color={colors.primaryFixed} />
          <Text style={{ color: colors.onPrimary, flex: 1 }}>
            {t('confirmed.estimate', { kg: formatKg(request.estimated_kg) })}
          </Text>
        </Card>

        <Card>
          <Row>
            <Icon name="location-on" />
            <Text style={{ flex: 1 }}>{[request.address, request.community].filter(Boolean).join(', ')}</Text>
          </Row>
          <Row>
            <Icon name="inventory-2" />
            <Text style={{ flex: 1 }}>
              {t('common.bags', { count: request.bag_count })} · {materialsLabel(request.materials, request.other_material)}
            </Text>
          </Row>
        </Card>

        <Button label={t('confirmed.track')} icon="arrow-forward" onPress={() => router.replace(`/status/${request.id}`)} />
        <Button variant="secondary" label={t('confirmed.home')} onPress={() => router.replace('/home')} />

        <Text variant="bodySmall" style={{ textAlign: 'center', fontStyle: 'italic' }}>
          {t('confirmed.quote')}
        </Text>
      </Screen>
    </View>
  );
}
