import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Role } from '@/lib/types';
import { useSession } from '@/providers/session';
import { colors, fonts, radius } from '@/theme';
import { homeHref } from './nav';
import { Icon, type IconName } from './ui';

const OPTIONS: { role: Role; icon: IconName }[] = [
  { role: 'donor', icon: 'inventory-2' },
  { role: 'driver', icon: 'local-shipping' },
];

/**
 * Donor / Driver switch shown at the top of both apps, so anyone can get back to
 * choosing a role. The first switch to a role without its details opens profile setup.
 */
export function RoleSwitch() {
  const { t } = useTranslation();
  const { profile, saveProfile } = useSession();
  const [busy, setBusy] = useState(false);
  if (!profile) return null;

  async function switchTo(role: Role) {
    if (!profile || profile.role === role || busy) return;
    const needsSetup = role === 'donor' ? !profile.address : !(profile.vehicle_make || profile.vehicle_plate);
    if (needsSetup) {
      router.push({ pathname: '/profile-setup', params: { edit: '1', role } });
      return;
    }
    setBusy(true);
    try {
      await saveProfile({ ...profile, role });
      router.replace(homeHref(role));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      {OPTIONS.map(({ role, icon }) => {
        const on = profile.role === role;
        const color = on ? colors.onPrimary : colors.onSurfaceVariant;
        return (
          <Pressable
            key={role}
            onPress={() => switchTo(role)}
            style={[styles.item, on && { backgroundColor: colors.primary }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on, busy }}
            hitSlop={4}
          >
            <Icon name={icon} size={14} color={color} />
            <Text style={[styles.label, { color }]}>{t(`roleSwitch.${role}`)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radius.full,
    padding: 3,
    gap: 2,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  label: { fontFamily: fonts.bodySemi, fontSize: 12 },
});
