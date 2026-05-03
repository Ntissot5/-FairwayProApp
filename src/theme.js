// FairwayPro Design System — Light & Dark palettes (Apple HIG)

export const lightColors = {
  primary: '#1B5E35',
  primaryLight: '#E8F5EE',
  bg: '#FFFFFF',
  bgSecondary: '#F2F2F7',
  card: '#FFFFFF',
  text: '#000000',
  textSecondary: '#3C3C43',
  textTertiary: '#8E8E93',
  separator: '#C6C6C8',
  separatorLight: '#F2F2F7',
  destructive: '#FF3B30',
  destructiveBg: '#FFF2F1',
  inputBg: '#F8FAF8',
  inputBorder: '#E0E5E0',
  tabBar: '#FFFFFF',
  tabBarBorder: 'transparent',
  overlay: 'rgba(0,0,0,0.3)',
  // Charts
  chartBar: '#1B5E35',
  chartBarInactive: '#E5E7EB',
  chartLine: '#1B5E35',
  chartFill: '#E8F5EE',
  chartGrid: '#F2F2F7',
  chartText: '#8E8E93',
  // Semantic
  success: '#059669',
  successBg: '#ECFDF5',
  warning: '#D97706',
  warningBg: '#FFFBEB',
  info: '#0891B2',
  infoBg: '#ECFEFF',
  // Avatar accent colors
  avatarColors: ['#0891B2', '#7C3AED', '#DC2626', '#D97706', '#059669', '#2563EB', '#DB2777', '#9333EA'],
  // Shadows
  shadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  shadowMedium: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
}

export const darkColors = {
  primary: '#34D399',
  primaryLight: '#1B3A2A',
  bg: '#000000',
  bgSecondary: '#1C1C1E',
  card: '#1C1C1E',
  text: '#FFFFFF',
  textSecondary: '#EBEBF5',
  textTertiary: '#8E8E93',
  separator: '#38383A',
  separatorLight: '#2C2C2E',
  destructive: '#FF453A',
  destructiveBg: '#3A1C1C',
  inputBg: '#2C2C2E',
  inputBorder: '#3A3A3C',
  tabBar: '#1C1C1E',
  tabBarBorder: '#38383A',
  overlay: 'rgba(0,0,0,0.6)',
  // Charts
  chartBar: '#34D399',
  chartBarInactive: '#38383A',
  chartLine: '#34D399',
  chartFill: '#1B3A2A',
  chartGrid: '#2C2C2E',
  chartText: '#8E8E93',
  // Semantic
  success: '#34D399',
  successBg: '#1B3A2A',
  warning: '#FBBF24',
  warningBg: '#3A2E1C',
  info: '#22D3EE',
  infoBg: '#1C2E3A',
  // Avatar accent colors
  avatarColors: ['#22D3EE', '#A78BFA', '#FB7185', '#FBBF24', '#34D399', '#60A5FA', '#F472B6', '#C084FC'],
  // Shadows (subtle on dark)
  shadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 2 },
  shadowMedium: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
}

// Typography (colors applied at runtime via useTheme)
export const typography = {
  largeTitle: { fontSize: 34, fontWeight: '700', letterSpacing: 0.4 },
  title1: { fontSize: 28, fontWeight: '700', letterSpacing: 0.4 },
  title2: { fontSize: 22, fontWeight: '700', letterSpacing: 0.4 },
  title3: { fontSize: 20, fontWeight: '600' },
  headline: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 17 },
  callout: { fontSize: 16 },
  subhead: { fontSize: 15 },
  footnote: { fontSize: 13 },
  caption1: { fontSize: 12 },
  caption2: { fontSize: 11, fontWeight: '600', letterSpacing: 0.1, textTransform: 'uppercase' },
}

// Spacing & Radius
export const spacing = { sm: 8, md: 16, lg: 20, xl: 24 }
export const radius = { sm: 10, md: 14, lg: 20 }
