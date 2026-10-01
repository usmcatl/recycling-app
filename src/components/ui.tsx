import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { ambientShadow, colors, fonts, gradient, radius, space } from '@/theme';

export type IconName = ComponentProps<typeof MaterialIcons>['name'];

export function Icon({ name, size = 24, color = colors.primary }: { name: IconName; size?: number; color?: string }) {
  return <MaterialIcons name={name} size={size} color={color} />;
}

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

type Variant = 'display' | 'headline' | 'title' | 'body' | 'bodySmall' | 'label' | 'eyebrow';

const variantStyles: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: -0.8, color: colors.onSurface },
  headline: { fontFamily: fonts.headline, fontSize: 24, lineHeight: 30, letterSpacing: -0.3, color: colors.onSurface },
  title: { fontFamily: fonts.title, fontSize: 18, lineHeight: 24, color: colors.onSurface },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.onSurfaceVariant },
  bodySmall: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.onSurfaceVariant },
  label: { fontFamily: fonts.bodySemi, fontSize: 14, lineHeight: 18, color: colors.onSurface },
  eyebrow: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.onSurfaceVariant,
  },
};

export function Text({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  return <RNText {...rest} style={[variantStyles[variant], style]} />;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Screen({
  children,
  scroll = true,
  padded = true,
  style,
  footer,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  footer?: ReactNode;
}) {
  const content = padded ? [styles.padded, style] : style;
  return (
    <View style={styles.screen}>
      {scroll ? (
        <ScrollView contentContainerStyle={[content, { paddingBottom: 120 }]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, content]}>{children}</View>
      )}
      {footer}
    </View>
  );
}

/** Top bar with back arrow and title, glass-like surface. */
export function Header({ title, right, onBack }: { title: string; right?: ReactNode; onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={12}
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
        style={styles.headerBack}
      >
        <Icon name="arrow-back" />
      </Pressable>
      <Text variant="title" style={{ color: colors.primary, flex: 1 }} numberOfLines={1}>
        {title}
      </Text>
      {right}
    </View>
  );
}

/** Brand bar used on tab roots. */
export function BrandBar({ title, right }: { title?: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  return (
    <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
      <Icon name="eco" color={colors.primary} size={22} />
      <Text variant="title" style={{ color: colors.primary, flex: 1, marginLeft: space.sm }}>
        {title ?? t('common.appName')}
      </Text>
      {right}
    </View>
  );
}

export function DemoBanner() {
  const { t } = useTranslation();
  if (api.mode !== 'demo') return null;
  return (
    <View style={styles.demo}>
      <Icon name="science" size={14} color={colors.tertiary} />
      <Text variant="bodySmall" style={{ color: colors.tertiary, fontSize: 12 }}>
        {t('common.demoBanner')}
      </Text>
    </View>
  );
}

export function Card({
  children,
  tone = 'lowest',
  style,
  onPress,
}: {
  children: ReactNode;
  tone?: 'lowest' | 'low' | 'high' | 'primary' | 'secondary' | 'tertiary';
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const bg = {
    lowest: colors.surfaceContainerLowest,
    low: colors.surfaceContainerLow,
    high: colors.surfaceContainerHigh,
    primary: colors.primary,
    secondary: colors.secondaryContainer,
    tertiary: colors.tertiaryContainer,
  }[tone];
  const body = <View style={[styles.card, { backgroundColor: bg }, style]}>{children}</View>;
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      {body}
    </Pressable>
  );
}

export function Row({ children, gap = space.md, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function IconTile({ name, bg = colors.secondaryContainer, color = colors.primary, size = 48 }: {
  name: IconName;
  bg?: string;
  color?: string;
  size?: number;
}) {
  return (
    <View style={[styles.iconTile, { backgroundColor: bg, width: size, height: size }]}>
      <Icon name={name} color={color} size={size * 0.5} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type ButtonProps = {
  label: string;
  onPress?: () => void | Promise<void>;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, icon, variant = 'primary', loading, disabled, style }: ButtonProps) {
  const [busy, setBusy] = useState(false);
  const isBusy = loading || busy;
  const inactive = disabled || isBusy;

  async function handle() {
    if (!onPress || inactive) return;
    const r = onPress();
    if (r instanceof Promise) {
      setBusy(true);
      try {
        await r;
      } finally {
        setBusy(false);
      }
    }
  }

  const fg = {
    primary: colors.onPrimary,
    secondary: colors.onSecondaryContainer,
    tertiary: colors.primary,
    danger: colors.error,
  }[variant];

  const inner = (
    <Row gap={space.sm} style={{ justifyContent: 'center' }}>
      {isBusy ? <ActivityIndicator color={fg} /> : null}
      <RNText style={[styles.buttonLabel, { color: fg }]}>{label}</RNText>
      {icon && !isBusy ? <Icon name={icon} size={20} color={fg} /> : null}
    </Row>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      onPress={handle}
      style={({ pressed }) => [{ opacity: inactive ? 0.5 : pressed ? 0.85 : 1 }, style]}
    >
      {variant === 'primary' ? (
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.button, ambientShadow]}>
          {inner}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.button,
            variant === 'secondary' && { backgroundColor: colors.secondaryContainer },
            variant === 'danger' && { backgroundColor: colors.errorContainer },
          ]}
        >
          {inner}
        </View>
      )}
    </Pressable>
  );
}

export function Chip({ label, tone = 'secondary', icon }: { label: string; tone?: 'secondary' | 'tertiary' | 'error' | 'neutral'; icon?: IconName }) {
  const map = {
    secondary: [colors.secondaryContainer, colors.onSecondaryContainer],
    tertiary: [colors.tertiaryFixed, colors.tertiary],
    error: [colors.errorContainer, colors.onErrorContainer],
    neutral: [colors.surfaceContainerHigh, colors.onSurfaceVariant],
  }[tone];
  return (
    <View style={[styles.chip, { backgroundColor: map[0] }]}>
      {icon ? <Icon name={icon} size={12} color={map[1]} /> : <View style={[styles.dot, { backgroundColor: map[1] }]} />}
      <RNText style={[styles.chipText, { color: map[1] }]}>{label}</RNText>
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <Row gap={space.xs} style={styles.segmented}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segment, on && { backgroundColor: colors.primary }]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <RNText style={[styles.segmentText, { color: on ? colors.onPrimary : colors.onSurfaceVariant }]}>
              {o.label}
            </RNText>
          </Pressable>
        );
      })}
    </Row>
  );
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="eyebrow">{label}</Text>
      <TextInput
        placeholderTextColor={colors.outline}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={[
          styles.input,
          props.multiline && { minHeight: 110, textAlignVertical: 'top', paddingTop: 14 },
          { borderColor: focused ? colors.primary : 'rgba(191,201,198,0.35)' },
          props.style,
        ]}
      />
      {hint ? <Text variant="bodySmall">{hint}</Text> : null}
    </View>
  );
}

