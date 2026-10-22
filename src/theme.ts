// "The Curated Earth" design tokens, taken from the Stitch mockup (eco_system_design/DESIGN.md).
// Rules worth remembering: no 1px dividers (use tonal surface shifts), no pure black,
// gradient primary CTAs, ambient shadows only on floating elements.

export const colors = {
  primary: '#004e49',
  primaryContainer: '#226661',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#a0e1da',
  primaryFixed: '#adefe8',

  secondary: '#54624d',
  secondaryContainer: '#d7e8cc',
  onSecondaryContainer: '#5a6953',

  tertiary: '#004c5e',
  tertiaryContainer: '#1f6479',
  onTertiaryContainer: '#a0dff7',
  tertiaryFixed: '#b7eaff',

  surface: '#f8faf8',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f2f4f3',
  surfaceContainer: '#eceeed',
  surfaceContainerHigh: '#e6e9e7',
  surfaceContainerHighest: '#e1e3e2',

  onSurface: '#191c1c',
  onSurfaceVariant: '#3f4947',
  outline: '#6f7977',
  outlineVariant: '#bfc9c6',

  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',

  // material accent swatches used on the selection cards
  amberContainer: '#ffedd5',
  amber: '#c2410c',
} as const;

export const fonts = {
  display: 'Manrope_800ExtraBold',
  headline: 'Manrope_700Bold',
  title: 'Manrope_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

export const radius = {
  sm: 8,
  md: 16,
  xl: 24,
  full: 999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

export const gradient = [colors.primary, colors.primaryContainer] as const;

export const ambientShadow = {
  shadowColor: colors.onSurface,
  shadowOpacity: 0.08,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 8 },
  elevation: 6,
} as const;
