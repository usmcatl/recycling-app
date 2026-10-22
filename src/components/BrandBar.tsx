import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space } from '@/theme';
import { RoleSwitch } from './RoleSwitch';
import { Icon, Text, type IconName } from './ui';

/**
 * Top bar on tab screens: the logo (or an icon) and the Donor / Driver switch, with the
 * screen title on its own line below so long titles are never cut off.
 */
export function BrandBar({ title, icon }: { title?: string; icon?: IconName }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + space.sm }]}>
      <View style={styles.top}>
        {icon ? (
          <View style={styles.iconWrap}>
            <Icon name={icon} size={24} color={colors.primary} />
          </View>
        ) : (
          <Image
            source={require('../../assets/images/logo-mark.png')}
            style={styles.mark}
            resizeMode="contain"
            accessibilityLabel={t('common.appName')}
          />
        )}
        <RoleSwitch />
      </View>
      {title ? (
        <Text variant="title" style={{ color: colors.primary }}>
          {title}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    backgroundColor: 'rgba(248,250,248,0.92)',
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  mark: { width: 44, height: 36 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondaryContainer,
  },
});
