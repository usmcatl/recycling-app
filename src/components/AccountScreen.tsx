import Constants from 'expo-constants';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { setLanguage } from '@/i18n';
import type { Locale } from '@/lib/types';
import { useSession } from '@/providers/session';
import { colors, space } from '@/theme';
import { Avatar, BrandBar, Card, Icon, Row, Screen, Segmented, Text, type IconName } from './ui';

/** Account tab shared by donors and drivers. `children` renders above the menu. */
export function AccountScreen({ title, children }: { title: string; children?: ReactNode }) {
  const { t, i18n } = useTranslation();
  const { profile, saveProfile, signOut } = useSession();
  if (!profile) return null;

  async function changeLanguage(locale: Locale) {
    await setLanguage(locale);
    await saveProfile({ ...profile!, locale });
  }

  const otherRole = profile.role === 'donor' ? 'driver' : 'donor';

  return (
    <View style={{ flex: 1 }}>
      <BrandBar title={title} />
      <Screen>
        <Row>
          <Avatar name={profile.full_name} size={64} />
          <View style={{ flex: 1 }}>
            <Text variant="headline">{profile.full_name}</Text>
            <Text variant="bodySmall">
              {[profile.community, profile.whatsapp].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </Row>

        {children}

        <Card tone="low" style={{ gap: space.sm }}>
          <Text variant="eyebrow">{t('account.language')}</Text>
          <Segmented
            value={(i18n.language === 'en' ? 'en' : 'es') as Locale}
            onChange={changeLanguage}
            options={[
              { value: 'es', label: 'Español' },
              { value: 'en', label: 'English' },
            ]}
          />
        </Card>

        <Card tone="low" style={{ gap: 0, paddingVertical: space.sm }}>
          <MenuItem icon="edit" label={t('account.editProfile')} onPress={() => router.push({ pathname: '/profile-setup', params: { edit: '1' } })} />
          <MenuItem icon="notifications" label={t('account.notifications')} onPress={() => router.push('/notifications')} />
          <MenuItem icon="help-outline" label={t('account.help')} onPress={() => router.push('/help')} />
          <MenuItem
            icon="swap-horiz"
            label={otherRole === 'driver' ? t('account.switchToDriver') : t('account.switchToDonor')}
            onPress={() => router.push({ pathname: '/profile-setup', params: { edit: '1', role: otherRole } })}
          />
          <MenuItem
            icon="logout"
            label={t('account.signOut')}
            color={colors.error}
            onPress={async () => {
              await signOut();
              router.replace('/');
            }}
          />
        </Card>

        <Text variant="bodySmall" style={{ textAlign: 'center' }}>
          {t('common.serviceOf')} · {t('account.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
        </Text>
      </Screen>
    </View>
  );
}

function MenuItem({ icon, label, onPress, color = colors.onSurface }: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <Row style={{ paddingVertical: 14 }}>
        <Icon name={icon} color={color === colors.onSurface ? colors.primary : color} />
        <Text variant="label" style={{ flex: 1, color, fontSize: 15 }}>
          {label}
        </Text>
        <Icon name="chevron-right" color={colors.outline} />
      </Row>
    </Pressable>
  );
}