export function ProgressBar({ value, track = colors.secondaryContainer, fill = colors.primary, height = 10 }: {
  value: number;
  track?: string;
  fill?: string;
  height?: number;
}) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height: '100%', borderRadius: height, backgroundColor: fill }} />
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.error}>
      <Icon name="error-outline" size={18} color={colors.onErrorContainer} />
      <Text variant="bodySmall" style={{ color: colors.onErrorContainer, flex: 1 }}>
        {message}
      </Text>
    </View>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.secondaryContainer,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <RNText style={{ fontFamily: fonts.headline, color: colors.primary, fontSize: size * 0.36 }}>{initials}</RNText>
    </View>
  );
}

export function Stat({ value, label, light }: { value: string; label: string; light?: boolean }) {
  return (
    <View style={{ gap: 2 }}>
      <Text variant="headline" style={{ color: light ? colors.onPrimary : colors.primary, fontSize: 28, lineHeight: 32 }}>
        {value}
      </Text>
      <Text variant="eyebrow" style={{ color: light ? colors.onPrimaryContainer : colors.onSurfaceVariant, letterSpacing: 1 }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  padded: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    backgroundColor: 'rgba(248,250,248,0.92)',
  },
  headerBack: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  demo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    backgroundColor: colors.tertiaryFixed,
  },
  card: { borderRadius: radius.xl, padding: space.lg, gap: space.md },
  iconTile: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  button: {
    minHeight: 56,
    borderRadius: radius.full,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: { fontFamily: fonts.bodySemi, fontSize: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' },
  segmented: { backgroundColor: colors.surfaceContainerHigh, borderRadius: radius.full, padding: 4, alignSelf: 'flex-start' },
  segment: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.full },
  segmentText: { fontFamily: fonts.bodySemi, fontSize: 13 },
  input: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.md,
    minHeight: 52,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.onSurface,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.errorContainer,
  },
});
