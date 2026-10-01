import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Card, Header, Icon, Row, Screen, Text } from '@/components/ui';
import { colors, space } from '@/theme';

const SECTIONS = [
  { title: 'conduct.donorsTitle', items: ['conduct.donors1', 'conduct.donors2', 'conduct.donors3'] },
  { title: 'conduct.driversTitle', items: ['conduct.drivers1', 'conduct.drivers2', 'conduct.drivers3', 'conduct.drivers4'] },
  { title: 'conduct.everyoneTitle', items: ['conduct.everyone1', 'conduct.everyone2'] },
] as const;

export default function Conduct() {
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1 }}>
      <Header title={t('conduct.title')} />
      <Screen>
        <Text>{t('conduct.intro')}</Text>
        {SECTIONS.map((s) => (
          <Card key={s.title} tone="low" style={{ gap: space.sm }}>
            <Text variant="title">{t(s.title)}</Text>
            {s.items.map((item) => (
              <Row key={item} style={{ alignItems: 'flex-start' }} gap={space.sm}>
                <Icon name="check-circle" size={18} color={colors.primary} />
                <Text style={{ flex: 1 }}>{t(item)}</Text>
              </Row>
            ))}
          </Card>
        ))}
        <Card tone="secondary">
          <Text variant="label">{t('conduct.record')}</Text>
        </Card>
      </Screen>
    </View>
  );
}
