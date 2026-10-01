import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch, View } from 'react-native';
import { Button, Card, Header, Icon, Row, Screen, Text, type IconName } from '@/components/ui';
import type { Profile } from '@/lib/types';
import { useSession } from '@/providers/session';
import { colors, space } from '@/theme';

type PrefKey = Extract<keyof Profile, `notify_${string}`>;

export default function Notifications() {
  const { t } = useTranslation();
  const { profile, saveProfile } = useSession();
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>({
    notify_push: profile?.notify_push ?? true,
    notify_whatsapp: profile?.notify_whatsapp ?? true,
    notify_email: profile?.notify_email ?? false,
    notify_updates: profile?.notify_updates ?? true,
    notify_status: profile?.notify_status ?? true,
    notify_impact: profile?.notify_impact ?? true,
    notify_tips: profile?.notify_tips ?? false,
  });
  if (!profile) return null;

  const toggle = (k: PrefKey) => (v: boolean) => setPrefs((p) => ({ ...p, [k]: v }));

  const methods: [PrefKey, IconName, string][] = [
    ['notify_push', 'notifications-active', t('notifications.push')],
    ['notify_whatsapp', 'chat', t('notifications.whatsapp')],
    ['notify_email', 'mail', t('notifications.email')],
  ];
  const types: [PrefKey, string, string][] = [
    ['notify_updates', t('notifications.updates'), t('notifications.updatesDesc')],
    ['notify_status', t('notifications.statusChanges'), t('notifications.statusDesc')],
    ['notify_impact', t('notifications.impact'), t('notifications.impactDesc')],
    ['notify_tips', t('notifications.tips'), t('notifications.tipsDesc')],
  ];

  return (
    <View style={{ flex: 1 }}>
      <Header title={t('notifications.title')} />
      <Screen>
        <Text variant="display">{t('notifications.headline')}</Text>
        <Text>{t('notifications.body')}</Text>

        <Text variant="eyebrow">{t('notifications.methods')}</Text>
        <Card tone="low">
          {methods.map(([k, icon, label]) => (
            <Row key={k}>
              <Icon name={icon} />
              <Text variant="label" style={{ flex: 1 }}>
                {label}
              </Text>
              <Switch
                value={prefs[k]}
                onValueChange={toggle(k)}
                trackColor={{ true: colors.primaryContainer, false: colors.surfaceContainerHighest }}
              />
            </Row>
          ))}
        </Card>

        <Text variant="eyebrow">{t('notifications.types')}</Text>
        <Card tone="low" style={{ gap: space.lg }}>
          {types.map(([k, label, desc]) => (
            <Row key={k}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="label">{label}</Text>
                <Text variant="bodySmall">{desc}</Text>
              </View>
              <Switch
                value={prefs[k]}
                onValueChange={toggle(k)}
                trackColor={{ true: colors.primaryContainer, false: colors.surfaceContainerHighest }}
              />
            </Row>
          ))}
        </Card>

        <Button
          label={t('common.save')}
          icon="check-circle"
          onPress={async () => {
            await saveProfile({ ...profile, ...prefs });
            router.back();
          }}
        />
      </Screen>
    </View>
  );
}
