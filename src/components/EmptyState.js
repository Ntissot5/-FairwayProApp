import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { colors, spacing, radius } from '../theme'

export default function EmptyState({ icon: Icon, title, description, ctaLabel, onCtaPress }) {
  return (
    <View style={s.container}>
      <View style={s.iconWrap}>
        <Icon size={56} color={colors.primary} strokeWidth={1.5} />
      </View>
      <Text style={s.title}>{title}</Text>
      {description && <Text style={s.description}>{description}</Text>}
      {ctaLabel && (
        <TouchableOpacity style={s.cta} onPress={onCtaPress} activeOpacity={0.8}>
          <Text style={s.ctaLabel}>{ctaLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.xxxl },
  iconWrap: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
  title: { fontSize: 20, fontFamily: 'Inter_600SemiBold', color: colors.textPrimary, textAlign: 'center', marginBottom: spacing.sm },
  description: { fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 280, marginBottom: spacing.xl },
  cta: { backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.full },
  ctaLabel: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.textInverse },
})
