import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { BlurView } from 'expo-blur';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius } from '@/theme';
import { Icon, type IconName } from './ui';

/** Glass bottom bar with a filled pill on the active tab, as in the mockup. */
export function TabBar({ state, descriptors, navigation, icons }: BottomTabBarProps & { icons: Record<string, IconName> }) {
  const insets = useSafeAreaInsets();
  const Container = Platform.OS === 'ios' ? BlurView : View;
  return (
    <Container
      intensity={40}
      tint="light"
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }, Platform.OS !== 'ios' && styles.opaque]}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        if ((options as { href?: unknown }).href === null) return null;
        const label = typeof options.title === 'string' ? options.title : route.name;
        const color = focused ? colors.onPrimary : colors.onSurfaceVariant;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={[styles.item, focused && styles.itemActive]}
          >
            <Icon name={icons[route.name] ?? 'circle'} size={22} color={color} />
            <Text style={[styles.label, { color }]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </Container>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 8,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
  },
  opaque: { backgroundColor: 'rgba(242,244,243,0.97)' },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 72,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.full,
  },
  itemActive: { backgroundColor: colors.primaryContainer },
  label: { fontFamily: fonts.bodySemi, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' },
});
