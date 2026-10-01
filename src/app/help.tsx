import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, View } from 'react-native';
import { Button, Card, Header, Icon, Row, Screen, Text } from '@/components/ui';
import { SUPPORT_EMAIL } from '@/lib/constants';
import { colors, space } from '@/theme';


export default function Help() {
  const { t } = useTranslation();
  const [open, setOpen] = useState<number | null>(0);
  const faqs = [1, 2, 3, 4, 5].map((n) => ({ q: t(`help.q${n}`), a: t(`help.a${n}`) }));

  return (
    <View style={{ flex: 1 }}>
      <Header title={t('help.title')} />
      <Screen>
        <Text variant="headline">{t('help.popular')}</Text>
        <Card tone="low" style={{ gap: space.sm }}>
          {faqs.map((f, i) => (
            <Pressable key={f.q} onPress={() => setOpen(open === i ? null : i)} accessibilityRole="button">
              <Card style={{ gap: space.sm }}>
                <Row>
                  <Text variant="label" style={{ flex: 1, fontSize: 15 }}>
                    {f.q}
                  </Text>
                  <Icon name={open === i ? 'expand-less' : 'expand-more'} />
                </Row>
                {open === i ? <Text>{f.a}</Text> : null}
              </Card>
            </Pressable>
          ))}
        </Card>

        <Card tone="primary">
          <Text variant="headline" style={{ color: colors.onPrimary }}>
            {t('help.stillNeed')}
          </Text>
          <Text style={{ color: colors.onPrimaryContainer }}>{t('help.stillNeedBody')}</Text>
          <Button variant="secondary" icon="mail" label={t('help.email')} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
        </Card>
      </Screen>
    </View>
  );
}
