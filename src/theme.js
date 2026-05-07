export const colors = {
  // Backgrounds
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceElevated: '#FAFAFA',

  // Primary brand
  primary: '#00C853',
  primaryDark: '#00A847',
  primaryLight: '#E8F8EE',

  // Text
  textPrimary: '#0A0E27',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',

  // Borders & dividers
  border: '#F3F4F6',
  borderStrong: '#E5E7EB',

  // Semantic
  success: '#00C853',
  successLight: '#E8F8EE',
  error: '#FF3B30',
  errorLight: '#FFE5E3',
  warning: '#FF9500',
  warningLight: '#FFF3E0',
  info: '#007AFF',
  infoLight: '#E5F2FF',

  // Accent (pour micro-pops)
  accentYellow: '#FFD600',
  accentYellowLight: '#FFF9CC',

  // Overlays
  overlay: 'rgba(10, 14, 39, 0.5)',
  overlayLight: 'rgba(10, 14, 39, 0.1)',
}

export const typography = {
  // Sizes
  display: 32,
  h1: 28,
  h2: 22,
  h3: 18,
  body: 16,
  bodySmall: 14,
  caption: 12,

  // Weights
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',

  // Line heights
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
}

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
}

export const shadows = {
  sm: {
    shadowColor: '#0A0E27',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#0A0E27',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  lg: {
    shadowColor: '#0A0E27',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
}

export default { colors, typography, spacing, radius, shadows }
