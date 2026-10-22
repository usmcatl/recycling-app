import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space } from '@/theme';
import { RoleSwitch } from './RoleSwitch';
import { Icon, Text, type IconName } from './ui';

/** Top bar on tab screens: the logo (or an icon), the screen title, and the Donor / Driver switch. */
export function BrandBar({ title, icon }: { title?: string; icon?: IconName }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + space.sm }]}>
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
      <Text variant="title" style={{ color: colors.primary, flex: 1 }} numberOfLines={1}>
        {title ?? ''}
      </Text>
      <RoleSwitch />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    backgroundColor: 'rgba(248,250,248,0.92)',
  },
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
